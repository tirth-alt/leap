import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";

const SWATCHES = ["--cream", "--surface", "--green", "--green-soft", "--ink", "--muted", "--line", "--coral"];

export default function StyleGuide() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="shell" style={{ display: "grid", gap: 32, padding: "clamp(32px, 6vw, 64px) clamp(16px, 4vw, 32px)" }}>
      <h1 className="dot">Leap design system</h1>
      <h2>Heading two</h2>
      <p className="muted">Body text in Inter. Résumés are claims; GitHub is evidence.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {SWATCHES.map((v) => (
          <div key={v} style={{ width: 120 }}>
            <div style={{ height: 56, borderRadius: 14, background: `var(${v})`, border: "1px solid var(--line)" }} />
            <code style={{ fontSize: 12 }}>{v}</code>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <Button>Dark</Button>
        <Button variant="green">Green</Button>
        <Button variant="outline" arrow>Explore</Button>
        <Button arrow>Sign in with GitHub</Button>
        <Button disabled>Disabled</Button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Chip>Backend</Chip>
        <Chip tone="filled">System design</Chip>
        <Chip>Leadership</Chip>
      </div>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <Card><h3>Surface card</h3><p className="muted">Default container.</p></Card>
        <Card tone="green"><h3>Green card</h3><p>For highlighted content.</p></Card>
        <Card tone="cream"><h3>Cream card</h3><p className="muted">Subtle grouping.</p></Card>
      </div>
    </main>
  );
}
