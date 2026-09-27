import { beforeEach, describe, expect, it } from "vitest";
import type { DB } from "@/db/client";
import { freeAnalysesLeft, getUserById, upsertGitHubUser } from "@/db/users";
import { testDb } from "../helpers/testDb";

let database: DB;
beforeEach(async () => {
  database = await testDb();
});

describe("upsertGitHubUser", () => {
  it("creates a user on first sign-in", async () => {
    const u = await upsertGitHubUser(database, { githubId: 42, login: "octo", name: "Octo Cat", avatarUrl: null });
    expect(u).toMatchObject({ githubId: 42, login: "octo", freeAnalysesUsed: 0 });
    expect(await getUserById(database, u.id)).toMatchObject({ login: "octo" });
  });

  it("updates profile fields on later sign-ins but keeps the same id and quota", async () => {
    const first = await upsertGitHubUser(database, { githubId: 42, login: "octo", name: null, avatarUrl: null });
    const second = await upsertGitHubUser(database, { githubId: 42, login: "octo-renamed", name: "O", avatarUrl: "https://x/y.png" });
    expect(second.id).toBe(first.id);
    expect(second).toMatchObject({ login: "octo-renamed", name: "O", avatarUrl: "https://x/y.png", freeAnalysesUsed: 0 });
  });

  it("returns null for an unknown id", async () => {
    expect(await getUserById(database, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});

describe("freeAnalysesLeft", () => {
  it("counts down from 3 and never goes negative", () => {
    expect(freeAnalysesLeft({ freeAnalysesUsed: 0 })).toBe(3);
    expect(freeAnalysesLeft({ freeAnalysesUsed: 2 })).toBe(1);
    expect(freeAnalysesLeft({ freeAnalysesUsed: 7 })).toBe(0);
  });
});
