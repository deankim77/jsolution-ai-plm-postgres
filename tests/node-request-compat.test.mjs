import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { cloneRequestWithHeaders } from "vinext/server/request-pipeline";
import { installNodeRequestCompatibility, requestBodyErrorHandler } from "../tools/node-request-compat.mjs";

const require = createRequire(import.meta.url);
const rscRequire = createRequire(require.resolve("@vitejs/plugin-rsc"));
const adapter = await import(pathToFileURL(rscRequire.resolve("srvx/node")).href);
const { NodeRequest } = adapter;

function incoming(body = "", method = "POST", extraHeaders = {}) {
  const bytes = Buffer.from(body);
  const headers = { host: "localhost:5174", "content-length": String(bytes.length), ...extraHeaders };
  const req = Readable.from(bytes.length ? [bytes] : []);
  Object.assign(req, {
    method, url: "/api/example", httpVersionMajor: 1,
    headers, rawHeaders: Object.entries(headers).flat(), socket: {},
  });
  return { req, request: new NodeRequest({ req }) };
}

test("reproduce the original vinext/srvx failure, then install compatibility", async () => {
  const { request } = incoming("example");
  await request.text();
  assert.throws(() => cloneRequestWithHeaders(request, new Headers()), /disturbed or locked/);
  installNodeRequestCompatibility(adapter);
  installNodeRequestCompatibility(adapter); // config reload is idempotent
});

test("GET, HEAD and ordinary JSON retain their method, headers and content", async () => {
  for (const method of ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]) {
    const payload = ["GET", "HEAD"].includes(method) ? "" : '{"value":"한글"}';
    const { request } = incoming(payload, method, { "content-type": "application/json", cookie: "session=test" });
    const headers = new Headers(request.headers);
    headers.set("x-test", "retained");
    const copy = cloneRequestWithHeaders(request, headers);
    assert.equal(copy.method, method);
    assert.equal(copy.headers.get("cookie"), "session=test");
    assert.equal(copy.headers.get("x-test"), "retained");
    assert.equal(await copy.text(), payload);
  }
});

test("buffering in the Node stream does not mean its Web body was consumed", async () => {
  const { req, request } = incoming("still readable");
  const body = request.body;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(Readable.isDisturbed(req), true);
  assert.equal(Readable.isDisturbed(body), false);
  assert.equal(await cloneRequestWithHeaders(request, new Headers()).text(), "still readable");
});

test("drained empty HTTP/1 POST can still reach the application", async () => {
  const { request } = incoming();
  await request.text();
  assert.equal(await cloneRequestWithHeaders(request, new Headers()).text(), "");
});

test("retained rawBody restores exact multipart bytes", async () => {
  const data = '--boundary\r\nContent-Disposition: form-data; name="file"; filename="sample.txt"\r\nContent-Type: text/plain\r\n\r\n한글 file\r\n--boundary--\r\n';
  const { req, request } = incoming(data, "POST", { "content-type": "multipart/form-data; boundary=boundary" });
  await request.text();
  req.rawBody = Buffer.from(data);
  const copy = cloneRequestWithHeaders(request, new Headers(request.headers));
  const form = await copy.formData();
  assert.equal(await form.get("file").text(), "한글 file");
});

test("lost nonempty body is rejected rather than forwarded as empty", async () => {
  const { request } = incoming("do not discard");
  await request.text();
  assert.throws(() => cloneRequestWithHeaders(request, new Headers()), { code: "PLM_REQUEST_BODY_CONSUMED" });
});

test("chunked and HTTP/2 requests are not assumed bodyless", async () => {
  for (const http2 of [false, true]) {
    const { req, request } = incoming("payload");
    delete req.headers["content-length"];
    if (http2) req.httpVersionMajor = 2;
    else req.headers["transfer-encoding"] = "chunked";
    await request.text();
    assert.throws(() => cloneRequestWithHeaders(request, new Headers()), { code: "PLM_REQUEST_BODY_CONSUMED" });
  }
});

test("active stream readers are not replayed even when rawBody is available", async () => {
  const { req, request } = incoming("payload");
  const reader = request.body.getReader();
  req.rawBody = Buffer.from("payload");
  assert.throws(() => cloneRequestWithHeaders(request, new Headers()), { code: "PLM_REQUEST_BODY_CONSUMED" });
  reader.releaseLock();
});

test("body failures return 400 and log method/path without query or credentials", () => {
  const logs = [];
  const originalWarn = console.warn;
  console.warn = message => logs.push(message);
  try {
    let output;
    const response = { headersSent: false, setHeader() {}, end(value) { output = value; } };
    requestBodyErrorHandler(
      Object.assign(new Error("consumed"), { code: "PLM_REQUEST_BODY_CONSUMED" }),
      { method: "POST", url: "/api/example?token=secret" }, response,
      () => assert.fail("must not reach Vite's overlay handler"),
    );
    assert.equal(response.statusCode, 400);
    assert.equal(JSON.parse(output).code, "REQUEST_BODY_UNAVAILABLE");
    assert.match(logs[0], /POST \/api\/example -> 400/);
    assert.doesNotMatch(logs[0], /secret|token/);
  } finally { console.warn = originalWarn; }
});

test("unrelated errors still reach normal Vite error handling", () => {
  const error = new Error("ordinary application failure");
  let forwarded;
  requestBodyErrorHandler(error, {}, { headersSent: false }, value => { forwarded = value; });
  assert.equal(forwarded, error);
});
