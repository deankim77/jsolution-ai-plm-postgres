import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const errors = [];

const requiredFiles = [
  "ARCHITECTURE.md",
  "AGENTS.md",
  "docs/UI-CONTRACT.md",
  "docs/V2-UI-STANDARD.md",
  "app/ui-standard-tokens.css",
  "app/v2/v2-ui-foundation-enforcement.css",
];

for (const relative of requiredFiles) {
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) errors.push(`${relative}: required architecture/UI contract file is missing`);
}

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

function rel(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

const appDir = path.join(root, "app");
const uiFiles = walk(appDir).filter((file) => {
  const relative = rel(file);
  if (relative.startsWith("app/api/")) return false;
  return /\.(ts|tsx|js|jsx)$/.test(relative);
});

const forbiddenUiPatterns = [
  { re: /(?:from\s*["']|import\s*["'])drizzle-orm(?:\/[^"']*)?["']/g, reason: "UI must not import drizzle-orm directly" },
  { re: /(?:from\s*["']|import\s*["'])cloudflare:workers["']/g, reason: "UI must not access Cloudflare worker bindings directly" },
  { re: /(?:from\s*["']|import\s*["'])(?:@\/)?db(?:\/[^"']*)?["']/g, reason: "UI must not import the DB layer directly" },
  { re: /(?:from\s*["']|import\s*["'])\.\.\/(?:\.\.\/)*db(?:\/[^"']*)?["']/g, reason: "UI must not import the DB layer directly" },
  { re: /\benv\.DB\b/g, reason: "UI must not access D1 env.DB" },
  { re: /\bdrizzle\s*\(/g, reason: "UI must not instantiate an ORM connection" },
];

for (const file of uiFiles) {
  const source = fs.readFileSync(file, "utf8");
  for (const rule of forbiddenUiPatterns) {
    rule.re.lastIndex = 0;
    if (rule.re.test(source)) errors.push(`${rel(file)}: ${rule.reason}`);
  }
}

// During the PostgreSQL migration, legacy SQLite/D1 code can still exist in the baseline.
// The guard prevents NEW SQLite/D1 usage outside known legacy infrastructure locations.
const allowedLegacySqliteFiles = new Set([
  "db/index.ts",
  "db/schema.ts",
  "drizzle.config.ts",
  "wrangler.jsonc",
]);

const sourceRoots = ["app", "db", "lib", "worker"].flatMap((name) => walk(path.join(root, name)));
for (const file of sourceRoots) {
  const relative = rel(file);
  if (!/\.(ts|tsx|js|jsx)$/.test(relative)) continue;
  if (allowedLegacySqliteFiles.has(relative)) continue;
  const source = fs.readFileSync(file, "utf8");
  if (/drizzle-orm\/d1|drizzle-orm\/sqlite-core|\bsqliteTable\b|\benv\.DB\b/.test(source)) {
    errors.push(`${relative}: new SQLite/D1 dependency is forbidden; PostgreSQL is the target architecture`);
  }
}

if (errors.length) {
  console.error("AI PLM Architecture Contract check failed:\n" + errors.join("\n"));
  process.exit(1);
}

console.log(`AI PLM Architecture Contract check passed (${uiFiles.length} UI source files checked).`);
