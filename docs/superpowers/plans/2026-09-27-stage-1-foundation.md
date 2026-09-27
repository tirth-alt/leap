# Stage 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployed walking skeleton. You sign in with GitHub on the live URL, see a dashboard backed by Postgres, and a smoke script gets schema-validated JSON back from NVIDIA Nemotron through the model layer (provider fallback + JSON repair).

**Architecture:** Next.js 16 App Router on Vercel. A framework-free core in `src/lib/` (the model layer). Database access sits in `src/db/`, with repository functions that take the `db` as a parameter, so tests can pass an in-memory PGlite database. Auth.js v5 handles GitHub OAuth with JWT sessions: the GitHub token stays inside the encrypted cookie and is read server-side with `getToken`.

**Tech Stack:** TypeScript (strict, ESM), Next.js 16, React 19, CSS Modules + CSS custom properties, `next/font` (Outfit + Inter), Auth.js v5 (`next-auth@beta`), Drizzle ORM (`@rc`) + Neon (`@neondatabase/serverless`), PGlite (tests), `openai` SDK (as a generic OpenAI-compatible client), zod v4, vitest, tsx, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-26-leap-design.md` (v2). **Roadmap:** `docs/superpowers/plans/2026-09-27-leap-roadmap.md`

## Global Constraints

- Node ≥ 22 (`"engines": { "node": ">=22" }`). CI runs Node 22.
- Import alias `@/*` → `src/*` in both tsconfig and the vitest config.
- Tests never touch the network or a real database. Use PGlite for the DB and fake providers/clients for everything else.
- Secrets live only in `.env.local` (gitignored) and Vercel env vars: `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `DATABASE_URL`, `NVIDIA_*`, `OPENROUTER_*`.
- The GitHub access token is never written to the database, never put in the client-visible session, and never logged.
- Callers use the model layer only through `LLM.structured({ task, tier, system, content, schema })`. They never import a provider.
- Design tokens:

  | Token | Light | Dark |
  |---|---|---|
  | `--cream` (background) | `#FBF6E4` | `#141512` |
  | `--green` | `#2FA24D` | `#5CC877` |
  | `--green-soft` | `#BFE6B5` | `#1F3A24` |
  | `--ink` (text / dark pills) | `#1C1C1A` | `#EDEBE3` |
  | `--coral` (illustrations only) | `#E8603C` | `#E8603C` |

- Fonts: Outfit for headings, Inter for body text.
- No photos, anywhere.
- Public repo `tirth-alt/leap`. Push at the end of each task group marked **Push**, and tag `stage-1` at the end.

## File Map (Stage 1)

```
leap/
  package.json, tsconfig.json, next.config.ts, vitest.config.ts, drizzle.config.ts
  .gitignore, .env.example, .github/workflows/ci.yml
  drizzle/                         # generated SQL migrations (committed)
  app/
    layout.tsx, globals.css, page.tsx
    dashboard/page.tsx
    dev/ui/page.tsx                # style guide (dev only)
    api/auth/[...nextauth]/route.ts
    api/me/route.ts
  src/
    auth.ts                        # Auth.js config + exported helpers
    auth/callbacks.ts              # pure jwt/session callbacks (unit-tested)
    auth/github-token.ts           # server-only read of the GitHub token from the JWT
    db/schema.ts, db/client.ts, db/users.ts
    lib/llm/types.ts, json.ts, structured.ts, openai-compat.ts, config.ts
    components/ui/Button.tsx, Button.module.css, Card.tsx, Card.module.css, Chip.tsx, Chip.module.css
    components/SiteHeader.tsx, SiteHeader.module.css, GitHubCheck.tsx
  scripts/llm-smoke.ts
  tests/helpers/testDb.ts, tests/**/*.test.ts
  docs/learn/README.md, decisions.md, stage-1.md
```

---

### Task 1: Scaffold, tooling, CI, first push

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.gitignore`, `.env.example`, `.github/workflows/ci.yml`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `tests/smoke.test.ts`

**Interfaces:**
- Produces: `npm run dev | build | test | typecheck | llm:smoke | db:generate | db:migrate`

- [ ] **Step 1: Initialise the project**

`leap/` already contains `docs/`, so we don't use `create-next-app` (it refuses non-empty folders).

```bash
cd /Users/apple/Desktop/idea/leap
git init -b main
npm init -y
npm pkg set type=module engines.node=">=22"
npm pkg set scripts.dev="next dev" scripts.build="next build" scripts.start="next start" \
  scripts.test="vitest run" scripts.typecheck="tsc --noEmit" \
  scripts.llm:smoke="tsx scripts/llm-smoke.ts" \
  scripts.db:generate="drizzle-kit generate" scripts.db:migrate="drizzle-kit migrate"
npm i next@latest react@latest react-dom@latest next-auth@beta drizzle-orm@rc @neondatabase/serverless openai zod
npm i -D typescript @types/node @types/react @types/react-dom vitest tsx drizzle-kit@rc @electric-sql/pglite dotenv
node -e "console.log(require('zod/package.json').version)"
```
The last command must print `4.x`. If it doesn't, run `npm i zod@^4`.

- [ ] **Step 2: Write the config files**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2023"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.ts`:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["tests/**/*.test.ts"], testTimeout: 20_000 },
});
```

`.gitignore`:
```
node_modules/
.next/
.vercel/
.env
.env*.local
*.tsbuildinfo
next-env.d.ts
```

`.env.example`:
```
# Auth.js — generate AUTH_SECRET with: npx auth secret
AUTH_SECRET=
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=

# Neon Postgres (use the dev branch locally)
DATABASE_URL=

# Free model providers (fill model ids from `npm run llm:smoke`)
NVIDIA_API_KEY=
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL_FAST=
NVIDIA_MODEL_DEEP=
NVIDIA_FAST_SYSTEM_PREFIX=
NVIDIA_DEEP_SYSTEM_PREFIX=
NVIDIA_JSON_SCHEMA=false

OPENROUTER_API_KEY=
OPENROUTER_MODEL_FAST=
OPENROUTER_MODEL_DEEP=
OPENROUTER_JSON_SCHEMA=false
```

`.github/workflows/ci.yml`:
```yaml
name: ci
on:
  push:
    branches: [main]
  pull_request:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
```

`app/layout.tsx` (replaced in Task 2):
```tsx
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`app/page.tsx` (replaced in Task 7):
```tsx
export default function Home() {
  return <main>Leap</main>;
}
```

`app/globals.css` (replaced in Task 2):
```css
body { margin: 0; }
```

`tests/smoke.test.ts`:
```ts
import { expect, it } from "vitest";

it("runs the test toolchain", () => {
  expect([1, 2, 3].map((n) => n * 2)).toEqual([2, 4, 6]);
});
```

- [ ] **Step 3: Verify the toolchain**

Run: `npm test && npm run typecheck && npx next build`
Expected: 1 test passes, tsc prints nothing, and the Next build succeeds. It may rewrite a few tsconfig fields; keep what it writes.

- [ ] **Step 4: First commit and create the public repo**

```bash
git add -A
git status
git commit -m "chore: scaffold Next.js + TypeScript + vitest + CI"
gh repo create tirth-alt/leap --public --source . --remote origin --description "Résumés are claims. GitHub is evidence." --push
```
Before committing, check `git status` and make sure no `.env*` file is staged.
Expected: the repo exists on GitHub, and the CI run on the Actions tab goes green.

---

### Task 2: Design system (tokens, fonts, UI primitives, style guide)

**Files:**
- Create: `src/types/css-modules.d.ts`, `src/components/ui/Button.tsx`, `Button.module.css`, `Card.tsx`, `Card.module.css`, `Chip.tsx`, `Chip.module.css`, `app/dev/ui/page.tsx`
- Modify: `app/layout.tsx`, `app/globals.css` (full replace)

