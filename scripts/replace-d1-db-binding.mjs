import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const roots = ["app", "db", "lib", "worker"];
const changed = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function importPathFor(file) {
  const target = path.join(root, "db", "postgres-d1-compat");
  let relative = path.relative(path.dirname(file), target).replaceAll("\\", "/");
  if (!relative.startsWith(".")) relative = `./${relative}`;
  return relative;
}

function hasCompatImport(source) {
  return /import\s*\{[^}]*\bgetLegacyDbCompat\b[^}]*\}\s*from\s*["'][^"']*postgres-d1-compat["'];?/.test(source);
}

function ensureCompatImport(source, file) {
  if (!source.includes("getLegacyDbCompat(")) return source;
  if (hasCompatImport(source)) return source;
  const line = `import { getLegacyDbCompat } from "${importPathFor(file)}";\n`;
  return line + source;
}

for (const file of roots.flatMap((name) => walk(path.join(root, name)))) {
  if (!/\.(ts|tsx|js|jsx)$/.test(file)) continue;
  if (file.endsWith(path.join("db", "postgres-d1-compat.ts"))) continue;
  let source = fs.readFileSync(file, "utf8");
  const before = source;

  // Repair files produced by the first replacement pass where `env.DB`
  // was replaced inside `runtime.env.DB`, yielding runtime.getLegacyDbCompat().
  source = source.replace(/\bruntime\.getLegacyDbCompat\(\)/g, "getLegacyDbCompat()");

  // Replace the most specific forms first so env.DB does not partially
  // rewrite runtime.env.DB.
  source = source.replace(/\((?:await\s+)?import\(["']cloudflare:workers["']\)\)\.env\.DB/g, "getLegacyDbCompat()");
  source = source.replace(/\bruntime\.env\.DB\b/g, "getLegacyDbCompat()");
  source = source.replace(/\benv\.DB\b/g, "getLegacyDbCompat()");

  source = ensureCompatImport(source, file);

  // Remove the exact env-only Cloudflare import when DB was its only use.
  if (!/\benv\./.test(source)) {
    source = source.replace(/^import\s*\{\s*env\s*\}\s*from\s*["']cloudflare:workers["'];?\s*\r?\n/m, "");
  }

  if (source !== before) {
    fs.writeFileSync(file, source, "utf8");
    changed.push(path.relative(root, file).replaceAll("\\", "/"));
  }
}

console.log(`Replaced legacy D1 DB bindings in ${changed.length} source files.`);
for (const file of changed) console.log(`  ${file}`);
console.log("Cloudflare/R2 imports are preserved when other env bindings remain.");
