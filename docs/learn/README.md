# Leap — Code Map

Start here. This file tells you *where things live*, *what stage added them*, and *what to open first*. For the reasoning behind each decision, see [`decisions.md`](decisions.md). For a guided walkthrough of everything built so far, see [`stage-1.md`](stage-1.md).

## How to read this repo

Leap is a **Next.js 16 App Router app** deployed on Vercel. Two folders matter most:

- **`app/`** — pages and API routes. Next.js turns each `page.tsx` into a URL and each `route.ts` into an HTTP endpoint, based purely on folder names (this is called *file-based routing*).
- **`src/`** — everything else: the design system, the database layer, the auth logic, and the "framework-free" model (LLM) layer. Nothing in `src/` knows it's running inside Next.js — it's plain TypeScript that `app/` imports and calls.

The rule of thumb: **`app/` is thin, `src/` has the logic.** A page or route handler in `app/` mostly imports functions from `src/` and wires them together; the interesting code (and almost all the unit tests) live under `src/`.

Tests live in `tests/`, mirroring the `src/` folder structure (e.g. `src/db/users.ts` is tested by `tests/db/users.test.ts`). Nothing under `tests/` touches the network or a real database — see [`stage-1.md`](stage-1.md#how-the-tests-work) for how that works.

`docs/superpowers/` holds the *planning* documents (the spec, the roadmap, the per-stage plans) that this project was built from — read those if you want the original intent behind a feature. `docs/learn/` (this folder) is different: it's written *after the fact*, to explain what actually exists.

## Path → what's there → stage → open first

| Path | What lives there | Stage | Open first |
|---|---|---|---|
| [`package.json`](../../package.json) | Scripts (`dev`, `build`, `test`, `typecheck`, `llm:smoke`, `db:generate`, `db:migrate`), dependencies | 1 | `package.json` |
| [`tsconfig.json`](../../tsconfig.json) | TypeScript compiler settings, the `@/*` → `src/*` path alias | 1 | `tsconfig.json` |
| [`vitest.config.ts`](../../vitest.config.ts) | Test runner config (same `@/` alias, test file glob) | 1 | `vitest.config.ts` |
| [`drizzle.config.ts`](../../drizzle.config.ts) | Tells the `drizzle-kit` CLI where the schema and migrations live | 1 | `drizzle.config.ts` |
| [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) | GitHub Actions: on every push/PR, install → typecheck → test | 1 | `.github/workflows/ci.yml` |
| [`.env.example`](../../.env.example) | Every environment variable the app needs, with blank values | 1 | `.env.example` |
| [`drizzle/`](../../drizzle) | Generated SQL migrations (committed, not hand-written) | 1 | `drizzle/20260927122822_luxuriant_shooting_star/migration.sql` |
| [`app/layout.tsx`](../../app/layout.tsx) | Root HTML shell, loads the Outfit/Inter fonts | 1 | `app/layout.tsx` |
| [`app/globals.css`](../../app/globals.css) | Design tokens (colors, radii, shadow) as CSS custom properties | 1 | `app/globals.css` |
| [`app/page.tsx`](../../app/page.tsx) | Landing page stub (header + hero + persona chips) | 1 | `app/page.tsx` |
| [`app/dashboard/page.tsx`](../../app/dashboard/page.tsx) | Signed-in dashboard: free-analyses count, GitHub check | 1 | `app/dashboard/page.tsx` |
| [`app/dev/ui/page.tsx`](../../app/dev/ui/page.tsx) | Dev-only style guide (404s in production) | 1 | `app/dev/ui/page.tsx` |
| [`app/api/auth/[...nextauth]/route.ts`](../../app/api/auth/[...nextauth]/route.ts) | Auth.js's catch-all sign-in/callback/sign-out endpoint | 1 | `src/auth.ts` (this file just re-exports it) |
| [`app/api/me/route.ts`](../../app/api/me/route.ts) | `GET /api/me` — proves session → DB → GitHub token all work | 1 | `app/api/me/route.ts` |
| [`src/auth.ts`](../../src/auth.ts) | Auth.js configuration (GitHub provider, JWT sessions, callbacks) | 1 | `src/auth.ts` |
| [`src/auth/callbacks.ts`](../../src/auth/callbacks.ts) | Pure, unit-tested `jwt`/`session` callback logic | 1 | `src/auth/callbacks.ts` |
| [`src/auth/github-token.ts`](../../src/auth/github-token.ts) | Server-only read of the GitHub token out of the JWT cookie | 1 | `src/auth/github-token.ts` |
| [`src/db/schema.ts`](../../src/db/schema.ts) | All 7 Drizzle table definitions | 1 | `src/db/schema.ts` |
| [`src/db/client.ts`](../../src/db/client.ts) | Creates the Neon/Postgres connection (`db()` singleton) | 1 | `src/db/client.ts` |
| [`src/db/users.ts`](../../src/db/users.ts) | `users` table repository: upsert, get, quota math | 1 | `src/db/users.ts` |
| [`src/lib/llm/types.ts`](../../src/lib/llm/types.ts) | Shared types for the model layer (`Tier`, `Provider`, errors) | 1 | `src/lib/llm/types.ts` |
| [`src/lib/llm/json.ts`](../../src/lib/llm/json.ts) | Pulls a JSON value out of messy model text | 1 | `src/lib/llm/json.ts` |
| [`src/lib/llm/structured.ts`](../../src/lib/llm/structured.ts) | `createLLM`: validates, repairs once, falls back across providers | 1 | `src/lib/llm/structured.ts` |
| [`src/lib/llm/openai-compat.ts`](../../src/lib/llm/openai-compat.ts) | One `Provider` implementation for any OpenAI-compatible API | 1 | `src/lib/llm/openai-compat.ts` |
| [`src/lib/llm/config.ts`](../../src/lib/llm/config.ts) | Reads `NVIDIA_*`/`OPENROUTER_*` env vars into provider configs | 1 | `src/lib/llm/config.ts` |
| [`src/components/ui/Button.tsx`](../../src/components/ui/Button.tsx), `Card.tsx`, `Chip.tsx` | Design-system primitives (+ matching `.module.css`) | 1 | `src/components/ui/Button.tsx` |
| [`src/components/SiteHeader.tsx`](../../src/components/SiteHeader.tsx) | Server component: logo, nav, sign-in/sign-out forms | 1 | `src/components/SiteHeader.tsx` |
| [`src/components/GitHubCheck.tsx`](../../src/components/GitHubCheck.tsx) | Client component: button that calls `/api/me` | 1 | `src/components/GitHubCheck.tsx` |
| [`scripts/llm-smoke.ts`](../../scripts/llm-smoke.ts) | `npm run llm:smoke` — live check against real Nemotron models | 1 | `scripts/llm-smoke.ts` |
| [`tests/helpers/testDb.ts`](../../tests/helpers/testDb.ts) | Spins up an in-memory Postgres (PGlite) for tests | 1 | `tests/helpers/testDb.ts` |
| [`tests/`](../../tests) (rest) | Unit tests, one file per `src/` module | 1 | `tests/llm/structured.test.ts` |
| [`docs/superpowers/specs/`](../superpowers/specs) | The product spec Leap is built from | — (planning) | `2026-09-26-leap-design.md` |
| [`docs/superpowers/plans/`](../superpowers/plans) | The roadmap and per-stage implementation plans | — (planning) | `2026-09-27-leap-roadmap.md` |
| [`docs/learn/`](.) | These three files — the living explanation of the codebase | 1 | this file |

Later stages (2–7) will add sibling folders following the same pattern — for example `src/lib/scan/` in Stage 2, `src/lib/resume/` in Stage 3 — plus new `app/api/*` routes per the spec's endpoint list (§8). This table will grow with them.

## Progress checklist

### Stage 1 — Foundation
- [x] Scaffold: Next.js + TypeScript + vitest + CI (`package.json`, `tsconfig.json`, `vitest.config.ts`, `.github/workflows/ci.yml`)
- [x] Design system: tokens, Outfit/Inter fonts, `Button`/`Card`/`Chip`, dev style guide (`app/dev/ui/page.tsx`)
- [x] Database schema for all 7 v2 tables, Neon client, PGlite-tested `users` repository
- [x] GitHub sign-in via Auth.js v5, JWT sessions, GitHub token kept out of the browser-visible session
- [x] Model layer core: `LLM.structured`, JSON extraction, one-shot repair, provider fallback
- [x] OpenAI-compatible provider + env-driven config for NVIDIA/OpenRouter
- [x] App shell: header with sign-in/out, landing stub, protected dashboard
- [x] All unit tests passing in CI (33 tests / 7 files as of this writing)
- [x] Learning docs (`docs/learn/README.md`, `decisions.md`, `stage-1.md`)
- [ ] **Live Nemotron probe** — run `npm run llm:smoke` with a real `NVIDIA_API_KEY` and paste the output into `stage-1.md`
- [ ] **Local end-to-end sign-in** — create the Neon `dev` branch + local GitHub OAuth app, run `npm run dev`, sign in, confirm the dashboard
- [ ] **Vercel deploy** — link the project, add production env vars, deploy, verify sign-in on the live URL

### Stage 2 — GitHub scan
- [ ] Incremental ingest of owned/non-fork/non-archived repos
- [ ] Rule-based file filtering (noise filter, churn ranking)
- [ ] Fast-tier screening + summaries
- [ ] Scan progress UI ("repo 6/15"), rescans touch only changed repos

### Stage 3 — Résumé + clarifications
- [ ] PDF/text résumé parsing, sample résumé
- [ ] Claim extraction, lexical shortlist, deep-tier verification
- [ ] Clarification chat (voice + text), saved facts

### Stage 4 — Report + graph
- [ ] Full goal report: unlisted experience, claims vs. code, improvements, better-fit projects
- [ ] JD fit scoring
- [ ] Deterministic SVG skill graph

### Stage 5 — Mock interview
- [ ] Background-built interview, one-on-one flow
- [ ] MCQ matching, grading as you go, results feed the graph

### Stage 6 — BYOK + quota + landing
- [ ] API key page, OpenAI/Gemini/Anthropic adapters
- [ ] Lifetime free-tier quota enforcement
- [ ] Illustrated public landing page + sample report

### Stage 7 — Eval + write-up + polish
- [ ] Labelled eval vs. keyword-ATS baseline
- [ ] `docs/WRITEUP.md`
- [ ] Browser checks, final polish

## How a request flows

### (a) Signing in with GitHub

1. On any page, `src/components/SiteHeader.tsx` renders a form whose `action` is an inline **server action** (`"use server"`) that calls `signIn("github", { redirectTo: "/dashboard" })`. `signIn` comes from `src/auth.ts`.
2. `signIn` redirects the browser to GitHub's OAuth consent screen. The requested scope, `read:user`, is set explicitly in `src/auth.ts` (`GitHub({ authorization: { params: { scope: "read:user" } } })`) — Leap only ever wants public profile + public-repo access, never private repos or email.
3. GitHub redirects back to `app/api/auth/[...nextauth]/route.ts`. This file is tiny — it just re-exports the `GET`/`POST` handlers that `src/auth.ts` builds from `NextAuth(...)`. Auth.js does the OAuth token exchange here.
4. Auth.js calls its `jwt` callback, which `src/auth.ts` wires to `jwtCallback` in `src/auth/callbacks.ts`. Because this is a fresh GitHub sign-in (`account.provider === "github"`), `jwtCallback` calls `upsertGitHubUser` (`src/db/users.ts`), which runs an `INSERT ... ON CONFLICT DO UPDATE` against the `users` table (`src/db/schema.ts`) through the shared connection in `src/db/client.ts`.
5. `jwtCallback` returns a new token object holding `userId`, `login`, and `githubAccessToken`. Auth.js encrypts this and stores it in a cookie — there is no server-side session table (this is the "JWT session strategy").
6. Whenever a session is read afterward, Auth.js calls the `session` callback → `sessionCallback` (`src/auth/callbacks.ts`). It **builds a brand-new object** containing only `id`, `login`, `name`, `image`, `email` — it never spreads the token, so `githubAccessToken` never reaches anything sent to the browser.
7. The browser lands on `/dashboard`. `app/dashboard/page.tsx` (a server component) calls `auth()` to read the session, then `getUserById` + `freeAnalysesLeft` (`src/db/users.ts`) to render the user's name and free-analyses count.

### (b) `GET /api/me`

1. `src/components/GitHubCheck.tsx` (a `"use client"` component, rendered inside `app/dashboard/page.tsx`) calls `fetch("/api/me")` when the user clicks "Check GitHub connection".
2. The request hits the `GET` handler in `app/api/me/route.ts`.
3. It calls `auth()` (`src/auth.ts`) to read the session from the cookie. No session → `401`.
4. It calls `getUserById` (`src/db/users.ts`), via `db()` (`src/db/client.ts`), to load the full user row.
5. It calls `getGitHubToken(req)` (`src/auth/github-token.ts`), which uses `next-auth/jwt`'s `getToken` to decrypt the same cookie directly and pull out `githubAccessToken`. **This is the only place in the whole app that reads the raw GitHub token.**
6. If a token was found, it calls GitHub's own `https://api.github.com/rate_limit` endpoint with that token, server-side, to report the user's remaining GitHub API quota (5,000/hour, per-user).
7. It returns `{ login, freeLeft, github }` as JSON — `freeLeft` from `freeAnalysesLeft` (`src/db/users.ts`) — and **never** includes the token itself in the response.
8. `GitHubCheck.tsx` renders "Connected as @login. GitHub API: X/Y requests left this hour."
