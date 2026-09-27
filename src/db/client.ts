import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

export function createDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is not set");
  return drizzle({ client: new Pool({ connectionString: url }) });
}

export type DB = ReturnType<typeof createDb>;

let instance: DB | undefined;

export function db(): DB {
  instance ??= createDb();
  return instance;
}
