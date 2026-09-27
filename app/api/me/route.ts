import { auth } from "@/auth";
import { getGitHubToken } from "@/auth/github-token";
import { db } from "@/db/client";
import { freeAnalysesLeft, getUserById } from "@/db/users";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const user = await getUserById(db(), (session.user as { id: string }).id);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const token = await getGitHubToken(req);
  let github: { remaining: number; limit: number } | null = null;
  if (token) {
    const res = await fetch("https://api.github.com/rate_limit", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    });
    if (res.ok) {
      const body = (await res.json()) as { rate: { remaining: number; limit: number } };
      github = { remaining: body.rate.remaining, limit: body.rate.limit };
    }
  }
  return Response.json({ login: user.login, freeLeft: freeAnalysesLeft(user), github });
}
