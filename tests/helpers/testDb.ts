import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { DB } from "@/db/client";

export async function testDb(): Promise<DB> {
  const database = drizzle({ client: new PGlite() });
  await migrate(database, { migrationsFolder: "drizzle" });
  return database as unknown as DB;
}