**Interfaces:**
- Produces: `<Button variant="dark" | "green" | "outline" arrow? ...buttonProps>`, `<ButtonLink href variant arrow?>`, `<Card tone="cream" | "green" | "surface">`, `<Chip tone="outline" | "filled">`. CSS variables `--cream --green --green-soft --ink --coral --muted --line --surface --radius-lg --radius-pill --font-display --font-body`.

Before writing CSS, invoke the `frontend-design:frontend-design` skill for this task. Keep the tokens, class names and component APIs exactly as written below. Use the skill only to refine spacing, type scale and hover/focus polish.

- [ ] **Step 1: Fonts and layout**

`app/layout.tsx`:
```tsx
import "./globals.css";
import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import type { ReactNode } from "react";

const display = Outfit({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "Leap: evidence-backed career guide",
  description: "Résumés are claims. GitHub is evidence.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Global tokens**

`app/globals.css`:
```css
:root {
  --cream: #fbf6e4;
  --surface: #fffdf5;
  --green: #2fa24d;
  --green-ink: #1f7a37;
  --green-soft: #bfe6b5;
  --ink: #1c1c1a;
  --muted: #5f5e57;
  --line: #e7e0c6;
  --coral: #e8603c;
  --radius-lg: 24px;
  --radius-md: 14px;
  --radius-pill: 999px;
  --shadow: 0 1px 2px rgb(28 28 26 / 0.06), 0 8px 24px rgb(28 28 26 / 0.06);
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root {
    --cream: #141512;
    --surface: #1c1e1a;
    --green: #5cc877;
    --green-ink: #8ee0a2;
    --green-soft: #1f3a24;
    --ink: #edebe3;
    --muted: #a6a498;
    --line: #2d2f29;
    --shadow: 0 1px 2px rgb(0 0 0 / 0.3), 0 8px 24px rgb(0 0 0 / 0.25);
    color-scheme: dark;
  }
}
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--cream);
  color: var(--ink);
  font: 16px/1.6 var(--font-body), system-ui, sans-serif;
}
h1, h2, h3 { font-family: var(--font-display), system-ui, sans-serif; letter-spacing: -0.02em; line-height: 1.1; margin: 0; }
h1 { font-size: clamp(2.2rem, 6vw, 4rem); font-weight: 500; }
h2 { font-size: clamp(1.6rem, 4vw, 2.4rem); font-weight: 500; }
h3 { font-size: 1.15rem; font-weight: 600; }
a { color: var(--green-ink); }
:focus-visible { outline: 3px solid var(--green); outline-offset: 2px; }
.dot::after { content: "."; color: var(--green); }
.muted { color: var(--muted); }
.shell { max-width: 1120px; margin: 0 auto; padding: 0 16px; }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
```

- [ ] **Step 3: UI primitives**

`src/types/css-modules.d.ts`:
```ts
declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}
```

Next normally supplies this type through `next-env.d.ts`, but we gitignore that file. Without this declaration, `npm run typecheck` would fail in CI on every `.module.css` import.

`src/components/ui/Button.tsx`:
```tsx
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

type Variant = "dark" | "green" | "outline";

function classes(variant: Variant, extra?: string) {
  return [styles.button, styles[variant], extra].filter(Boolean).join(" ");
}

function Arrow() {
  return (
    <span className={styles.arrow} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  );
}

