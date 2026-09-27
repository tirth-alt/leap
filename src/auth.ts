import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { jwtCallback, sessionCallback } from "@/auth/callbacks";
import { db } from "@/db/client";
import { upsertGitHubUser } from "@/db/users";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub({ authorization: { params: { scope: "read:user" } } })],
  session: { strategy: "jwt" },
  callbacks: {
    jwt: (params) => jwtCallback(params as Parameters<typeof jwtCallback>[0], { upsert: (p) => upsertGitHubUser(db(), p) }) as never,
    session: (params) => sessionCallback(params as unknown as Parameters<typeof sessionCallback>[0]) as never,
  },
});
