import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

export function createDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString: url, idleTimeoutMillis: 10_000 });
  pool.on("error", (e: Error) => console.error("pg pool error:", e.message));
  return drizzle({ client: pool });
}

export type DB = ReturnType<typeof createDb>;

let instance: DB | undefined;

export function db(): DB {
  instance ??= createDb();
  return instance;
}
