import http from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const PORT = Number(process.env.DWG_CONVERTER_PORT || 8791);
const HOST = process.env.DWG_CONVERTER_HOST || "127.0.0.1";
const TOKEN = process.env.DWG_CONVERTER_TOKEN || "";
const MAX_BYTES = Number(process.env.DWG_CONVERTER_MAX_BYTES || 100 * 1024 * 1024);
const DWG2SVG_BIN = process.env.DWG2SVG_BIN || "dwg2SVG";
const RSVG_CONVERT_BIN = process.env.RSVG_CONVERT_BIN || "rsvg-convert";

function json(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function run(command, args, { stdoutFile } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", stdoutFile ? "pipe" : "ignore", "pipe"] });
    const stderr = [];
    const stdout = [];
    child.stderr.on("data", chunk => stderr.push(chunk));
    if (stdoutFile) child.stdout.on("data", chunk => stdout.push(chunk));
    child.once("error", reject);
    child.once("close", async code => {
      if (code !== 0) return reject(new Error(`${command} failed (${code}): ${Buffer.concat(stderr).toString("utf8").trim()}`));
      if (stdoutFile) await writeFile(stdoutFile, Buffer.concat(stdout));
      resolve();
    });
  });
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BYTES) throw new Error("DWG file exceeds converter size limit.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") return json(res, 200, { ok: true, engine: "LibreDWG", output: "pdf" });
  if (req.method !== "POST" || req.url !== "/convert/dwg-to-pdf") return json(res, 404, { error: "Not found" });
  if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) return json(res, 401, { error: "Unauthorized" });

  let workdir = "";
  try {
    const body = await readBody(req);
    if (!body.length) return json(res, 400, { error: "DWG body is empty." });

    workdir = await mkdtemp(join(tmpdir(), "jsolution-dwg-"));
    const input = join(workdir, "drawing.dwg");
    const svg = join(workdir, "drawing.svg");
    const pdf = join(workdir, "drawing.pdf");
    await writeFile(input, body);

    // LibreDWG dwg2SVG writes SVG to stdout.
    await run(DWG2SVG_BIN, [input], { stdoutFile: svg });
    await run(RSVG_CONVERT_BIN, ["-f", "pdf", "-o", pdf, svg]);

    const output = await readFile(pdf);
    res.writeHead(200, {
      "content-type": "application/pdf",
      "content-length": String(output.length),
      "x-dwg-converter": "LibreDWG",
    });
    res.end(output);
  } catch (error) {
    json(res, 500, { error: error instanceof Error ? error.message : "DWG conversion failed." });
  } finally {
    if (workdir) await rm(workdir, { recursive: true, force: true }).catch(() => {});
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[dwg-converter] LibreDWG service listening on http://${HOST}:${PORT}`);
});
