import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const globalForDb = globalThis as typeof globalThis & {
  __aiPlmPgPool?: Pool;
};

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to connect AI PLM to PostgreSQL.");
  }

  if (!globalForDb.__aiPlmPgPool) {
    globalForDb.__aiPlmPgPool = new Pool({
      connectionString,
      max: Number(process.env.DB_POOL_MAX ?? 10),
      idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30000),
      connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 5000),
    });
  }

  return globalForDb.__aiPlmPgPool;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}

export function getDbPool() {
  return getPool();
}