export function Button({
  variant = "dark",
  arrow = false,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; arrow?: boolean }) {
  return (
    <button className={classes(variant, className)} {...rest}>
      <span>{children}</span>
      {arrow && <Arrow />}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "dark",
  arrow = false,
  children,
}: { href: string; variant?: Variant; arrow?: boolean; children: ReactNode }) {
  return (
    <Link href={href} className={classes(variant)}>
      <span>{children}</span>
      {arrow && <Arrow />}
    </Link>
  );
}
```

`src/components/ui/Button.module.css`:
```css
.button {
  display: inline-flex; align-items: center; gap: 10px;
  font: 600 15px/1 var(--font-body), system-ui, sans-serif;
  padding: 12px 20px; border-radius: var(--radius-pill);
  border: 1.5px solid transparent; cursor: pointer; text-decoration: none;
  transition: transform 120ms ease, background-color 120ms ease;
}
.button:hover { transform: translateY(-1px); }
.button:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
.dark { background: var(--ink); color: var(--cream); }
.green { background: var(--green); color: #fff; }
.outline { background: transparent; color: var(--ink); border-color: var(--ink); }
.arrow {
  display: inline-grid; place-items: center; width: 28px; height: 28px; margin-right: -10px;
  border-radius: 50%; background: var(--cream); color: var(--ink);
}
.outline .arrow { background: var(--ink); color: var(--cream); }
```

`src/components/ui/Card.tsx`:
```tsx
import type { HTMLAttributes } from "react";
import styles from "./Card.module.css";

export function Card({
  tone = "surface",
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { tone?: "surface" | "cream" | "green" }) {
  return <div className={[styles.card, styles[tone], className].filter(Boolean).join(" ")} {...rest} />;
}
```

`src/components/ui/Card.module.css`:
```css
.card { border-radius: var(--radius-lg); padding: 24px; box-shadow: var(--shadow); border: 1px solid var(--line); }
.surface { background: var(--surface); }
.cream { background: var(--cream); }
.green { background: var(--green-soft); border-color: transparent; }
```

`src/components/ui/Chip.tsx`:
```tsx
import type { HTMLAttributes } from "react";
import styles from "./Chip.module.css";

export function Chip({
  tone = "outline",
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: "outline" | "filled" }) {
  return <span className={[styles.chip, styles[tone], className].filter(Boolean).join(" ")} {...rest} />;
}
```

`src/components/ui/Chip.module.css`:
```css
.chip {
  display: inline-flex; align-items: center; padding: 8px 16px; border-radius: var(--radius-pill);
  font: 500 13px/1 var(--font-body), system-ui, sans-serif; letter-spacing: 0.04em; text-transform: uppercase;
}
.outline { border: 1.5px solid var(--green); color: var(--green-ink); background: transparent; }
.filled { background: var(--green); color: #fff; border: 1.5px solid var(--green); }
```

- [ ] **Step 4: Style guide page (dev only)**

`app/dev/ui/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";

const SWATCHES = ["--cream", "--surface", "--green", "--green-soft", "--ink", "--muted", "--line", "--coral"];

export default function StyleGuide() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="shell" style={{ display: "grid", gap: 32, padding: "48px 16px" }}>
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
```

- [ ] **Step 5: Verify in the browser**

Run: `npm run dev` and open `http://localhost:3000/dev/ui`.
Expected: the Outfit headings render with a green trailing dot, all 8 swatches show, the buttons have pill shapes (the arrow ones show a circular arrow), the chips show outline and filled styles, and the three card tones render. Check it at 375px width (DevTools device mode) and with the OS in dark mode.

- [ ] **Step 6: Commit**

```bash
git add app src/components src/types
git commit -m "feat: design tokens, fonts and UI primitives with a dev style guide"
```

---

### Task 3: Database schema, client, test DB, users repository

**Files:**
- Create: `src/db/schema.ts`, `src/db/client.ts`, `src/db/users.ts`, `drizzle.config.ts`, `tests/helpers/testDb.ts`
- Generated: `drizzle/*.sql` (committed)
- Test: `tests/db/users.test.ts`

**Interfaces:**
- Produces: tables `users, resumes, userFacts, repoScan, evidence, analyses, quizAttempts`; `createDb(url?: string): DB`; `db(): DB` (lazy singleton); `type DB`; `FREE_ANALYSES = 3`; `type GitHubProfile = { githubId: number; login: string; name: string | null; avatarUrl: string | null }`; `upsertGitHubUser(db: DB, p: GitHubProfile): Promise<User>`; `getUserById(db: DB, id: string): Promise<User | null>`; `freeAnalysesLeft(u: { freeAnalysesUsed: number }): number`; `type User = typeof users.$inferSelect`; test helper `testDb(): Promise<DB>`

- [ ] **Step 1: Schema**

`src/db/schema.ts`:
```ts
import { sql } from "drizzle-orm";
import { bigint, boolean, integer, jsonb, pgTable, primaryKey, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const emptyArray = sql`'[]'::jsonb`;

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubId: bigint("github_id", { mode: "number" }).notNull().unique(),
  login: text("login").notNull(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  freeAnalysesUsed: integer("free_analyses_used").notNull().default(0),
  createdAt: createdAt(),
});

export const resumes = pgTable("resumes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  source: text("source", { enum: ["pdf", "paste", "sample"] }).notNull(),
  createdAt: createdAt(),
});

export const analyses = pgTable("analyses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  goal: text("goal").notNull(),
  jdText: text("jd_text"),
  resumeId: uuid("resume_id").references(() => resumes.id, { onDelete: "set null" }),
  status: text("status", { enum: ["clarifying", "scanning", "building", "ready", "failed"] }).notNull().default("clarifying"),
  tier: text("tier", { enum: ["free", "byok"] }).notNull().default("free"),
  questions: jsonb("questions").$type<unknown>(),
  report: jsonb("report").$type<unknown>(),
  usage: jsonb("usage").$type<unknown>(),
  provider: text("provider"),
  createdAt: createdAt(),
});

export const userFacts = pgTable("user_facts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  skills: jsonb("skills").$type<string[]>().notNull().default(emptyArray),
  kind: text("kind", { enum: ["experience", "preference", "context"] }).notNull(),
  analysisId: uuid("analysis_id").references(() => analyses.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const repoScan = pgTable(
  "repo_scan",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    repo: text("repo").notNull(),
    pushedAt: timestamp("pushed_at", { withTimezone: true }),
    lastCommitSha: text("last_commit_sha"),
    lastScannedAt: timestamp("last_scanned_at", { withTimezone: true }),
    authorShare: real("author_share").notNull().default(0),
    languages: jsonb("languages").$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
    frameworks: jsonb("frameworks").$type<string[]>().notNull().default(emptyArray),
    status: text("status", { enum: ["active", "stale"] }).notNull().default("active"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.repo] })],
);

export const evidence = pgTable(
  "evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    repo: text("repo").notNull(),
    path: text("path").notNull(),
    additions: integer("additions").notNull().default(0),
    deletions: integer("deletions").notNull().default(0),
    commits: integer("commits").notNull().default(0),
    newestSha: text("newest_sha").notNull(),
    url: text("url").notNull(),
    substantive: real("substantive"),
    relevance: integer("relevance"),
    summary: text("summary"),
    skills: jsonb("skills").$type<string[]>().notNull().default(emptyArray),
    stale: boolean("stale").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("evidence_user_repo_path").on(t.userId, t.repo, t.path)],
);

export const quizAttempts = pgTable("quiz_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  analysisId: uuid("analysis_id").notNull().references(() => analyses.id, { onDelete: "cascade" }),
  difficulty: text("difficulty", { enum: ["easy", "medium", "hard"] }).notNull(),
  skills: jsonb("skills").$type<string[]>().notNull().default(emptyArray),
  questions: jsonb("questions").$type<unknown>(),
  answers: jsonb("answers").$type<unknown[]>().notNull().default(emptyArray),
  grades: jsonb("grades").$type<unknown[]>().notNull().default(emptyArray),
  status: text("status", { enum: ["preparing", "ready", "started", "finished"] }).notNull().default("preparing"),
  createdAt: createdAt(),
});

export type User = typeof users.$inferSelect;
```

The `unknown` JSON columns get real types in the stages that fill them (report in Stage 4, quiz in Stage 5).

- [ ] **Step 2: Client and Drizzle config**

`src/db/client.ts`:
```ts
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

export function createDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is not set");
  return drizzle({ client: new Pool({ connectionString: url }), schema });
}

export type DB = ReturnType<typeof createDb>;

let instance: DB | undefined;

export function db(): DB {
  instance ??= createDb();
  return instance;
}
```

`drizzle.config.ts`:
```ts
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- [ ] **Step 3: Generate the first migration**

Run: `npm run db:generate`
Expected: a new `drizzle/0000_*.sql` file that creates all 7 tables. Open it and check that each table appears. Generating needs no database connection.

- [ ] **Step 4: Test DB helper**

`tests/helpers/testDb.ts`:
```ts
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { DB } from "@/db/client";
import * as schema from "@/db/schema";

export async function testDb(): Promise<DB> {
  const database = drizzle({ client: new PGlite(), schema });
  await migrate(database, { migrationsFolder: "drizzle" });
  return database as unknown as DB;
}
```

The cast exists because production uses the Neon driver and tests use the PGlite driver. Both expose the same query-builder API, but their TypeScript types differ.

- [ ] **Step 5: Write the failing users test**

`tests/db/users.test.ts`:
```ts
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
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run tests/db`
Expected: FAIL, cannot resolve `@/db/users`

- [ ] **Step 7: Implement the users repository**

`src/db/users.ts`:
```ts
import { eq } from "drizzle-orm";
import type { DB } from "./client";
import { users, type User } from "./schema";

export const FREE_ANALYSES = 3;

export type GitHubProfile = { githubId: number; login: string; name: string | null; avatarUrl: string | null };

export async function upsertGitHubUser(database: DB, p: GitHubProfile): Promise<User> {
  const [row] = await database
    .insert(users)
    .values(p)
    .onConflictDoUpdate({ target: users.githubId, set: { login: p.login, name: p.name, avatarUrl: p.avatarUrl } })
    .returning();
  return row;
}

export async function getUserById(database: DB, id: string): Promise<User | null> {
  const [row] = await database.select().from(users).where(eq(users.id, id));
  return row ?? null;
}

export function freeAnalysesLeft(u: { freeAnalysesUsed: number }): number {
  return Math.max(0, FREE_ANALYSES - u.freeAnalysesUsed);
}
```

- [ ] **Step 8: Run the tests and typecheck**

Run: `npx vitest run tests/db && npm run typecheck`
Expected: 4 tests pass. If the Drizzle RC rejects the `schema` option in `drizzle({ client, schema })` with a type error, remove `schema` from both `createDb` and `testDb`. The query-builder calls used here don't need it.

- [ ] **Step 9: Commit**

```bash
git add src/db drizzle drizzle.config.ts tests/helpers tests/db
git commit -m "feat: Postgres schema for all v2 tables, Neon client, PGlite-tested users repo"
```

---

### Task 4: GitHub login (Auth.js v5, JWT sessions, token kept server-side)

**Files:**
- Create: `src/auth.ts`, `src/auth/callbacks.ts`, `src/auth/github-token.ts`, `app/api/auth/[...nextauth]/route.ts`, `app/api/me/route.ts`
- Test: `tests/auth/callbacks.test.ts`

**Interfaces:**
- Consumes: `upsertGitHubUser`, `db`, `getUserById`, `freeAnalysesLeft` (Task 3)
- Produces: `handlers, auth, signIn, signOut` (from `@/auth`); `jwtCallback(params, deps): Promise<JWT>`; `sessionCallback(params): Session`; `getGitHubToken(req: Request): Promise<string | null>`; `GET /api/me` → `{ login, freeLeft, github: { remaining: number, limit: number } }`

- [ ] **Step 1: Write the failing callback tests**

`tests/auth/callbacks.test.ts`:
```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/auth`
Expected: FAIL, cannot resolve `@/auth/callbacks`

- [ ] **Step 3: Implement the callbacks**

`src/auth/callbacks.ts`:
```ts
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
```

`sessionCallback` builds a brand-new object instead of spreading the token. That is how the GitHub token is kept out of the session: the session is sent to the browser, the token is not.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/auth`
Expected: 3 PASS

- [ ] **Step 5: Wire up Auth.js**

`src/auth.ts`:
```ts
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { jwtCallback, sessionCallback } from "@/auth/callbacks";
import { db } from "@/db/client";
import { upsertGitHubUser } from "@/db/users";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  session: { strategy: "jwt" },
  callbacks: {
    jwt: (params) => jwtCallback(params as Parameters<typeof jwtCallback>[0], { upsert: (p) => upsertGitHubUser(db(), p) }) as never,
    session: (params) => sessionCallback(params as unknown as Parameters<typeof sessionCallback>[0]) as never,
  },
});
```

The casts join our small, testable callback types to Auth.js's much larger generic types. The behaviour lives in `callbacks.ts`, which is fully typed and unit-tested. The GitHub provider reads `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET` automatically.

`app/api/auth/[...nextauth]/route.ts`:
```ts
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

`src/auth/github-token.ts`:
```ts
import { getToken } from "next-auth/jwt";

export async function getGitHubToken(req: Request): Promise<string | null> {
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });
  const value = token?.githubAccessToken;
  return typeof value === "string" ? value : null;
}
```

`app/api/me/route.ts`:
```ts
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
```

`/api/me` proves the whole chain works: session → DB user → GitHub token read server-side → GitHub API. It never returns the token.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors. If `getToken` complains about the `req` type, pass `req: req as never`. At runtime the function only reads headers and cookies from the request.

- [ ] **Step 7: Commit**

```bash
git add src/auth.ts src/auth app/api tests/auth
git commit -m "feat: GitHub login with JWT sessions; token kept server-side; /api/me check"
```

---

### Task 5: Model layer core (JSON extraction, repair, provider fallback)

**Files:**
- Create: `src/lib/llm/types.ts`, `src/lib/llm/json.ts`, `src/lib/llm/structured.ts`
- Test: `tests/llm/json.test.ts`, `tests/llm/structured.test.ts`

**Interfaces:**
- Produces:
  - `type Tier = "fast" | "deep"`
  - `type ChatRequest = { tier: Tier; system: string; user: string; jsonSchema?: Record<string, unknown> }`
  - `type ChatResponse = { text: string; model: string; inputTokens: number; outputTokens: number }`
  - `interface Provider { name: string; complete(req: ChatRequest): Promise<ChatResponse> }`
  - `class ProviderError extends Error { provider: string; status: number | null; retryAfterMs?: number }`
  - `class AllProvidersFailedError extends Error { failures: { provider: string; reason: string }[] }`
  - `type StructuredRequest<S extends z.ZodType> = { task: string; tier: Tier; system: string; content: string; schema: S }`
  - `type CallRecord = { task: string; tier: Tier; provider: string; model: string; inputTokens: number; outputTokens: number; ms: number; repaired: boolean }`
  - `interface LLM { structured<S extends z.ZodType>(req: StructuredRequest<S>): Promise<z.infer<S>>; calls(): CallRecord[] }`
  - `extractJson(text: string): unknown`
  - `createLLM(providers: Provider[], opts?: { now?: () => number; sleep?: (ms: number) => Promise<void> }): LLM`

- [ ] **Step 1: Types**

`src/lib/llm/types.ts`:
```ts
import type { z } from "zod";

export type Tier = "fast" | "deep";

export type ChatRequest = { tier: Tier; system: string; user: string; jsonSchema?: Record<string, unknown> };
export type ChatResponse = { text: string; model: string; inputTokens: number; outputTokens: number };

export interface Provider {
  name: string;
  complete(req: ChatRequest): Promise<ChatResponse>;
}

export class ProviderError extends Error {
  constructor(
    public provider: string,
    public status: number | null,
    message: string,
    public retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export class AllProvidersFailedError extends Error {
  constructor(public failures: { provider: string; reason: string }[]) {
    super(`All model providers failed: ${failures.map((f) => `${f.provider} (${f.reason})`).join("; ")}`);
    this.name = "AllProvidersFailedError";
  }
}

export type StructuredRequest<S extends z.ZodType> = { task: string; tier: Tier; system: string; content: string; schema: S };

export type CallRecord = {
  task: string;
  tier: Tier;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  ms: number;
  repaired: boolean;
};

export interface LLM {
  structured<S extends z.ZodType>(req: StructuredRequest<S>): Promise<z.infer<S>>;
  calls(): CallRecord[];
}
```

- [ ] **Step 2: Write the failing JSON extraction tests**

`tests/llm/json.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { extractJson } from "@/lib/llm/json";

describe("extractJson", () => {
  it.each([
    ["plain", '{"a":1}', { a: 1 }],
    ["fenced", 'Here you go:\n```json\n{"a":1}\n```', { a: 1 }],
    ["think block", '<think>let me reason {not json}</think>\n{"a":1}', { a: 1 }],
    ["only a closing think tag", 'reasoning text }{ \n</think>{"a":1}', { a: 1 }],
    ["prose before and after", 'Sure! {"a":{"b":[1,2]}} Hope that helps.', { a: { b: [1, 2] } }],
    ["braces inside strings", '{"code":"if (x) { y(); }","q":"\\"}"}', { code: "if (x) { y(); }", q: '"}' }],
    ["top-level array", '[{"a":1}]', [{ a: 1 }]],
  ])("handles %s", (_name, input, expected) => {
    expect(extractJson(input)).toEqual(expected);
  });

  it("throws when there is no JSON", () => {
    expect(() => extractJson("I cannot help with that.")).toThrow("No JSON");
  });

  it("throws on truncated JSON", () => {
    expect(() => extractJson('{"a": [1, 2')).toThrow("Unterminated");
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run tests/llm/json.test.ts`
Expected: FAIL, module not found

- [ ] **Step 4: Implement extractJson**

`src/lib/llm/json.ts`:
```ts
export function extractJson(text: string): unknown {
  const close = text.lastIndexOf("</think>");
  const afterThinking = close >= 0 ? text.slice(close + "</think>".length) : text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  const cleaned = afterThinking.replace(/```(?:json)?/gi, "");

  const start = cleaned.search(/[{[]/);
  if (start < 0) throw new SyntaxError("No JSON found in model output");

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) return JSON.parse(cleaned.slice(start, i + 1));
    }
  }
  throw new SyntaxError("Unterminated JSON in model output");
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/llm/json.test.ts`
Expected: all PASS

- [ ] **Step 6: Write the failing structured/fallback tests**

`tests/llm/structured.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createLLM } from "@/lib/llm/structured";
import { AllProvidersFailedError, ProviderError, type ChatRequest, type Provider } from "@/lib/llm/types";

const schema = z.object({ sum: z.number() });
const req = { task: "add", tier: "fast" as const, system: "You add numbers.", content: "17+25", schema };

function scripted(name: string, replies: (string | Error)[]): Provider & { seen: ChatRequest[] } {
  const seen: ChatRequest[] = [];
  let i = 0;
  return {
    name,
    seen,
    async complete(r) {
      seen.push(r);
      const next = replies[i++];
      if (next === undefined) throw new Error(`${name}: no scripted reply`);
      if (next instanceof Error) throw next;
      return { text: next, model: `${name}-model`, inputTokens: 10, outputTokens: 5 };
    },
  };
}

describe("createLLM.structured", () => {
  it("returns validated output and records the call", async () => {
    const p = scripted("a", ['{"sum":42}']);
    const llm = createLLM([p]);
    expect(await llm.structured(req)).toEqual({ sum: 42 });
    expect(llm.calls()).toMatchObject([{ task: "add", tier: "fast", provider: "a", model: "a-model", repaired: false, inputTokens: 10, outputTokens: 5 }]);
    expect(p.seen[0].system).toContain("You add numbers.");
    expect(p.seen[0].system).toContain("<schema>");
    expect(p.seen[0].jsonSchema).toMatchObject({ type: "object" });
  });

  it("repairs once using the validation errors", async () => {
    const p = scripted("a", ['{"sum":"forty-two"}', '{"sum":42}']);
    const llm = createLLM([p]);
    expect(await llm.structured(req)).toEqual({ sum: 42 });
    expect(p.seen[1].user).toContain("<errors>");
    expect(p.seen[1].user).toContain("forty-two");
    expect(llm.calls()[0]).toMatchObject({ repaired: true, inputTokens: 20, outputTokens: 10 });
  });

  it("falls back to the next provider when repair also fails", async () => {
    const a = scripted("a", ["nope", "still nope"]);
    const b = scripted("b", ['{"sum":42}']);
    expect(await createLLM([a, b]).structured(req)).toEqual({ sum: 42 });
    expect(b.seen).toHaveLength(1);
  });

  it("falls back on server errors", async () => {
    const a = scripted("a", [new ProviderError("a", 503, "overloaded")]);
    const b = scripted("b", ['{"sum":42}']);
    expect(await createLLM([a, b]).structured(req)).toEqual({ sum: 42 });
  });

  it("waits once on a short 429 retry-after, then retries the same provider", async () => {
    const sleep = vi.fn(async () => {});
    const a = scripted("a", [new ProviderError("a", 429, "slow down", 50), '{"sum":42}']);
    expect(await createLLM([a], { sleep }).structured(req)).toEqual({ sum: 42 });
    expect(sleep).toHaveBeenCalledWith(50);
  });

  it("does not wait on a long retry-after; falls back instead", async () => {
    const sleep = vi.fn(async () => {});
    const a = scripted("a", [new ProviderError("a", 429, "slow down", 60_000)]);
    const b = scripted("b", ['{"sum":42}']);
    expect(await createLLM([a, b], { sleep }).structured(req)).toEqual({ sum: 42 });
    expect(sleep).not.toHaveBeenCalled();
  });

  it("throws AllProvidersFailedError with every reason", async () => {
    const a = scripted("a", [new ProviderError("a", 401, "bad key")]);
    const b = scripted("b", ["x", "y"]);
    const err = await createLLM([a, b]).structured(req).catch((e) => e);
    expect(err).toBeInstanceOf(AllProvidersFailedError);
    expect(err.failures.map((f: { provider: string }) => f.provider)).toEqual(["a", "b"]);
    expect(err.message).toContain("bad key");
  });

  it("refuses to start without providers", () => {
    expect(() => createLLM([])).toThrow("No model providers");
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npx vitest run tests/llm/structured.test.ts`
Expected: FAIL, module not found

- [ ] **Step 8: Implement createLLM**

`src/lib/llm/structured.ts`:
```ts
import { z } from "zod";
import { extractJson } from "./json";
import {
  AllProvidersFailedError,
  ProviderError,
  type CallRecord,
  type ChatResponse,
  type LLM,
  type Provider,
  type StructuredRequest,
} from "./types";

const MAX_RETRY_WAIT_MS = 10_000;

class InvalidOutputError extends Error {}

function schemaInstruction(jsonSchema: Record<string, unknown>): string {
  return [
    "Respond with only a JSON value that matches this JSON Schema. No prose and no code fences.",
    "<schema>",
    JSON.stringify(jsonSchema),
    "</schema>",
  ].join("\n");
}

function repairPrompt(content: string, previous: string, errors: string): string {
  return [
    "Your previous reply did not match the required JSON Schema.",
    `<previous_reply>\n${previous}\n</previous_reply>`,
    `<errors>\n${errors}\n</errors>`,
    "Return a corrected JSON value only. The original input follows.",
    content,
  ].join("\n\n");
}

function tryParse<S extends z.ZodType>(schema: S, text: string): { ok: true; value: z.infer<S> } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = extractJson(text);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const result = schema.safeParse(raw);
  return result.success ? { ok: true, value: result.data } : { ok: false, error: z.prettifyError(result.error) };
}

export function createLLM(
  providers: Provider[],
  opts: { now?: () => number; sleep?: (ms: number) => Promise<void> } = {},
): LLM {
  if (providers.length === 0) throw new Error("No model providers configured");
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const calls: CallRecord[] = [];

  async function attempt<S extends z.ZodType>(p: Provider, req: StructuredRequest<S>, jsonSchema: Record<string, unknown>) {
    const system = `${req.system}\n\n${schemaInstruction(jsonSchema)}`;
    const started = now();
    const replies: ChatResponse[] = [await p.complete({ tier: req.tier, system, user: req.content, jsonSchema })];
    let parsed = tryParse(req.schema, replies[0].text);
    if (!parsed.ok) {
      replies.push(await p.complete({ tier: req.tier, system, user: repairPrompt(req.content, replies[0].text, parsed.error), jsonSchema }));
      parsed = tryParse(req.schema, replies[1].text);
    }
    calls.push({
      task: req.task,
      tier: req.tier,
      provider: p.name,
      model: replies[0].model,
      inputTokens: replies.reduce((a, r) => a + r.inputTokens, 0),
      outputTokens: replies.reduce((a, r) => a + r.outputTokens, 0),
      ms: now() - started,
      repaired: replies.length > 1,
    });
    if (!parsed.ok) throw new InvalidOutputError(`invalid output after repair: ${parsed.error.slice(0, 200)}`);
    return parsed.value;
  }

  return {
    async structured<S extends z.ZodType>(req: StructuredRequest<S>): Promise<z.infer<S>> {
      const jsonSchema = z.toJSONSchema(req.schema) as Record<string, unknown>;
      const failures: { provider: string; reason: string }[] = [];
      for (const p of providers) {
        for (let tryNo = 0; tryNo < 2; tryNo++) {
          try {
            return await attempt(p, req, jsonSchema);
          } catch (e) {
            const shortWait =
              e instanceof ProviderError && e.status === 429 && e.retryAfterMs !== undefined && e.retryAfterMs <= MAX_RETRY_WAIT_MS;
            if (shortWait && tryNo === 0) {
              await sleep(e.retryAfterMs!);
              continue;
            }
            const status = e instanceof ProviderError && e.status !== null ? `${e.status} ` : "";
            failures.push({ provider: p.name, reason: `${status}${(e as Error).message}` });
            break;
          }
        }
      }
      throw new AllProvidersFailedError(failures);
    },
    calls: () => [...calls],
  };
}
```

Why every error falls through to the next provider, including 401: on the free chain, keeping the demo alive matters more than failing loudly. The reason is still recorded, and for a bring-your-own-key run with a single provider the error message says "401 …".

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx vitest run tests/llm && npm run typecheck`
Expected: all PASS

- [ ] **Step 10: Commit**

```bash
git add src/lib/llm tests/llm
git commit -m "feat: model layer core with JSON extraction, one-shot repair and provider fallback"
```

---

### Task 6: OpenAI-compatible provider, env config, live smoke script

**Files:**
- Create: `src/lib/llm/openai-compat.ts`, `src/lib/llm/config.ts`, `scripts/llm-smoke.ts`
- Test: `tests/llm/openai-compat.test.ts`, `tests/llm/config.test.ts`

**Interfaces:**
- Consumes: `Provider`, `ProviderError`, `Tier`, `createLLM` (Task 5)
- Produces:
  - `type CompatConfig = { name: string; baseURL: string; apiKey: string; models: Record<Tier, string>; systemPrefix: Partial<Record<Tier, string>>; jsonSchema: boolean; timeoutMs?: number }`
  - `type ChatClient = { chat: { completions: { create(args: Record<string, unknown>): Promise<unknown> } } }`
  - `createCompatProvider(cfg: CompatConfig, client?: ChatClient): Provider`
  - `toProviderError(name: string, e: unknown): ProviderError`
  - `freeProvidersFromEnv(env?: Record<string, string | undefined>): CompatConfig[]`
  - `createFreeLLM(env?): LLM`

- [ ] **Step 1: Write the failing tests**

`tests/llm/openai-compat.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { createCompatProvider, toProviderError, type ChatClient, type CompatConfig } from "@/lib/llm/openai-compat";

const cfg: CompatConfig = {
  name: "nvidia",
  baseURL: "https://x",
  apiKey: "k",
  models: { fast: "nano", deep: "super" },
  systemPrefix: { deep: "/think" },
  jsonSchema: true,
};

function fakeClient(reply: unknown) {
  const calls: Record<string, unknown>[] = [];
  const client: ChatClient = {
    chat: { completions: { create: async (args) => { calls.push(args); return reply; } } },
  };
  return { client, calls };
}

const okReply = { model: "nano-2", choices: [{ message: { content: '{"a":1}' } }], usage: { prompt_tokens: 12, completion_tokens: 3 } };

describe("createCompatProvider", () => {
  it("picks the model by tier, applies the tier's system prefix, and maps usage", async () => {
    const { client, calls } = fakeClient(okReply);
    const p = createCompatProvider(cfg, client);
    const res = await p.complete({ tier: "deep", system: "SYS", user: "U" });
    expect(calls[0]).toMatchObject({ model: "super", messages: [{ role: "system", content: "/think\nSYS" }, { role: "user", content: "U" }] });
    expect(res).toEqual({ text: '{"a":1}', model: "nano-2", inputTokens: 12, outputTokens: 3 });
  });

  it("sends response_format only when the provider supports JSON schema and one is given", async () => {
    const withSchema = fakeClient(okReply);
    await createCompatProvider(cfg, withSchema.client).complete({ tier: "fast", system: "S", user: "U", jsonSchema: { type: "object" } });
    expect(withSchema.calls[0].response_format).toEqual({ type: "json_schema", json_schema: { name: "output", schema: { type: "object" } } });
    expect((withSchema.calls[0].messages as { content: string }[])[0].content).toBe("S");

    const noSupport = fakeClient(okReply);
    await createCompatProvider({ ...cfg, jsonSchema: false }, noSupport.client).complete({ tier: "fast", system: "S", user: "U", jsonSchema: { type: "object" } });
    expect(noSupport.calls[0].response_format).toBeUndefined();
  });

  it("wraps thrown errors as ProviderError", async () => {
    const client: ChatClient = { chat: { completions: { create: async () => { throw { status: 429, message: "rate", headers: { "retry-after": "2" } }; } } } };
    const err = await createCompatProvider(cfg, client).complete({ tier: "fast", system: "S", user: "U" }).catch((e) => e);
    expect(err).toMatchObject({ name: "ProviderError", provider: "nvidia", status: 429, retryAfterMs: 2000 });
  });
});

describe("toProviderError", () => {
  it("reads retry-after from a Headers object or a plain record, and handles network errors", () => {
    expect(toProviderError("p", { status: 429, message: "m", headers: new Headers({ "retry-after": "3" }) }).retryAfterMs).toBe(3000);
    expect(toProviderError("p", { status: 500, message: "m", headers: {} })).toMatchObject({ status: 500, retryAfterMs: undefined });
    expect(toProviderError("p", new Error("ECONNRESET"))).toMatchObject({ status: null, message: "ECONNRESET" });
  });
});
```

`tests/llm/config.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { freeProvidersFromEnv } from "@/lib/llm/config";

describe("freeProvidersFromEnv", () => {
  it("builds NVIDIA then OpenRouter, in fallback order", () => {
    const out = freeProvidersFromEnv({
      NVIDIA_API_KEY: "nv",
      NVIDIA_MODEL_FAST: "nano",
      NVIDIA_MODEL_DEEP: "super",
      NVIDIA_DEEP_SYSTEM_PREFIX: "/think",
      NVIDIA_JSON_SCHEMA: "true",
      OPENROUTER_API_KEY: "or",
      OPENROUTER_MODEL_FAST: "nano:free",
      OPENROUTER_MODEL_DEEP: "super:free",
    });
    expect(out.map((c) => c.name)).toEqual(["nvidia", "openrouter"]);
    expect(out[0]).toMatchObject({
      baseURL: "https://integrate.api.nvidia.com/v1",
      models: { fast: "nano", deep: "super" },
      systemPrefix: { deep: "/think" },
      jsonSchema: true,
    });
    expect(out[0].systemPrefix.fast).toBeUndefined();
    expect(out[1]).toMatchObject({ baseURL: "https://openrouter.ai/api/v1", jsonSchema: false });
  });

  it("skips providers without a key and names the missing model variable", () => {
    expect(freeProvidersFromEnv({})).toEqual([]);
    expect(() => freeProvidersFromEnv({ NVIDIA_API_KEY: "nv", NVIDIA_MODEL_FAST: "nano" })).toThrow("NVIDIA_MODEL_DEEP");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/llm/openai-compat.test.ts tests/llm/config.test.ts`
Expected: FAIL, modules not found

- [ ] **Step 3: Implement**

`src/lib/llm/openai-compat.ts`:
```ts
import OpenAI from "openai";
import { ProviderError, type Provider, type Tier } from "./types";

export type CompatConfig = {
  name: string;
  baseURL: string;
  apiKey: string;
  models: Record<Tier, string>;
  systemPrefix: Partial<Record<Tier, string>>;
  jsonSchema: boolean;
  timeoutMs?: number;
};

export type ChatClient = { chat: { completions: { create(args: Record<string, unknown>): Promise<unknown> } } };

type CompletionLike = {
  model?: string;
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

function readHeader(headers: unknown, name: string): string | null {
  if (!headers) return null;
  if (typeof (headers as Headers).get === "function") return (headers as Headers).get(name);
  const value = (headers as Record<string, unknown>)[name];
  return typeof value === "string" ? value : null;
}

export function toProviderError(name: string, e: unknown): ProviderError {
  const err = e as { status?: unknown; message?: unknown; headers?: unknown };
  const status = typeof err?.status === "number" ? err.status : null;
  const message = typeof err?.message === "string" ? err.message : String(e);
  const retryAfter = Number(readHeader(err?.headers, "retry-after"));
  return new ProviderError(name, status, message, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined);
}

export function createCompatProvider(cfg: CompatConfig, client?: ChatClient): Provider {
  const chat: ChatClient =
    client ??
    (new OpenAI({ baseURL: cfg.baseURL, apiKey: cfg.apiKey, timeout: cfg.timeoutMs ?? 60_000, maxRetries: 0 }) as unknown as ChatClient);
  return {
    name: cfg.name,
    async complete(req) {
      const prefix = cfg.systemPrefix[req.tier];
      let res: CompletionLike;
      try {
        res = (await chat.chat.completions.create({
          model: cfg.models[req.tier],
          messages: [
            { role: "system", content: prefix ? `${prefix}\n${req.system}` : req.system },
            { role: "user", content: req.user },
          ],
          ...(cfg.jsonSchema && req.jsonSchema
            ? { response_format: { type: "json_schema", json_schema: { name: "output", schema: req.jsonSchema } } }
            : {}),
        })) as CompletionLike;
      } catch (e) {
        throw toProviderError(cfg.name, e);
      }
      return {
        text: res.choices?.[0]?.message?.content ?? "",
        model: res.model ?? cfg.models[req.tier],
        inputTokens: res.usage?.prompt_tokens ?? 0,
        outputTokens: res.usage?.completion_tokens ?? 0,
      };
    },
  };
}
```

`src/lib/llm/config.ts`:
```ts
import { createCompatProvider, type CompatConfig } from "./openai-compat";
import { createLLM } from "./structured";
import type { LLM } from "./types";

type Env = Record<string, string | undefined>;

function required(env: Env, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`${key} is not set`);
  return value;
}

function optional(env: Env, key: string): string | undefined {
  return env[key] || undefined;
}

export function freeProvidersFromEnv(env: Env = process.env): CompatConfig[] {
  const out: CompatConfig[] = [];
  if (env.NVIDIA_API_KEY) {
    out.push({
      name: "nvidia",
      baseURL: env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
      apiKey: env.NVIDIA_API_KEY,
      models: { fast: required(env, "NVIDIA_MODEL_FAST"), deep: required(env, "NVIDIA_MODEL_DEEP") },
      systemPrefix: { fast: optional(env, "NVIDIA_FAST_SYSTEM_PREFIX"), deep: optional(env, "NVIDIA_DEEP_SYSTEM_PREFIX") },
      jsonSchema: env.NVIDIA_JSON_SCHEMA === "true",
    });
  }
  if (env.OPENROUTER_API_KEY) {
    out.push({
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: env.OPENROUTER_API_KEY,
      models: { fast: required(env, "OPENROUTER_MODEL_FAST"), deep: required(env, "OPENROUTER_MODEL_DEEP") },
      systemPrefix: { fast: optional(env, "OPENROUTER_FAST_SYSTEM_PREFIX"), deep: optional(env, "OPENROUTER_DEEP_SYSTEM_PREFIX") },
      jsonSchema: env.OPENROUTER_JSON_SCHEMA === "true",
    });
  }
  return out;
}

export function createFreeLLM(env: Env = process.env): LLM {
  return createLLM(freeProvidersFromEnv(env).map((c) => createCompatProvider(c)));
}
```

In the test, `systemPrefix.fast` is `undefined` because `optional()` turns empty strings into `undefined`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/llm && npm run typecheck`
Expected: all PASS

- [ ] **Step 5: Live smoke script**

`scripts/llm-smoke.ts`:
```ts
import { z } from "zod";
import { freeProvidersFromEnv } from "@/lib/llm/config";
import { createCompatProvider, type CompatConfig } from "@/lib/llm/openai-compat";
import { createLLM } from "@/lib/llm/structured";
import type { Tier } from "@/lib/llm/types";

try {
  process.loadEnvFile(".env.local");
} catch {
  // env may come from the shell
}

async function listModels(baseURL: string, apiKey: string, match: RegExp) {
  const res = await fetch(`${baseURL}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) return `models endpoint returned ${res.status}`;
  const body = (await res.json()) as { data?: { id: string }[] };
  return (body.data ?? []).map((m) => m.id).filter((id) => match.test(id)).sort().join("\n  ");
}

const Probe = z.object({ sum: z.number(), capital: z.string() });

async function probe(cfg: CompatConfig, tier: Tier, jsonSchema: boolean) {
  const llm = createLLM([createCompatProvider({ ...cfg, jsonSchema })]);
  const started = Date.now();
  try {
    const out = await llm.structured({
      task: "smoke",
      tier,
      system: "You answer briefly and precisely.",
      content: "What is 17 + 25, and what is the capital of Karnataka?",
      schema: Probe,
    });
    const call = llm.calls()[0];
    return `ok ${Date.now() - started}ms repaired=${call.repaired} model=${call.model} out=${JSON.stringify(out)}`;
  } catch (e) {
    return `FAILED ${(e as Error).message.slice(0, 300)}`;
  }
}

const nvidiaKey = process.env.NVIDIA_API_KEY;
if (nvidiaKey) {
  const base = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";
  console.log(`NVIDIA models matching /nemotron/i:\n  ${await listModels(base, nvidiaKey, /nemotron/i)}\n`);
}
if (process.env.OPENROUTER_API_KEY) {
  console.log(`OpenRouter models matching /nemotron.*:free/i:\n  ${await listModels("https://openrouter.ai/api/v1", process.env.OPENROUTER_API_KEY, /nemotron.*:free/i)}\n`);
}

let configs: CompatConfig[] = [];
try {
  configs = freeProvidersFromEnv();
} catch (e) {
  console.log(`Fill in the model ids above, then re-run. (${(e as Error).message})`);
}

for (const cfg of configs) {
  for (const tier of ["fast", "deep"] as const) {
    console.log(`${cfg.name} ${tier} (${cfg.models[tier]}) prefix=${JSON.stringify(cfg.systemPrefix[tier] ?? "")}`);
    console.log(`  json_schema=on : ${await probe(cfg, tier, true)}`);
    console.log(`  json_schema=off: ${await probe(cfg, tier, false)}`);
  }
}
```

- [ ] **Step 6: Run it live (you run this step)**

1. Put your `NVIDIA_API_KEY` (and optionally `OPENROUTER_API_KEY`) in `.env.local`.
2. Run `npm run llm:smoke`. It prints the available Nemotron model ids.
3. Pick a **Nano** id for `NVIDIA_MODEL_FAST` and a **Super** id for `NVIDIA_MODEL_DEEP`. Do the same for OpenRouter's `:free` ids.
4. Run it again. For each tier, record:
   - Whether `json_schema=on` works. If it does, set `NVIDIA_JSON_SCHEMA=true`. If it errors with 400, leave it `false`.
   - Latency, and whether `repaired=true` shows up often.
5. Look up the chosen model's card on build.nvidia.com for its reasoning switch (for example a `/think` or `/no_think` system-prompt flag). Set `NVIDIA_DEEP_SYSTEM_PREFIX` to turn reasoning on and `NVIDIA_FAST_SYSTEM_PREFIX` to turn it off. Re-run and confirm the fast tier gets quicker.
6. Paste the final output into `docs/learn/stage-1.md` under "Model probe results" (Task 9). That's the first real data point for the write-up.

Expected: every probe line reads `ok … out={"sum":42,"capital":"Bengaluru"}` for at least the NVIDIA provider.

- [ ] **Step 7: Commit**

```bash
git add src/lib/llm scripts tests/llm .env.example
git commit -m "feat: OpenAI-compatible provider, env config and live Nemotron smoke probe"
git push
```

**Push:** the core library is done, and CI should be green.

---

### Task 7: App shell (header, landing stub, protected dashboard)

**Files:**
- Create: `src/components/SiteHeader.tsx`, `src/components/SiteHeader.module.css`, `src/components/GitHubCheck.tsx`, `app/dashboard/page.tsx`
- Modify: `app/page.tsx` (full replace)

**Interfaces:**
- Consumes: `auth`, `signIn`, `signOut` (Task 4); `db`, `getUserById`, `freeAnalysesLeft` (Task 3); `Button`, `ButtonLink`, `Card`, `Chip` (Task 2); `GET /api/me` (Task 4)
- Produces: `<SiteHeader />` (server component), `<GitHubCheck />` (client component)

- [ ] **Step 1: Header**

`src/components/SiteHeader.tsx`:
```tsx
import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { Button } from "@/components/ui/Button";
import styles from "./SiteHeader.module.css";

export async function SiteHeader() {
  const session = await auth();
  return (
    <header className={`shell ${styles.header}`}>
      <Link href="/" className={styles.logo}>Leap<span className={styles.logoDot}>.</span></Link>
      <nav className={styles.nav}>
        {session?.user ? (
          <>
            <Link href="/dashboard">Dashboard</Link>
            <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
              <Button variant="outline" type="submit">Sign out</Button>
            </form>
          </>
        ) : (
          <form action={async () => { "use server"; await signIn("github", { redirectTo: "/dashboard" }); }}>
            <Button type="submit" arrow>Sign in with GitHub</Button>
          </form>
        )}
      </nav>
    </header>
  );
}
```

`src/components/SiteHeader.module.css`:
```css
.header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-top: 20px; padding-bottom: 20px; }
.logo { font: 600 1.5rem/1 var(--font-display), system-ui, sans-serif; color: var(--ink); text-decoration: none; letter-spacing: -0.02em; }
.logoDot { color: var(--green); }
.nav { display: flex; align-items: center; gap: 16px; }
.nav a { color: var(--ink); text-decoration: none; font-weight: 500; }
```

- [ ] **Step 2: Landing stub**

The full illustrated landing page comes in Stage 6. This stub only proves the design system and the sign-in path.

`app/page.tsx`:
```tsx
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
```

- [ ] **Step 3: GitHub connection check (client component)**

`src/components/GitHubCheck.tsx`:
```tsx
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
```

- [ ] **Step 4: Protected dashboard**

`app/dashboard/page.tsx`:
```tsx
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
```

- [ ] **Step 5: Local end-to-end check (you do the account setup)**

1. **Neon:** create a project with branches `main` and `dev`. Put the **dev** connection string in `.env.local` as `DATABASE_URL`, then run `npm run db:migrate`.
2. **GitHub OAuth app (local):** GitHub → Settings → Developer settings → OAuth Apps → New.
   - Homepage: `http://localhost:3000`
   - Callback: `http://localhost:3000/api/auth/callback/github`
   - Copy the ID and secret into `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`.
3. Run `npx auth secret` and put the result in `AUTH_SECRET` in `.env.local`.
4. Run `npm run dev`:
   - Open `/`. You should see the header, the hero and the persona chips.
   - Click **Sign in with GitHub**, approve, and you land on `/dashboard`. It should show your name and **3** free analyses.
   - Click **Check GitHub connection**. You should see "Connected as @… GitHub API: …/5000".
   - Sign out and try `/dashboard`. It should redirect to `/`.
5. In the Neon console, confirm the `users` table has one row with your `github_id`, and that there's no token column anywhere.

- [ ] **Step 6: Commit**

```bash
git add app src/components
git commit -m "feat: header with GitHub sign-in, landing stub and protected dashboard"
```

---

### Task 8: Deploy to Vercel (production OAuth, env, migrations)

**Files:** none (configuration only)

- [ ] **Step 1: Link and deploy a preview**

```bash
npx vercel login
npx vercel link
npx vercel --prod
```
Note the production URL, for example `https://leap-xyz.vercel.app`.

- [ ] **Step 2: Production OAuth app and env vars**

1. Create a **second** GitHub OAuth app:
   - Homepage: `https://<prod-url>`
   - Callback: `https://<prod-url>/api/auth/callback/github`
2. Run the database migration on Neon's **main** branch:
   ```bash
   DATABASE_URL="<neon main branch url>" npx drizzle-kit migrate
   ```
3. Add the production env vars. The command prompts for each value:
   ```bash
   npx vercel env add AUTH_SECRET production        # generate a new one with: npx auth secret
   npx vercel env add AUTH_GITHUB_ID production
   npx vercel env add AUTH_GITHUB_SECRET production
   npx vercel env add DATABASE_URL production       # Neon main branch
   npx vercel env add NVIDIA_API_KEY production
   npx vercel env add NVIDIA_MODEL_FAST production
   npx vercel env add NVIDIA_MODEL_DEEP production
   npx vercel env add NVIDIA_FAST_SYSTEM_PREFIX production
   npx vercel env add NVIDIA_DEEP_SYSTEM_PREFIX production
   npx vercel env add NVIDIA_JSON_SCHEMA production
   npx vercel --prod
   ```

- [ ] **Step 3: Verify production**

1. Open the production URL, sign in with GitHub, and confirm the dashboard shows 3 free analyses and the connection check succeeds.
2. Open `https://<prod-url>/dev/ui`. It must return 404, because the style guide is dev-only.
3. Run `npx vercel inspect <deployment-url>` and note the function max duration it reports. The spec requires confirming this limit (spec §14), and it goes in `docs/learn/stage-1.md`.
4. If sign-in fails with a "host" error, add `AUTH_TRUST_HOST=true` to the production env and redeploy.
5. In the Vercel project settings, connect the GitHub repo so every push to `main` auto-deploys.

---

### Task 9: Close the stage (learning docs, push, tag)

**Files:**
- Create: `docs/learn/README.md`, `docs/learn/decisions.md`, `docs/learn/stage-1.md`

- [ ] **Step 1: Generate the learning docs with the `swe-ai-mentor` agent**

Dispatch the `swe-ai-mentor` agent with this brief:

> The author of `/Users/apple/Desktop/idea/leap` is new to TypeScript and won't write code. They need to understand where everything lives and defend every design decision to a startup founder. Read the whole repo (`src/`, `app/`, `tests/`, `scripts/`, `drizzle/`, configs), the spec `docs/superpowers/specs/2026-09-26-leap-design.md`, the roadmap, and this Stage 1 plan. Then write:
>
> 1. **`docs/learn/README.md`** (code map):
>    - A short "how to read this repo" section.
>    - A table: *path → what lives there → which stage added it → the one file to open first*.
>    - A progress checklist of all 7 roadmap stages with the Stage 1 items ticked.
>    - A "how a request flows" section for sign-in and for `/api/me`, as numbered steps naming the files.
> 2. **`docs/learn/decisions.md`** (decision log): one entry per decision made so far, each with the headings **Context / Decision / Alternatives / Why / Defend it in 30 seconds**. Cover at least:
>    - Next.js on Vercel vs. Supabase vs. a long-running server
>    - Neon + Drizzle
>    - PGlite for tests
>    - Auth.js with JWT sessions and the token kept out of the session
>    - Public repos only
>    - Free Nemotron first with OpenRouter fallback
>    - The provider-agnostic `LLM.structured` interface
>    - JSON extraction + one repair + fallback
>    - Two tiers (fast/deep)
>    - CSS Modules + tokens instead of Tailwind
>    - Illustrations only
>    - Staged delivery with CI
>    - Jev considered and dropped
>    - The CLI dropped
> 3. **`docs/learn/stage-1.md`** (walkthrough):
>    - What was built.
>    - A file-by-file tour in reading order.
>    - The TypeScript concepts that appeared (types vs. interfaces, generics like `structured<S extends z.ZodType>`, `z.infer`, union types like `Tier`, `async/await` and `Promise`, modules and imports, the `@/` alias, `as` casts and why each one exists, server vs. client components, `"use server"` actions), each explained with a snippet from *our* code.
>    - How the tests work (fakes, PGlite).
>    - A "Model probe results" section. Leave it for the author to paste the smoke output into, and include the Vercel max duration if it's known.
>    - 8–10 questions a founder or interviewer might ask about Stage 1, each with a crisp answer.
>
> Write for a smart beginner: short sections, no filler, link files with relative paths. Don't modify any code.

- [ ] **Step 2: Review the docs**

Read `docs/learn/README.md` and check that every path it lists exists (`ls` each one). Fix any path that's wrong.

- [ ] **Step 3: Final checks, push, tag**

```bash
npm test && npm run typecheck && npx next build
git add docs/learn
git commit -m "docs: stage 1 code map, decision log and walkthrough"
git push
git tag stage-1 && git push origin stage-1
```
Expected: CI is green on GitHub, the tag `stage-1` is visible, and Vercel has auto-deployed.

**Stage 1 exit criteria:**
- Sign-in works on the live URL.
- The dashboard shows 3 free analyses.
- `npm run llm:smoke` returns validated JSON from Nemotron.
- All tests pass in CI.
- The learning docs exist and match the code.
