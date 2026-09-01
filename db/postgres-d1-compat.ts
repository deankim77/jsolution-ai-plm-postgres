import type { Pool } from "pg";
import { getDbPool } from "./index";

export type LegacyD1Statement = {
  bind: (...values: unknown[]) => LegacyD1Statement;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  run: () => Promise<{ success: boolean; meta: { changes: number } }>;
};

export type LegacyD1Compat = {
  prepare: (sql: string) => LegacyD1Statement;
  batch: (statements: LegacyD1Statement[]) => Promise<unknown[]>;
};

function replaceQuestionPlaceholders(sql: string) {
  let index = 0;
  let quote: "'" | '"' | null = null;
  let out = "";
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    if (quote) {
      out += ch;
      if (ch === quote && sql[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === "?") {
      index += 1;
      out += `$${index}`;
      continue;
    }
    out += ch;
  }
  return out;
}

function translateSql(input: string) {
  let sql = input.trim();

  const pragma = sql.match(/^PRAGMA\s+table_info\(([^)]+)\)\s*;?$/i);
  if (pragma) {
    const table = pragma[1].trim().replace(/["'`]/g, "");
    if (!/^[A-Za-z0-9_]+$/.test(table)) throw new Error(`Unsafe PRAGMA table name: ${table}`);
    return `SELECT column_name AS name, data_type AS type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}' ORDER BY ordinal_position`;
  }

  sql = sql.replace(
    /FROM\s+sqlite_master\s+WHERE\s+type\s*=\s*'table'\s+AND\s+name\s+IN\s*\(([^)]+)\)/gi,
    "FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name IN ($1)"
  );

  if (/information_schema\.tables/i.test(sql) && /table_name\s+IN\s*\(\$1\)/i.test(sql)) {
    const originalIn = input.match(/name\s+IN\s*\(([^)]+)\)/i)?.[1] ?? "?";
    const count = (originalIn.match(/\?/g) ?? []).length || 1;
    sql = sql.replace(/table_name\s+IN\s*\(\$1\)/i, `table_name IN (${Array.from({ length: count }, (_, i) => `$${i + 1}`).join(",")})`);
  } else {
    sql = replaceQuestionPlaceholders(sql);
  }

  if (/^INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(sql)) {
    sql = sql.replace(/^INSERT\s+OR\s+IGNORE\s+INTO\b/i, "INSERT INTO");
    if (!/\bON\s+CONFLICT\b/i.test(sql)) sql = `${sql.replace(/;\s*$/, "")} ON CONFLICT DO NOTHING`;
  }

  sql = sql.replace(/json_extract\(([^,]+),\s*'\$\.([A-Za-z0-9_]+)'\)/gi, "($1::jsonb ->> '$2')");
  return sql;
}

class Statement implements LegacyD1Statement {
  private values: unknown[] = [];

  constructor(private pool: Pool, private sourceSql: string) {}

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async all<T = Record<string, unknown>>() {
    const result = await this.pool.query(translateSql(this.sourceSql), this.values);
    return { results: result.rows as T[] };
  }

  async first<T = Record<string, unknown>>() {
    const result = await this.pool.query(translateSql(this.sourceSql), this.values);
    return (result.rows[0] as T | undefined) ?? null;
  }

  async run() {
    const result = await this.pool.query(translateSql(this.sourceSql), this.values);
    return { success: true, meta: { changes: result.rowCount ?? 0 } };
  }
}

const globalForCompat = globalThis as typeof globalThis & {
  __aiPlmLegacyDbCompat?: LegacyD1Compat;
};

function createLegacyDbCompat(): LegacyD1Compat {
  const pool = getDbPool();
  return {
    prepare(sql: string) {
      return new Statement(pool, sql);
    },
    async batch(statements: LegacyD1Statement[]) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const results = [];
        for (const statement of statements) {
          if (!(statement instanceof Statement)) throw new Error("Unsupported legacy statement implementation");
          const privateStatement = statement as Statement & { sourceSql: string; values: unknown[] };
          const result = await client.query(translateSql(privateStatement.sourceSql), privateStatement.values);
          results.push({ success: true, meta: { changes: result.rowCount ?? 0 }, results: result.rows });
        }
        await client.query("COMMIT");
        return results;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

export function getLegacyDbCompat(): LegacyD1Compat {
  if (!globalForCompat.__aiPlmLegacyDbCompat) {
    globalForCompat.__aiPlmLegacyDbCompat = createLegacyDbCompat();
  }
  return globalForCompat.__aiPlmLegacyDbCompat;
}
