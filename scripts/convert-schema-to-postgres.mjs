import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const schemaPath = path.join(root, "db", "schema.ts");

if (!fs.existsSync(schemaPath)) {
  console.error(`Schema not found: ${schemaPath}`);
  process.exit(1);
}

let source = fs.readFileSync(schemaPath, "utf8");

if (source.includes('from "drizzle-orm/pg-core"')) {
  console.log("db/schema.ts is already using drizzle-orm/pg-core. No conversion needed.");
  process.exit(0);
}

if (!source.includes('from "drizzle-orm/sqlite-core"')) {
  console.error("Expected a SQLite Drizzle schema, but drizzle-orm/sqlite-core was not found.");
  process.exit(1);
}

source = source.replace(
  /import\s*\{[^}]*\}\s*from\s*["']drizzle-orm\/sqlite-core["'];?/,
  'import { boolean, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";'
);

// Preserve the TypeScript behavior of the existing SQLite schema while using native PostgreSQL types.
source = source
  .replace(/\binteger\(([^,()]+),\s*\{\s*mode\s*:\s*["']timestamp["']\s*\}\)/g, 'timestamp($1, { withTimezone: true, mode: "date" })')
  .replace(/\binteger\(([^,()]+),\s*\{\s*mode\s*:\s*["']boolean["']\s*\}\)/g, 'boolean($1)')
  .replace(/\btext\(([^,()]+),\s*\{\s*mode\s*:\s*["']json["']\s*\}\)/g, 'jsonb($1)')
  .replace(/\bsqliteTable\b/g, "pgTable");

const leftovers = [
  ["drizzle-orm/sqlite-core", /drizzle-orm\/sqlite-core/],
  ["sqliteTable", /\bsqliteTable\b/],
  ["SQLite timestamp mode", /mode\s*:\s*["']timestamp["']/],
  ["SQLite boolean mode", /mode\s*:\s*["']boolean["']/],
  ["SQLite JSON text mode", /mode\s*:\s*["']json["']/],
];

const unresolved = leftovers.filter(([, re]) => re.test(source)).map(([name]) => name);
if (unresolved.length) {
  console.error(`PostgreSQL schema conversion stopped; unresolved SQLite constructs: ${unresolved.join(", ")}`);
  process.exit(1);
}

fs.writeFileSync(schemaPath, source, "utf8");
console.log("Converted db/schema.ts from Drizzle SQLite schema to Drizzle PostgreSQL schema.");
console.log("Next: run npm.cmd run check:contracts, then npm.cmd run db:generate with DATABASE_URL set.");
