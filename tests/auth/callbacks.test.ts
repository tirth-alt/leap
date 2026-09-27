import { describe, expect, it, vi } from "vitest";
import { jwtCallback, sessionCallback } from "@/auth/callbacks";

const fakeUser = { id: "u-1", githubId: 42, login: "octo", name: "Octo", avatarUrl: null, freeAnalysesUsed: 0, createdAt: new Date() };

describe("jwtCallback", () => {
  it("on GitHub sign-in, upserts the user and stores ids + the token in the JWT", async () => {
    const upsert = vi.fn(async () => fakeUser);
    const token = await jwtCallback(
      {
        token: { sub: "x" },
        account: { provider: "github", type: "oauth", providerAccountId: "42", access_token: "gho_secret" },
        profile: { id: 42, login: "octo", name: "Octo", avatar_url: "https://a/b.png" },
      },
      { upsert },
    );
    expect(upsert).toHaveBeenCalledWith({ githubId: 42, login: "octo", name: "Octo", avatarUrl: "https://a/b.png" });
    expect(token).toMatchObject({ userId: "u-1", login: "octo", githubAccessToken: "gho_secret" });
  });

  it("passes the token through unchanged on later requests", async () => {
    const upsert = vi.fn();
    const token = await jwtCallback({ token: { userId: "u-1", login: "octo", githubAccessToken: "t" }, account: null }, { upsert });
    expect(upsert).not.toHaveBeenCalled();
    expect(token).toEqual({ userId: "u-1", login: "octo", githubAccessToken: "t" });
  });
});

describe("sessionCallback", () => {
  it("exposes the user id and login but never the GitHub token", () => {
    const session = sessionCallback({
      session: { user: { name: "Octo", email: null, image: null }, expires: "2099-01-01" },
      token: { userId: "u-1", login: "octo", githubAccessToken: "gho_secret" },
    });
    expect(session.user).toMatchObject({ id: "u-1", login: "octo" });
    expect(JSON.stringify(session)).not.toContain("gho_secret");
  });
});
