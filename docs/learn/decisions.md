# Leap — Decision Log

One entry per decision. Each has the same shape so you can rehearse it: **Context** (the situation), **Decision** (what we picked), **Alternatives** (what we didn't), **Why** (the reasoning), and a **30-second defense** you can say out loud in a pitch meeting.

---

## 1. Next.js on Vercel vs. Supabase vs. a long-running server

**Context.** Leap needs a web UI, several API endpoints, background-ish work (scanning, grading), and a database. The spec (`docs/superpowers/specs/2026-09-26-leap-design.md`, §8) calls for "Next.js (App Router) on Vercel" with "thin route handlers" over a "framework-free core library."

**Decision.** Next.js 16 (App Router), deployed on Vercel, with all business logic in `src/` and Vercel's serverless functions running the `app/api/*` route handlers.

**Alternatives.**
- *Supabase* as the whole backend (auth + Postgres + edge functions) — attractive for speed, but it locks the auth and data layer into one vendor's SDK and dashboard, which is harder to reason about and to migrate later.
- *A long-running server* (Express/Fastify on a VM or container) — full control over process lifetime, but means paying for and operating a server 24/7 for what is, at Stage 1, occasional traffic, and losing Vercel's zero-config preview deploys per PR.

**Why.** One person building solo, wants a single "just works" pipeline: push to `main` → CI runs → Vercel deploys. Next.js's App Router gives file-based routing for both pages and APIs in one codebase, and Vercel's free tier is enough for a demo product. Keeping the actual logic (`src/lib`, `src/db`, `src/auth`) framework-agnostic means it isn't *stuck* on Next.js — if Vercel or Next.js ever became the wrong choice, only `app/` (thin glue) would need to be rewritten.

**Defend it in 30 seconds.** "We're a solo-built demo product, not a company with an ops team. Next.js on Vercel gets us auth, API routes, and pages in one deploy with zero server maintenance, and every push gets its own preview URL. All the real logic lives in a plain TypeScript `src/` folder that doesn't import Next.js at all, so we're not locked in — moving to a different host later is a Vercel-specific rewrite of thin route handlers, not a rewrite of the product."

---

## 2. Neon + Drizzle (and Drizzle is a v1 release candidate)

**Context.** Need a relational database (7 related tables: users, resumes, facts, repo scans, evidence, analyses, quiz attempts — see spec §7) that works both from serverless functions and from local tests.

**Decision.** **Neon** (serverless Postgres, branchable) as the database, **Drizzle ORM** (`drizzle-orm@rc`, i.e. its v1 release candidate) as the query builder and migration tool.

**Alternatives.**
- *Prisma* — the more popular ORM, but heavier (a generated client, a separate binary engine) and slower cold starts on serverless.
- *Raw SQL* via `pg` — total control, but no type safety on queries and hand-written migrations.
- *A stable (non-RC) ORM version* — safer, but Drizzle's stable line at the time didn't yet have the API shape (`drizzle({ client, schema })`) this project needed.

**Why.** Neon gives cheap branching (a `dev` branch and a `main` branch from one project — see the roadmap's day-1 setup) and a serverless driver (`@neondatabase/serverless`) that works over HTTP/WebSocket, which fits Vercel's serverless functions better than a long-lived TCP pool would. Drizzle's schema is plain TypeScript (`src/db/schema.ts`), so table shapes are compile-time checked, and its query builder stays close to SQL instead of hiding it. Taking `@rc` was a conscious bet: it was needed for the current API shape, and the risk is contained because tests exercise the ORM through PGlite (decision #3) on every CI run, so a breaking behavior change would be caught immediately, not discovered in production.

**Defend it in 30 seconds.** "Neon is Postgres with git-like branching, which is exactly what \"a dev database and a prod database\" needs, and its serverless driver matches Vercel's model. Drizzle is a thin, type-safe layer over raw SQL — no hidden magic, and every table lives in one readable `schema.ts` file. Yes, we're on Drizzle's v1 release candidate, not a final release — that's a real risk, but it's the version whose API this build needed, and our CI runs the full test suite against a real Postgres engine (via PGlite) on every commit, so a regression from an upstream bump would fail loudly in minutes, not surface as a silent prod bug."

---

## 3. PGlite for tests

**Context.** Spec §11 requires unit tests with "no network" — the DB repository functions (`src/db/users.ts`) need real SQL behavior (constraints, `ON CONFLICT`, defaults) to be trustworthy, but tests must not depend on a live Neon connection.

**Decision.** `@electric-sql/pglite` — a real Postgres engine compiled to WebAssembly, running in-memory inside the test process. `tests/helpers/testDb.ts` spins one up and applies the same migrations from `drizzle/` before each test.

**Alternatives.**
- *Mock the database layer* (fake `db.select()`/`db.insert()` objects) — fast, but tests would only prove the mock behaves as written, not that the real SQL (unique constraints, cascading deletes, `ON CONFLICT DO UPDATE`) actually works.
- *A shared test Postgres instance* (Docker container in CI) — realistic, but slower to start, needs orchestration, and tests can leak state between runs if not carefully isolated.
- *SQLite standing in for Postgres* — fast and in-memory, but SQLite's SQL dialect and type system differ from Postgres's (no real `jsonb`, different upsert syntax), so passing tests wouldn't guarantee passing in prod.

**Why.** PGlite is the same SQL engine as production (Postgres), so a passing test is real evidence, not a guess — this is why `tests/db/users.test.ts` can assert `ON CONFLICT DO UPDATE` actually keeps the same `id` on a second sign-in. It starts in milliseconds because it's in-process, so it doesn't slow down `npm test`. The cost: production uses the Neon driver and tests use the PGlite driver, and their TypeScript types don't perfectly match, hence the single documented cast in `tests/helpers/testDb.ts` (`database as unknown as DB`) — see `stage-1.md` for why that's a safe cast.

**Defend it in 30 seconds.** "Our database tests run against a real Postgres engine, not a mock — it's just a WebAssembly build of Postgres that boots in-process in milliseconds, so we get honest test coverage of things like unique constraints and upserts without needing a real network connection or a slow Docker container in CI."

---

## 4. Auth.js with JWT sessions, the token kept out of the session, and `read:user`-only scope

**Context.** Leap needs GitHub login, and needs the user's GitHub access token server-side (to call the GitHub API on their behalf later, for scanning), but must never expose that token to the browser or store it in the database (spec §7: "The GitHub OAuth token is kept only in the encrypted Auth.js JWT cookie, never in the database.").

**Decision.** Auth.js v5 (`next-auth@beta`) with `session: { strategy: "jwt" }`. The GitHub token is stored inside the encrypted JWT cookie via a custom `jwt` callback, and a custom `session` callback deliberately rebuilds the session object field-by-field so the token is never copied into it. The GitHub OAuth scope is narrowed to `read:user` only (the default GitHub provider asks for `read:user user:email` — the extra `user:email` was removed in a Task 4 code-review fix since Leap never needs the user's email).

**Alternatives.**
- *Database sessions* (Auth.js's other built-in strategy) — a `sessions` table in Postgres, looked up on every request. Safer in one sense (a session can be revoked server-side instantly), but means an extra DB round-trip on every authenticated request, and a spec that explicitly says "never in the database" for the token pushes toward keeping it purely in the encrypted cookie.
- *Full `repo` or `public_repo` OAuth scope* — would simplify nothing scan-related isn't built yet, and asks for more access than is currently used.
- *Passing the token to the client and calling GitHub directly from the browser* — would remove a server hop, but exposes a live, unrevoked-until-expiry credential to any script running in the page (e.g. via a browser extension or XSS), which the spec forbids.

**Why.** JWT sessions need no session-store table, which fits "Neon has 7 tables, all product data, zero infrastructure tables." Keeping the token *inside* the JWT but *outside* the session object is a specific, testable design: `sessionCallback` in `src/auth/callbacks.ts` builds `{ expires, user: { id, login, name, image, email } }` from scratch rather than spreading the token — `tests/auth/callbacks.test.ts` directly asserts `JSON.stringify(session)` never contains the token string. `read:user` (not the default `read:user user:email`) is the narrowest scope that still lets `/api/me` read the user's profile and rate limit, following the principle of least privilege the spec calls for ("profile scope only").

**Defend it in 30 seconds.** "We use GitHub's own OAuth login, and we're deliberately strict about the token: it lives only inside an encrypted cookie Auth.js manages, it's never written to our database, and there's a unit test that asserts it never appears in the object we send to the browser. We also only ask GitHub for `read:user` — not email, not write access, not private repos — the minimum needed to show your profile and scan your public work."

---

## 5. Public repos only

**Context.** Leap reads a user's GitHub activity as "evidence" for their résumé claims. Private repos often contain proprietary employer code.

**Decision.** Scan only public, non-fork, non-archived repositories the user owns (spec §5.1) — enforced by the `read:user` scope itself (decision #4), which doesn't grant access to private repository contents in the first place.

**Alternatives.**
- *Request the broader `repo` scope* and let users opt private repos in — more evidence, but real legal/ethical exposure (employer code, NDAs) and a much bigger OAuth consent screen that would scare off a casual demo user.

**Why.** The scope decision (`read:user`) and the scan-design decision (public only) reinforce each other: because Leap never asks for private-repo access, it's structurally impossible for it to read private code, not just a policy the app promises to follow. That's a stronger guarantee than "we won't look," and it keeps the OAuth consent screen short and unscary.

**Defend it in 30 seconds.** "We only ever request GitHub's `read:user` scope, which doesn't grant private-repo access at all — so this isn't a policy we promise to follow, it's something GitHub's own permission system enforces for us. That also keeps our OAuth consent screen minimal, which matters for conversion when someone's deciding whether to sign in."

---

## 6. Free Nemotron first with OpenRouter fallback; bring-your-own-key later

**Context.** Every AI feature needs an LLM. Spec §4 wants a working demo with *zero cost to try*, and §6 wants that to degrade gracefully instead of hard-failing when the free tier is overloaded.

**Decision.** A **provider chain**: try NVIDIA's Nemotron 3 models first (`integrate.api.nvidia.com`, free API catalog), then fall back to OpenRouter's free-tier Nemotron mirror if NVIDIA fails or rate-limits. `src/lib/llm/config.ts`'s `freeProvidersFromEnv` builds this list in that exact order, only including a provider if its env vars are present. Bring-your-own-key (OpenAI/Gemini/Anthropic) is deferred to Stage 6.

**Alternatives.**
- *Pick one provider and eat outages* — simpler code, but any NVIDIA downtime or rate limit would break every demo until BYOK ships.
- *Build BYOK first* — would remove the "runs for free with zero setup" promise that makes the product frictionless to try, which the spec treats as central to the pitch.
- *Self-host an open model* — removes the third-party dependency entirely, but adds real infrastructure and cost for a solo-built demo.

**Why.** A demo product's biggest risk is "the free thing didn't work when someone tried it live." Two independent free providers, tried in order, turns a single point of failure into two, at no extra cost to the user. `createLLM`'s fallback (decision #8) is provider-agnostic, so this ordering is just a list — adding a third free provider later is a config change, not a code change.

**Defend it in 30 seconds.** "The whole point of the free tier is that a founder can try Leap with zero setup. So the model layer doesn't call one AI provider — it tries NVIDIA's free Nemotron API first, and if that's rate-limited or down, it automatically retries against OpenRouter's free mirror of the same model family. That's implemented as a generic fallback list, so it's not brittle, and it's also exactly the mechanism that will let paying users plug in their own OpenAI or Anthropic key later without changing any call site."

---

## 7. The provider-agnostic `LLM.structured` interface

**Context.** Every feature after Stage 1 (screening, summaries, verification, report, interview grading) needs the model to return *structured* data (an object matching a schema), not free text, and needs to work identically whether the underlying provider is NVIDIA, OpenRouter, or (later) OpenAI/Anthropic.

**Decision.** One function signature everywhere: `llm.structured({ task, tier, system, content, schema })`, defined by the `LLM` interface in `src/lib/llm/types.ts` and implemented by `createLLM` in `src/lib/llm/structured.ts`. Callers pass a Zod schema and get back a value already validated against it (`z.infer<S>`) — they never import a provider, never touch raw chat completions, never parse JSON themselves.

**Alternatives.**
- *Call each provider's SDK directly from feature code* — more direct, but every feature (screening, verification, report...) would duplicate JSON-parsing, repair, and fallback logic, and switching providers would mean touching every call site.
- *A generic "chat" function returning a string* — simpler interface, but pushes JSON-extraction and validation into every caller, which is exactly the fragile, error-prone code this design centralizes instead.

**Why.** Centralizing "ask the model for structured data" in one place means the hard problems (decision #8: JSON extraction/repair/fallback) get solved once and tested once (`tests/llm/structured.test.ts`), instead of once per feature. Every future feature (Stage 2's screening, Stage 4's report, Stage 5's grading) becomes: define a Zod schema, call `llm.structured(...)`, done.

**Defend it in 30 seconds.** "Every AI call in this codebase goes through one function — `llm.structured` — that takes a schema and a task name and gives back validated data. Feature code never talks to a provider's SDK directly. That means the hard, easy-to-get-wrong parts — JSON extraction, retrying on a bad response, falling back to a second provider — are written and tested exactly once, and every new feature we add is a schema plus a prompt, not new plumbing."

---

## 8. JSON extraction (the ordered think-block candidates) + one repair + fallback

**Context.** Open models — especially "thinking" models like Nemotron 3 Super — often wrap their answer in `<think>...</think>` reasoning, add prose around the JSON, or use markdown code fences. Naively parsing the whole reply as JSON fails constantly.

**Decision.** `extractJson` (`src/lib/llm/json.ts`) tries an **ordered list of candidate strategies** and returns the first one that parses:
1. Strip *all* matched `<think>...</think>` pairs, then scan for the first complete JSON value.
2. If there's a stray closing `</think>` with no matching opening tag (a truncated-looking reply), take everything after the *last* one.
3. As a last resort, just scan the raw text for the first complete JSON value (covers a JSON object that appears *inside* a think block with nothing outside it).

If parsing plus schema validation both fail, `createLLM` (`src/lib/llm/structured.ts`) sends **one repair call**: the original prompt, the bad reply, and the validation errors, asking for a corrected value. If that also fails, or the provider errors (429/5xx/timeout), it moves to the next provider in the chain (decision #6).

**Alternatives.**
- *Always strip up to the last `</think>` tag* (the original plan's approach) — simpler, but breaks if the real JSON value legitimately contains the literal string `"</think>"` inside a quoted field, or if the JSON itself is only present *inside* the think block.
- *Ask the provider for guaranteed JSON mode and trust it* — works for providers that support `response_format` reliably, but Nemotron/OpenRouter's support was unconfirmed on day one (spec §14), so the code can't assume it.
- *No repair step, fail immediately* — simpler, but throws away runs on a single malformed reply that a one-line fix would have salvaged.
- *Unlimited repair retries* — better recovery, but risks looping on a model that can't produce valid output at all, burning time and quota.

**Why.** The ordered-candidates approach was a deliberate change from the original plan (recorded in the build ledger, `.superpowers/sdd/2026-09-27-stage-1-foundation/progress.md`, Task 5) after noticing the simpler "slice after the last `</think>`" rule both loses a JSON value that's *inside* a think block and breaks on a literal `"</think>"` string inside JSON. `tests/llm/json.test.ts` has explicit cases for both edge cases. One repair call (not zero, not unlimited) is the practical middle: it catches the common "almost-right JSON" failure without letting a truly broken model spin forever — and if repair fails too, per-provider retries stop and the next provider gets a try instead.

**Defend it in 30 seconds.** "Open models often bury their JSON answer inside reasoning tags or markdown fences. We don't just trust the raw text — we try a small ordered list of extraction strategies and take the first one that produces valid, schema-matching JSON. If none do, we send the model its own mistake and the validation error and ask it to fix it, once. If that still fails, we move to the next model provider in the chain. Every one of these edge cases — reasoning tags, a literal `</think>` inside a string, a JSON value with no visible tags at all — has its own test."

---

## 9. Two tiers (fast / deep)

**Context.** Not every AI call needs the same quality (or cost, or latency). Screening 80 candidate files is a different job from writing a nuanced report.

**Decision.** Exactly two tiers, `type Tier = "fast" | "deep"` (`src/lib/llm/types.ts`), mapped in config to two different model sizes (e.g. Nemotron 3 **Nano** for fast, Nemotron 3 **Super** with thinking on for deep — spec §6). Every `llm.structured` call must state which tier it needs; the model layer picks the actual model id from env config (`src/lib/llm/config.ts`).

**Alternatives.**
- *One tier for everything* — simpler, but either wastes a big model's cost/latency on simple screening, or starves a hard task (verification, report writing) of the reasoning a small model can't do.
- *Three-plus tiers* (e.g. fast/medium/deep) — more precise cost tuning, but more config surface and more decisions to make per call for marginal benefit at this project's scale.

**Why.** Two tiers map cleanly onto the two kinds of work the spec's feature list actually has: high-volume, low-difficulty passes (screening files, extracting claims) vs. low-volume, high-difficulty passes (verification, report, interview grading, JD fit). Concurrency (spec §6: "4 fast-tier calls in flight at a time") and cost also differ by tier, so this is also a rate-limit and budget knob, not just a quality one.

**Defend it in 30 seconds.** "We only have two speeds: fast, for high-volume, low-difficulty work like screening a hundred files, and deep, for the handful of calls that need real reasoning, like writing the report or verifying a claim. Every AI call declares which one it needs, and that maps to a different model size — so we're not paying deep-model prices for grunt work, and we're not starving the hard tasks of quality."

---

## 10. CSS Modules + tokens instead of Tailwind

**Context.** Need a consistent visual design system (spec §9: cream/green palette, pill buttons, rounded cards) that works across many components without becoming unmaintainable inline styles.

**Decision.** Plain CSS custom properties for design tokens (`app/globals.css`'s `:root` block: `--cream`, `--green`, `--ink`, etc.) plus **CSS Modules** per component (`Button.module.css`, `Card.module.css`, `Chip.module.css`) — scoped class names, no utility-class framework.

**Alternatives.**
- *Tailwind CSS* — very common, fast to write once memorized, but its utility classes duplicate the same token values inline everywhere (`bg-[#2fa24d]` scattered across files) instead of naming them once, and its learning curve is a real cost for someone who "won't write code" and needs to be able to read what's there.
- *A component library (MUI, Chakra)* — fast to assemble a UI, but ships someone else's visual identity that then has to be fought and overridden to match Leap's cream-and-green, illustration-driven look.
- *Plain inline styles everywhere* — no build step needed, but no scoping (a `.button` class in one file can collide with another) and no reuse of shared values.

**Why.** CSS Modules give each component's styles their own file with a plain, readable class name (`.button`, `.arrow`) that TypeScript can check exists (via `next-env.d.ts`'s `*.module.css` module type). Design tokens as CSS variables mean "change the green" is a one-line edit in `globals.css` that updates every button, chip, and card at once, and the same variables flip automatically in dark mode (`@media (prefers-color-scheme: dark)`) without duplicating component code.

**Defend it in 30 seconds.** "Every color, radius, and shadow in the app is a named CSS variable defined once — `--green`, `--cream`, `--ink` — so our whole visual identity lives in one small file, and dark mode is just a second set of values for the same names, not a second set of components. Each component's styles live in their own scoped CSS file next to it, so nothing collides and anyone reading `Button.tsx` can immediately open `Button.module.css` next to it."

---

## 11. The AA-contrast fixes: `--on-green` and `--danger`

**Context.** Spec §9 requires the whole UI to "meet AA contrast" (WCAG's 4.5:1 minimum contrast ratio for normal text). The original plan's colors didn't all pass.

**Decision.** Two tokens added beyond the plan: **`--on-green`** (`#10231a` light, same value in dark — a near-black used as *text color on top of* `--green` fills) and **`--danger`** (`#b3261e` light / `#ff8a80` dark — used for error text, replacing a reuse of `--coral`).

**Alternatives.**
- *Ship the plan's white text on green buttons as written* — matches the original design inspiration more literally, but white-on-`#2fa24d` measures 3.28:1 (light) and white-on-`#5cc877` measures 2.10:1 (dark) — both fail the 4.5:1 AA minimum.
- *Darken the green fill itself instead of changing the text color* — would also pass AA, but changes the palette's signature green rather than just its foreground text, a bigger visual departure from the reference design.
- *Reuse `--coral` for error text* (the original plan) — coral is explicitly reserved for illustrations only (decision #12); using it for UI text as well blurs that rule and coral-on-cream/surface also doesn't reliably clear AA.

**Why.** This was caught during implementation, not planning: Task 2's build ledger entry (`.superpowers/sdd/.../progress.md`) records that white-on-green measured 3.28:1/2.10:1, both below 4.5:1, and picked a new near-black text token instead, verified numerically (`#10231a` measures 5.01:1 against light green, 7.82:1 against dark green — both pass). The same pattern repeated for error text in Task 7: coral-on-background didn't reliably pass AA either, so a dedicated `--danger` token was added and verified (6.04–8.03:1 across all four light/dark background combinations). In both cases, "the spec's own AA requirement" was treated as binding over "the plan's literal color values" — a plan is a starting guess, a contrast ratio is measurable.
- Both fixes are small, additive tokens — nothing else in the palette changed.

**Defend it in 30 seconds.** "We hold ourselves to real WCAG AA contrast, not just an eyeballed palette. When we measured our first draft, white text on our green buttons only cleared 2–3:1 against the 4.5:1 legal/accessibility minimum, so we added a near-black `--on-green` text color instead — verified at 5:1 and 7.8:1 in light and dark mode. Same story for error messages: we added a dedicated `--danger` red instead of reusing our illustration-only coral, and checked it clears AA against every background we use it on."

---

## 12. Illustrations only

**Context.** Spec §9 says imagery must be "illustrations and design elements only, never photos," using unDraw SVGs recolored to the brand green plus custom SVG motifs.

**Decision.** No photographic imagery anywhere in the product; all visual accents are SVG illustrations, icons, or generated graphics (like the future skill graph, itself "a deterministic SVG built from data, with no layout library" per spec §5.5).

**Alternatives.**
- *Stock photography* (people at laptops, generic "tech" photos) — common for SaaS landing pages, but generic, slower to load, and harder to make feel distinctively "Leap" rather than a template.
- *AI-generated photographic images* — novel, but inconsistent style across generations and a licensing/consistency headache.

**Why.** Illustrations scale losslessly (SVG), load fast, recolor trivially to match the palette (a green-tinted unDraw illustration matches every other green element automatically), and avoid the "generic startup stock photo" look. It's also a visual promise that's cheap to keep consistently, since it's a hard rule rather than a taste judgment made file-by-file.

**Defend it in 30 seconds.** "No photos anywhere in the product — every visual is an SVG illustration or a piece of generated graphics, like the skill graph. That's not just an aesthetic choice: SVGs are lightweight, they recolor perfectly to match our palette, and it keeps the whole product feeling like one consistent system instead of a landing page bolted onto a generic photo library."

---

## 13. `next-env.d.ts` via `next typegen`

**Context.** Next.js auto-generates `next-env.d.ts`, which (among other things) declares the TypeScript type for `import styles from "./X.module.css"`. Without it, `npm run typecheck` fails on every CSS Module import. The file's content differs depending on whether `next dev` or `next build` ran last (it references either `.next/dev/types/...` or `.next/types/...`).

**Decision.** Gitignore `next-env.d.ts` and regenerate it deterministically as part of `npm run typecheck`, which now runs `next typegen && tsc --noEmit` (see `package.json`'s `typecheck` script).

**Alternatives.**
- *Commit `next-env.d.ts`* (tried first, in Task 1) — works locally, but the committed file's content flips every time someone runs `dev` vs. `build` locally, creating constant unrelated diff noise on every commit.
- *Hand-write a custom `.d.ts`* declaring `*.module.css` types (also tried first, in Task 1's original plan) — avoids the churn, but risks a duplicate/conflicting declaration if `next-env.d.ts` is present at the same time, and doesn't track whatever else Next's own typegen adds.

**Why.** This was a real course-correction recorded in the build ledger: Task 1 first tried committing `next-env.d.ts`, Task 2 confirmed the churn problem hands-on (the file's reference path differably said `.next/dev/types` after `dev` and `.next/types` after `build`), and the fix was to treat the file the way Next.js itself intends — fully generated, never committed, regenerated by tooling (`next typegen`, built into Next 16) right before every typecheck, including in CI.

**Defend it in 30 seconds.** "TypeScript needs to know that importing a `.css` file gives you a map of class names — Next.js generates that declaration automatically. Instead of committing a file that changes depending on which command you last ran locally, we regenerate it deterministically as the first step of every typecheck, so CI and every developer always get the same, current version."

---

## 14. The esbuild override

**Context.** `npm ci` (the reproducible install CI uses) failed on the very first CI run with `EBADPLATFORM` — a real npm bug where `vite`'s *optional* peer dependency on `esbuild` pulls in platform-specific `esbuild` sub-packages (like `@esbuild/aix-ppc64`) that `npm ci`'s stricter dependency resolution treats as required even though the current platform obviously doesn't match and would normally just skip them.

**Decision.** Pin one exact esbuild version across the whole dependency tree via `package.json`'s `"overrides": { "esbuild": "0.28.2" }`, forcing `drizzle-kit`, `tsx`, and `vite`'s optional peer slot to all resolve to the same version instead of three slightly different ones.

**Alternatives.**
- *Downgrade vitest/vite to an older, less bleeding-edge version* — might dodge the bug, but trades away the currently-installed test tooling for an unknown-quality older one, without confirming the bug is actually version-specific.
- *Do nothing and let `npm ci` fail in CI* — obviously not viable; CI must be green.

**Why.** This wasn't anticipated in the plan — it surfaced from reality (installing today's `@latest` package versions) and was root-caused with `npm ls esbuild`, which showed three different resolved `esbuild` versions across `drizzle-kit`, `tsx`, and `vite`'s optional peer. Forcing a single version via `overrides` is npm's own supported mechanism for exactly this situation (multiple packages wanting different versions of the same dependency) and was verified to fix both a clean `npm install` and a from-scratch `npm ci` locally before committing.

**Defend it in 30 seconds.** "Our build tools disagreed with each other about which version of a shared internal dependency (esbuild) to use, and one combination triggered a real bug in `npm ci`'s stricter install mode. We didn't work around the symptom — we found the root cause with `npm ls`, then used npm's own `overrides` feature to force one consistent version everywhere, and verified a clean install and CI both go green before shipping it."

---

## 15. Staged delivery with CI

**Context.** The whole product (spec: résumé parsing, GitHub scanning, clarifications, reports, mock interviews, BYOK, eval) is too large to build and validate in one pass, especially for an author who reviews but doesn't write code.

**Decision.** Seven stages (`docs/superpowers/plans/2026-09-27-leap-roadmap.md`), each ending in: a working, demoable increment; green CI (`.github/workflows/ci.yml`: install → typecheck → test on every push/PR); a push to the public repo with a `stage-N` git tag; and an update to `docs/learn/`.

**Alternatives.**
- *Build everything, then test and document once at the end* — riskier: problems compound silently across stages, and there's no "just show the founder this" checkpoint until the very end.
- *No CI, rely on manually running tests before each push* — cheaper up front, but nothing stops a broken commit from landing, and there's no automatic proof-of-work for a non-coding author to point to.

**Why.** Each stage is independently demoable ("sign in with GitHub on the live URL," per Stage 1's exit criteria) and independently defensible — a founder conversation can start from "here's what's live right now" at any point in the build, not just at the very end. Tests-then-code (TDD, see `stage-1.md`) plus CI on every push means a regression is caught within minutes of being introduced, not discovered three stages later.

**Defend it in 30 seconds.** "We're not building this in one big leap and hoping it all works — every stage ends in something you can actually click through on a live URL, with automated tests and CI proving it still works, tagged in git so we can always point back to exactly what existed at each checkpoint. That's what lets me show you real, working progress today instead of asking you to trust a roadmap."

---

## 16. Jev considered and dropped

**Context.** Stage 2's GitHub scan (spec §5.1) needs to rank which commits and files actually matter — is a file substantive, how relevant is it to the user's goal (1–5), what skill area does it show — before spending a fast-tier LLM call summarizing the top ones. During design, the author proposed **Jev**, TypeSafe AI's "System One" model (released in limited early access 15 Sep 2026), which returns *typed decisions* — a Choice, a Score, or a yes/no with a confidence — instead of free text, at roughly 70–500ms latency and $0.042 per million input tokens. Typed, fast, cheap ranking output is exactly the shape screening needs.

**Decision.** Dropped, for Stage 1/2. Screening instead runs deterministic rules first (a noise filter plus churn ranking, entirely code, no model call) and then hands the survivors to the same fast-tier model already in the model layer (Nemotron Nano on the free chain, or the user's own fast model under BYOK), scored in batches through the existing `llm.structured` interface.

**Alternatives.**
- *Adopt Jev now for the ranking step* — the best technical fit (typed output removes a whole class of JSON-parsing risk for this specific job), but blocked and premature for this build.
- *Wait on the Jev waitlist and delay Stage 2* — would eventually get the "right" tool, but ties the schedule to a third party with no confirmed access date.

**Why.** Five concrete reasons, all practical rather than technical: (1) Jev is early-access/waitlist-only — the author has no TypeSafe API key, so nothing built against it could even be run or tested in this build window; (2) it's proprietary and paid — the per-call cost is small, but every free-tier feature so far runs on Nemotron at zero cost to the user, and adding a paid vendor to the default path breaks that "free by default" story; (3) it's brand new — the latency/cost figures and typed-output format are vendor-reported, with no confirmed TypeScript SDK or request format to build against yet; (4) TypeSafe's own documentation lists weak spots (literal reading, no counting, context rot, sensitivity to adversarial input) that would need careful prompt design to work around safely for ranking real commit data; (5) it's one more provider and one more API key to manage, for a Stage 1/2 scope that already has NVIDIA and OpenRouter to integrate. None of these are "it's the wrong tool" — they're "not yet, not in this window."

**Defend it in 30 seconds.** "I evaluated a decision-only model — Jev, from TypeSafe AI — for ranking which commits and files matter during a scan. It's a great technical fit: it returns typed choices and scores instead of text, which is exactly the shape that job needs, and it's fast and cheap. But it's early-access and waitlist-only, I don't have a key yet, and it would add a paid, unproven, third vendor to a path that's currently free by default. So for now, ranking runs on deterministic rules plus the same fast-tier model everything else uses. Screening is isolated in one step of the scan pipeline, so adding a Jev ranker later, once I have access, is a small, contained change, not a rewrite."

---

## 17. The CLI dropped

**Context.** The design spec's v1→v2 changelog states plainly: "The CLI is dropped," and §12 ("Out of scope") lists "the CLI" alongside auto-apply and WhatsApp/Telegram integration as explicitly excluded.

**Decision.** Leap is a web product only — no command-line interface is planned or built at any stage.

**Alternatives.**
- *Ship both a CLI and a web app* — a CLI can appeal to a technical audience and enables scripting/automation, but doubles the surface area (two entry points into the same logic, two things to test and keep in sync) for a solo-built, five-day-per-stage schedule.
- *CLI-only, no web UI* — the original spec's v1 apparently had this shape (implied by "the CLI is dropped" replacing something), but a career-coaching product's actual audience (from students to senior engineers) expects a friendly web UI, a chat panel, voice input, and a visual skill graph — none of which read well in a terminal.

**Why.** The product's core value (an evidence-backed report, a skill graph, a conversational clarification flow, spoken mock-interview answers) is inherently visual and conversational — a terminal is the wrong medium for a skill graph or a "tap a node to see its sources" interaction (spec §5.5). Dropping the CLI let the team concentrate the whole build budget on one polished surface instead of splitting it.

**Defend it in 30 seconds.** "We looked at this as a web product from day one and killed an earlier idea of also shipping a CLI. Our core deliverable is genuinely visual and conversational — a skill graph you tap into, a chat-style clarification flow, a spoken mock interview — none of that works well as terminal output, and splitting effort across two interfaces would have meant a weaker version of both."
