import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const roots = ["app", "db", "lib"];
const changed = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function importPathFor(file) {
  const target = path.join(root, "db", "postgres-d1-compat");
  let relative = path.relative(path.dirname(file), target).replaceAll("\\", "/");
  if (!relative.startsWith(".")) relative = `./${relative}`;
  return relative;
}

function ensureCompatImport(source, file) {
  if (!source.includes("getLegacyDbCompat(")) return source;
  if (/import\s*\{[^}]*\bgetLegacyDbCompat\b[^}]*\}\s*from\s*["'][^"']*postgres-d1-compat["'];?/.test(source)) return source;
  return `import { getLegacyDbCompat } from "${importPathFor(file)}";\n${source}`;
}

for (const file of roots.flatMap(name => walk(path.join(root, name)))) {
  if (file.endsWith(path.join("db", "postgres-d1-compat.ts"))) continue;
  let source = fs.readFileSync(file, "utf8");
  const before = source;

  source = source.replace(/\bruntime\.env\.DB\b/g, "getLegacyDbCompat()");
  source = source.replace(/\benv\.DB\b/g, "getLegacyDbCompat()");
  source = source.replace(/\((?:await\s+)?import\(["']cloudflare:workers["']\)\)\.env\.DB/g, "getLegacyDbCompat()");

  if (!/\bruntime\./.test(source)) {
    source = source.replace(/\s*const\s+runtime\s*=\s*await\s+import\(["']cloudflare:workers["']\);?/g, "");
  }

  source = ensureCompatImport(source, file);

  if (!/\benv\./.test(source)) {
    source = source.replace(/^import\s*\{\s*env\s*\}\s*from\s*["']cloudflare:workers["'];?\s*\r?\n/m, "");
  }

  if (source !== before) {
    fs.writeFileSync(file, source, "utf8");
    changed.push(path.relative(root, file).replaceAll("\\", "/"));
  }
}

const compatPath = path.join(root, "db", "postgres-d1-compat.ts");
let compat = fs.readFileSync(compatPath, "utf8");
const compatBefore = compat;
if (!compat.includes("GROUP_CONCAT compatibility")) {
  compat = compat.replace(
    /\s*sql = sql\.replace\(\/json_extract\\\(\(\[\^,\]\+\),\\s\*'\\\$\\\.\(\[A-Za-z0-9_\]\+\)'\\\)\/gi, \"\(\$1::jsonb ->> '\$2'\)\"\);/,
    match => `${match}\n\n  // GROUP_CONCAT compatibility: SQLite -> PostgreSQL string_agg.\n  sql = sql.replace(/GROUP_CONCAT\\(\\s*DISTINCT\\s+([^)]+)\\)/gi, \"string_agg(DISTINCT ($1)::text, ',')\");\n  sql = sql.replace(/GROUP_CONCAT\\(\\s*([^)]+)\\)/gi, \"string_agg(($1)::text, ',')\");\n\n  // SQLite date('now') compatibility. Legacy date fields are YYYY-MM-DD text.\n  sql = sql.replace(/date\\(\\s*'now'\\s*\\)/gi, \"CURRENT_DATE::text\");`
  );
}
if (compat !== compatBefore) {
  fs.writeFileSync(compatPath, compat, "utf8");
  changed.push("db/postgres-d1-compat.ts");
}

const notificationPath = path.join(root, "app", "api", "notifications", "notification-service.ts");
if (fs.existsSync(notificationPath)) {
  let source = fs.readFileSync(notificationPath, "utf8");
  const before = source;
  source = source.replace(/w\.planned_end<date\('now'\)/g, "w.planned_end < CURRENT_DATE::text");
  if (source !== before) {
    fs.writeFileSync(notificationPath, source, "utf8");
    changed.push("app/api/notifications/notification-service.ts");
  }
}

console.log(`Node/PostgreSQL compatibility patch complete: ${changed.length} file(s) changed.`);
for (const file of [...new Set(changed)]) console.log(`  ${file}`);
