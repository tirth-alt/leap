import { getToken } from "next-auth/jwt";

export async function getGitHubToken(req: Request): Promise<string | null> {
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: new URL(req.url).protocol === "https:",
  });
  const value = token?.githubAccessToken;
  return typeof value === "string" ? value : null;
}
