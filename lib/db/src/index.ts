import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Prevent an idle-client error (for example, during a managed PostgreSQL
// restart) from becoming an unhandled EventEmitter error and taking down the
// API process. Individual queries still surface their own errors to callers.
pool.on("error", (error) => {
  const pgError = error as Error & { code?: string };
  console.error("[db] PostgreSQL pool client error", {
    code: pgError.code,
    message: error.message,
  });
});

export const db = drizzle(pool, { schema });

export * from "./schema";
