import { SiteHeader } from "@/components/SiteHeader";
import { Chip } from "@/components/ui/Chip";

const PERSONAS = ["Student", "Early career", "Mid-level", "Senior → Staff / EM"];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="shell" style={{ padding: "64px 16px", display: "grid", gap: 24, maxWidth: 820 }}>
        <p className="muted" style={{ margin: 0, letterSpacing: "0.12em", textTransform: "uppercase", fontSize: 13 }}>Leap</p>
        <h1 className="dot">Résumés are claims. GitHub is evidence</h1>
        <p className="muted" style={{ fontSize: "1.15rem", maxWidth: "58ch", margin: 0 }}>
          Tell Leap your goal. It reads your résumé and the code you actually wrote, asks about what it can't see, and gives you
          an evidence-backed plan to get there.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {PERSONAS.map((p, i) => (
            <Chip key={p} tone={i === 1 ? "filled" : "outline"}>{p}</Chip>
          ))}
        </div>
      </main>
    </>
  );
}
