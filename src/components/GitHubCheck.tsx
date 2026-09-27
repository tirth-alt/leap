"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

type Me = { login: string; freeLeft: number; github: { remaining: number; limit: number } | null };

export function GitHubCheck() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [me, setMe] = useState<Me | null>(null);

  async function check() {
    setState("loading");
    try {
      const res = await fetch("/api/me");
      if (!res.ok) throw new Error(String(res.status));
      setMe((await res.json()) as Me);
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
      <Button variant="outline" onClick={check} disabled={state === "loading"}>
        {state === "loading" ? "Checking…" : "Check GitHub connection"}
      </Button>
      {state === "done" && me && (
        <p className="muted" style={{ margin: 0 }}>
          {me.github
            ? `Connected as @${me.login}. GitHub API: ${me.github.remaining}/${me.github.limit} requests left this hour.`
            : "Signed in, but the GitHub token could not be read. Sign out and back in."}
        </p>
      )}
      {state === "error" && <p role="alert" style={{ margin: 0, color: "var(--coral)" }}>Check failed. Try signing in again.</p>}
    </div>
  );
}
