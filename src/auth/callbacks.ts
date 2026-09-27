import type { GitHubProfile } from "@/db/users";

type Token = Record<string, unknown> & { userId?: string; login?: string; githubAccessToken?: string };
type AccountLike = { provider: string; access_token?: string } & Record<string, unknown>;
type ProfileLike = Record<string, unknown> & { id?: unknown; login?: unknown; name?: unknown; avatar_url?: unknown };
type SessionLike = { user?: { name?: string | null; email?: string | null; image?: string | null }; expires: string };

export async function jwtCallback(
  params: { token: Token; account?: AccountLike | null; profile?: ProfileLike },
  deps: { upsert: (p: GitHubProfile) => Promise<{ id: string; login: string }> },
): Promise<Token> {
  const { token, account, profile } = params;
  if (account?.provider !== "github" || !profile) return token;
  const user = await deps.upsert({
    githubId: Number(profile.id),
    login: String(profile.login),
    name: typeof profile.name === "string" ? profile.name : null,
    avatarUrl: typeof profile.avatar_url === "string" ? profile.avatar_url : null,
  });
  return { ...token, userId: user.id, login: user.login, githubAccessToken: account.access_token };
}

export function sessionCallback(params: { session: SessionLike; token: Token }) {
  const { session, token } = params;
  return {
    expires: session.expires,
    user: {
      name: session.user?.name ?? null,
      image: session.user?.image ?? null,
      email: session.user?.email ?? null,
      id: String(token.userId ?? ""),
      login: String(token.login ?? ""),
    },
  };
}
