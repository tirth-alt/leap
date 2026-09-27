import { eq } from "drizzle-orm";
import type { DB } from "./client";
import { users, type User } from "./schema";

export const FREE_ANALYSES = 3;

export type GitHubProfile = { githubId: number; login: string; name: string | null; avatarUrl: string | null };

export async function upsertGitHubUser(database: DB, p: GitHubProfile): Promise<User> {
  const [row] = await database
    .insert(users)
    .values(p)
    .onConflictDoUpdate({ target: users.githubId, set: { login: p.login, name: p.name, avatarUrl: p.avatarUrl } })
    .returning();
  return row;
}

export async function getUserById(database: DB, id: string): Promise<User | null> {
  const [row] = await database.select().from(users).where(eq(users.id, id));
  return row ?? null;
}

export function freeAnalysesLeft(u: { freeAnalysesUsed: number }): number {
  return Math.max(0, FREE_ANALYSES - u.freeAnalysesUsed);
}
