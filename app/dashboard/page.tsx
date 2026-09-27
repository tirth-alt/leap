import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { GitHubCheck } from "@/components/GitHubCheck";
import { SiteHeader } from "@/components/SiteHeader";
import { Card } from "@/components/ui/Card";
import { db } from "@/db/client";
import { freeAnalysesLeft, getUserById } from "@/db/users";

export default async function Dashboard() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const user = await getUserById(db(), (session.user as { id: string }).id);
  if (!user) redirect("/");

  return (
    <>
      <SiteHeader />
      <main className="shell" style={{ padding: "32px 16px", display: "grid", gap: 24 }}>
        <h2 className="dot">Hi, {user.name ?? user.login}</h2>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          <Card tone="green">
            <h3>Free analyses left</h3>
            <p style={{ font: "600 3rem/1.1 var(--font-display)", margin: "8px 0 0" }}>{freeAnalysesLeft(user)}</p>
            <p className="muted" style={{ margin: 0 }}>Runs on NVIDIA Nemotron 3. Add your own key later for unlimited runs.</p>
          </Card>
          <Card>
            <h3>Your GitHub</h3>
            <p className="muted">@{user.login}. Leap reads public repos only.</p>
            <GitHubCheck />
          </Card>
        </div>
      </main>
    </>
  );
}
