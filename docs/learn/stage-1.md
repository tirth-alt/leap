# Stage 1 — Foundation: Walkthrough

This is the guided tour of everything built in Stage 1. Read [`README.md`](README.md) first for the map; read this for *why the code looks the way it does*, and [`decisions.md`](decisions.md) for the reasoning behind specific choices.

## What was built

A walking skeleton, built and CI-green, with the Vercel deploy pending the author's own credentials: a Next.js app where you can sign in with GitHub, land on a dashboard backed by a real Postgres database, and a script (`npm run llm:smoke`) that proves the AI "model layer" can get schema-validated JSON back from NVIDIA's Nemotron models, with automatic repair and provider fallback. Concretely, across 7 build tasks:

1. **Scaffold** — Next.js + TypeScript + vitest + CI, so every later task has a toolchain and a safety net.
2. **Design system** — color/spacing tokens as CSS variables, `Button`/`Card`/`Chip` components, a dev-only style guide page.
3. **Database** — all 7 tables from the product spec, a Neon (Postgres) client, and a fully tested `users` repository.
4. **GitHub login** — Auth.js v5, JWT sessions, the GitHub token kept out of the browser-visible session.
5. **Model layer core** — the JSON-extraction/repair/fallback logic that every future AI feature will call through.
6. **Model layer providers** — a generic OpenAI-compatible provider, env-driven config for NVIDIA/OpenRouter, and the live smoke-test script.
7. **App shell** — the header (with sign-in/out), a landing-page stub, and the protected dashboard that ties it all together.

## File-by-file tour (reading order)

This order follows the dependency chain: config first, then the lowest-level modules, then the things that build on top of them.

1. [`package.json`](../../package.json) — what commands exist (`dev`, `build`, `test`, `typecheck`, `llm:smoke`, `db:generate`, `db:migrate`) and what's installed.
2. [`tsconfig.json`](../../tsconfig.json) — strict TypeScript, and the `@/*` → `./src/*` path alias every import in this project relies on.
3. [`app/layout.tsx`](../../app/layout.tsx) → [`app/globals.css`](../../app/globals.css) — the root HTML wrapper and the design tokens (colors, radii) every page and component uses.
4. [`src/components/ui/Button.tsx`](../../src/components/ui/Button.tsx) + `.module.css`, then [`Card.tsx`](../../src/components/ui/Card.tsx), [`Chip.tsx`](../../src/components/ui/Chip.tsx) — the reusable design-system pieces.
5. [`app/dev/ui/page.tsx`](../../app/dev/ui/page.tsx) — a page that just renders one of everything above, so you can see the whole design system in a browser at once.
6. [`src/db/schema.ts`](../../src/db/schema.ts) — every table Leap's data model needs, defined once in plain TypeScript.
7. [`src/db/client.ts`](../../src/db/client.ts) — turns a `DATABASE_URL` into a live connection (`db()`).
8. [`src/db/users.ts`](../../src/db/users.ts) — the first (and so far only) *repository*: functions that read/write the `users` table.
9. [`tests/helpers/testDb.ts`](../../tests/helpers/testDb.ts) → [`tests/db/users.test.ts`](../../tests/db/users.test.ts) — how `users.ts` is proven correct without a real database connection.
10. [`src/auth/callbacks.ts`](../../src/auth/callbacks.ts) → [`tests/auth/callbacks.test.ts`](../../tests/auth/callbacks.test.ts) — the pure, testable heart of the login flow.
11. [`src/auth.ts`](../../src/auth.ts) — wires the callbacks above into Auth.js's `NextAuth(...)` config.
12. [`src/auth/github-token.ts`](../../src/auth/github-token.ts) — the one place that reads the raw GitHub token back out of the session cookie.
13. [`app/api/auth/[...nextauth]/route.ts`](../../app/api/auth/[...nextauth]/route.ts) — the URL GitHub redirects back to; just re-exports `src/auth.ts`'s handlers.
14. [`app/api/me/route.ts`](../../app/api/me/route.ts) — the first real API endpoint, tying together session + database + GitHub API.
15. [`src/lib/llm/types.ts`](../../src/lib/llm/types.ts) — every shared type in the model layer, read this before the files below.
16. [`src/lib/llm/json.ts`](../../src/lib/llm/json.ts) → [`tests/llm/json.test.ts`](../../tests/llm/json.test.ts) — turning messy model text into a JSON value.
17. [`src/lib/llm/structured.ts`](../../src/lib/llm/structured.ts) → [`tests/llm/structured.test.ts`](../../tests/llm/structured.test.ts) — validation, one repair attempt, provider fallback.
18. [`src/lib/llm/openai-compat.ts`](../../src/lib/llm/openai-compat.ts) → [`tests/llm/openai-compat.test.ts`](../../tests/llm/openai-compat.test.ts) — the actual HTTP call to an OpenAI-compatible API.
19. [`src/lib/llm/config.ts`](../../src/lib/llm/config.ts) → [`tests/llm/config.test.ts`](../../tests/llm/config.test.ts) — turning env vars into provider configs.
20. [`scripts/llm-smoke.ts`](../../scripts/llm-smoke.ts) — a script (not a test) that calls the real NVIDIA/OpenRouter APIs to sanity-check all of the above against reality.
21. [`src/components/SiteHeader.tsx`](../../src/components/SiteHeader.tsx) + `.module.css` — sign-in/out UI, built on `src/auth.ts`.
22. [`src/components/GitHubCheck.tsx`](../../src/components/GitHubCheck.tsx) — a client-side button that calls `/api/me`.
23. [`app/page.tsx`](../../app/page.tsx) → [`app/dashboard/page.tsx`](../../app/dashboard/page.tsx) — the two pages that assemble everything above into what a visitor actually sees.

## TypeScript concepts that appeared

### Types vs. interfaces

TypeScript has two ways to name a shape of data: `type` and `interface`. This codebase uses both, and the choice generally follows a pattern: **`interface` for something a class/object *implements* (a contract), `type` for everything else** (unions, object shapes that are just data, function signatures).

```ts
// src/lib/llm/types.ts — a contract: "anything can be a Provider if it has these members"
export interface Provider {
  name: string;
  complete(req: ChatRequest): Promise<ChatResponse>;
}

// a plain data shape — could be an interface too, but there's no "implements" relationship here
export type ChatRequest = { tier: Tier; system: string; user: string; jsonSchema?: Record<string, unknown> };
```

The practical difference that matters here: a `type` can be a union (`"fast" | "deep"`) or reference another type directly; an `interface` can be extended by another `interface` and can be implemented by a class. Both are checked identically by the compiler for object shapes — this project's split is a style convention, not a technical requirement.

### Generics (`structured<S extends z.ZodType>`)

A generic is a placeholder for "whatever type the caller gives me," filled in at the call site instead of fixed in advance. `LLM.structured` needs to accept *any* Zod schema and return a value typed to match *that specific* schema — not a fixed type.

```ts
// src/lib/llm/types.ts
export interface LLM {
  structured<S extends z.ZodType>(req: StructuredRequest<S>): Promise<z.infer<S>>;
  calls(): CallRecord[];
}
```

Read `<S extends z.ZodType>` as: "`S` can be any type, as long as it's a Zod schema." Whatever schema `S` you pass in `req.schema`, the function promises to return `z.infer<S>` — that *exact* schema's inferred shape, not some generic `unknown`. This is why, in a test like `tests/llm/structured.test.ts`, `await llm.structured(req)` where `req.schema = z.object({ sum: z.number() })` gives back something TypeScript already knows is `{ sum: number }` — no manual casting needed on the caller's side.

### `z.infer`

Zod schemas are runtime validators (they check data at runtime, unlike TypeScript types which vanish after compilation). `z.infer<typeof schema>` asks Zod: "if I gave this schema to `.parse()`, what TypeScript type would come out?" — turning a schema into a matching static type, so you never have to write the same shape twice (once as a Zod schema, once as a `type`).

```ts
// src/lib/llm/types.ts
export type StructuredRequest<S extends z.ZodType> = { task: string; tier: Tier; system: string; content: string; schema: S };
```

and used at the call site in `scripts/llm-smoke.ts`:
```ts
const Probe = z.object({ sum: z.number(), capital: z.string() });
// ...
const out = await llm.structured({ /* ... */ schema: Probe });
// `out` is inferred as { sum: number; capital: string } — from Probe alone
```

### Union types (`Tier`)

A union type lists the *exact* set of values allowed — nothing else compiles.

```ts
// src/lib/llm/types.ts
export type Tier = "fast" | "deep";
```

This isn't just documentation — `src/lib/llm/config.ts`'s `models: Record<Tier, string>` means TypeScript will refuse to compile if a `models` object is missing a `fast` or `deep` key, or has an extra one. The same pattern names the fixed sets used elsewhere in the project (e.g. the schema enums like `source: text("source", { enum: ["pdf", "paste", "sample"] })` in `src/db/schema.ts`).

### `async`/`await` and `Promise`

A `Promise` represents "a value that isn't ready yet, but will be" (or will fail). `async function` is a function that always returns a `Promise`; `await` pauses that function until the promise settles, without blocking the rest of the program.

```ts
// src/db/users.ts
export async function upsertGitHubUser(database: DB, p: GitHubProfile): Promise<User> {
  const [row] = await database
    .insert(users)
    .values(p)
    .onConflictDoUpdate({ target: users.githubId, set: { login: p.login, name: p.name, avatarUrl: p.avatarUrl } })
    .returning();
  return row;
}
```

`database.insert(...).returning()` doesn't return rows immediately — it returns a `Promise` that resolves once Postgres responds. `await` unwraps that promise into the actual array of rows once it's ready. The function's own return type, `Promise<User>`, tells every *caller* of `upsertGitHubUser` that they, too, need `await` (or `.then()`) to get the real `User` out.

### ES modules and imports

Every file in `src/` and `app/` is an ES module: it explicitly `export`s what other files may use, and `import`s exactly what it needs from elsewhere. `package.json` has `"type": "module"`, meaning Node treats `.ts`/`.js` files here as ES modules (using `import`/`export`) rather than the older CommonJS (`require`/`module.exports`).

```ts
// src/auth.ts
import NextAuth from "next-auth";                      // default import — the module's one "main" export
import GitHub from "next-auth/providers/github";        // default import from a different module
import { jwtCallback, sessionCallback } from "@/auth/callbacks"; // named imports — specific exports by name
```

### The `@/` alias

Deep relative imports (`../../../lib/llm/types`) get unreadable fast. `tsconfig.json` maps `@/*` to `./src/*`:

```json
// tsconfig.json
"paths": { "@/*": ["./src/*"] }
```

`vitest.config.ts` sets up the exact same alias for the test runner, so both `tsc` (typechecking) and `vitest` (running tests) resolve `@/db/users` to `src/db/users.ts` identically:

```ts
// vitest.config.ts
resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
```

Every import you see like `import { db } from "@/db/client"` means "from `src/db/client.ts`," no matter how deeply nested the importing file is.

### Every `as` cast, and why it exists

`as` tells TypeScript "trust me, treat this value as this other type" — it does **not** check or convert anything at runtime, so every cast is a place where a human is claiming something the type checker can't verify on its own. Here is every one in this codebase, and the reasoning behind it:

- **`src/auth.ts`** — `jwtCallback(params as Parameters<typeof jwtCallback>[0], ...) as never` and `sessionCallback(params as unknown as Parameters<typeof sessionCallback>[0]) as never`. Auth.js's own callback types are extremely wide (they support providers and flows this app doesn't use) — too wide for `jwtCallback`/`sessionCallback`'s own small, precise, unit-tested parameter types to satisfy directly. The cast is the seam between "Auth.js's generic world" and "our narrow, testable world"; the *logic* lives entirely in `src/auth/callbacks.ts`, which has no casts and is fully covered by `tests/auth/callbacks.test.ts`.
- **`src/lib/llm/structured.ts`** — `z.toJSONSchema(req.schema) as Record<string, unknown>` (Zod's JSON Schema output is typed more strictly than this codebase needs to consume it as) and `(e as Error).message` twice (a `catch` clause's error is typed `unknown` in strict TypeScript, but this code only ever throws real `Error`/`ProviderError` instances, so reading `.message` is a safe, deliberate assumption). It also has one non-null assertion, `e.retryAfterMs!`, used only inside the `shortWait` branch that already checked `e.retryAfterMs !== undefined`, so the `!` just tells TypeScript what the surrounding condition already guarantees at runtime.
- **`src/lib/llm/openai-compat.ts`** — `(headers as Headers).get(...)` and `(headers as Record<string, unknown>)[name]` (a rate-limit response's `headers` field could be a real `Headers` object or a plain object depending on the SDK/version, so the code checks which shape it has, casting only to *read* it safely); `err as { status?: unknown; ... }` (same reasoning as above — an unknown thrown value, narrowed just enough to read the fields this code checks for); `new OpenAI(...) as unknown as ChatClient` (the real `openai` SDK client structurally satisfies this project's tiny `ChatClient` interface, but TypeScript can't always prove that automatically across two independently-typed libraries, so the double cast — through `unknown` first — tells the compiler "these are unrelated types, but I know this one satisfies that shape"); `res as CompletionLike` (same reasoning, narrowing the SDK's full response type down to the few fields this code actually reads).
- **`src/lib/llm/json.ts`** — `e as Error` inside a loop over candidate parsing strategies, for the same "we know what we throw" reason as above.
- **`app/dashboard/page.tsx`** and **`app/api/me/route.ts`** — `(session.user as { id: string }).id`. Auth.js's built-in `Session["user"]` type doesn't know about the extra `id`/`login` fields this app's `sessionCallback` actually adds to it (see decision #4 in `decisions.md`); the cast tells TypeScript "trust that this session object has an `id`," which is true because `sessionCallback` (tested in `tests/auth/callbacks.test.ts`) always sets it.
- **`scripts/llm-smoke.ts`** — `(await res.json()) as { data?: { id: string }[] }` and `(e as Error).message` (twice) — `fetch(...).json()` is typed `Promise<any>` by the DOM lib, so a cast documents the shape this script expects back from the `/models` endpoint; same "we know what we throw" reasoning for errors.
- **`app/api/me/route.ts`** — `(await res.json()) as { rate: { remaining: number; limit: number } }` — same reasoning: narrowing `fetch`'s untyped JSON response to the one shape this code actually reads.
- **`src/components/GitHubCheck.tsx`** — `(await res.json()) as Me`. This is our own `/api/me` route responding to our own `fetch` call, so the cast is trusting our own JSON shape rather than a third party's — the response body is typed only as `any` by `fetch`, and `Me` documents what `/api/me` actually returns.
- **`tests/helpers/testDb.ts`** — `database as unknown as DB`. Production connects with the Neon driver (`drizzle-orm/neon-serverless`); tests connect with PGlite (`drizzle-orm/pglite`). Both expose the same query-builder methods at runtime (`.select()`, `.insert()`, etc.), but Drizzle gives each driver its own precise TypeScript type, so the two aren't directly assignable. The double cast says "trust that this PGlite-backed database supports everything `DB`'s type promises" — which is true for every method this codebase's repository functions (`src/db/users.ts`) actually call, and is exactly why `tests/db/users.test.ts` exists: to prove it at runtime, not just claim it in a type.

The common thread: every cast in this project exists at a **boundary** — between this codebase's own narrow types and a third-party library's wider/looser ones (Auth.js, the `openai` SDK, `fetch`, two different database drivers) — never as a way to silence an error inside our own logic.

### Server vs. client components

Next.js's App Router has two kinds of React components. **Server components** (the default) run only on the server — they can read a database or a session directly, and their output is plain HTML; no component code is sent to the browser. **Client components** (opted into with `"use client"` at the top of the file) run in the browser — they can use state, effects, and event handlers, but any server-only code (a database call, a secret) must not live inside them.

```tsx
// src/components/SiteHeader.tsx — a server component (no "use client"): it calls auth() directly
export async function SiteHeader() {
  const session = await auth();
  // ...
}
```

```tsx
// src/components/GitHubCheck.tsx — a client component: needs useState, so it opts in
"use client";
import { useState } from "react";
export function GitHubCheck() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  // ...
}
```

`app/dashboard/page.tsx` is itself a server component (it calls `auth()` and `getUserById` directly, with no `"use client"`), and it *renders* `GitHubCheck`, a client component, inside itself — this mixing is normal and expected: server components render the initial HTML (including any client components' placeholder), and the client components then "hydrate" (attach their interactivity) in the browser.

### `"use server"` actions

A **server action** is a function, written inline or in a separate file, marked `"use server"`, that a client (even a plain HTML `<form>`) can call directly — Next.js turns it into a real network request under the hood, without you writing an API route by hand.

```tsx
// src/components/SiteHeader.tsx
<form action={async () => { "use server"; await signIn("github", { redirectTo: "/dashboard" }); }}>
  <Button type="submit" arrow>Sign in with GitHub</Button>
</form>
```

Here, submitting the form (even with JavaScript disabled) runs `signIn("github", ...)` **on the server** — the browser never needs to know how Auth.js's sign-in flow works internally; it just submits a form. The same pattern powers "Sign out."

### CSS Modules

Importing a `.module.css` file gives you an object mapping each class name in that file to a unique, scoped string — so `.button` in `Button.module.css` can never accidentally collide with a `.button` class in some other file.

```tsx
// src/components/ui/Button.tsx
import styles from "./Button.module.css";
// ...
<button className={classes(variant, className)} {...rest}>
```
```ts
function classes(variant: Variant, extra?: string) {
  return [styles.button, styles[variant], extra].filter(Boolean).join(" ");
}
```
`styles.button` might actually render as something like `Button_button__a1B2c`, generated at build time — you never write or see that generated name yourself, you just reference `styles.button`. TypeScript knows `styles` is a `Record<string, string>` because of the ambient module declaration Next.js's own generated types provide (see decision #13 in `decisions.md` for why that file isn't committed).

## How the tests work

- **No network, no real database, ever** (spec §11). Every test either calls pure functions with plain JavaScript values, or uses a fake.
- **Fakes for the model layer**: `tests/llm/structured.test.ts`'s `scripted(name, replies)` builds a fake `Provider` whose `complete()` just returns pre-scripted replies (or throws pre-scripted errors) in order, and records every request it received (`seen`). This lets a test assert things like "after two bad replies from provider A, provider B gets exactly one call" without any real HTTP request happening.
- **PGlite for the database**: `tests/helpers/testDb.ts` creates a real (WebAssembly-compiled) Postgres instance in memory and runs the actual migrations from `drizzle/` against it before each test (`beforeEach` in `tests/db/users.test.ts`). This means `upsertGitHubUser`'s `ON CONFLICT DO UPDATE` behavior is tested against real SQL semantics, not a guess about what real Postgres would do.
- **TDD (test-driven development)**: for every module built in Stage 1, the *test file* was written first, run once to confirm it fails (because the implementation doesn't exist yet), and only then was the implementation written to make it pass. You can see this in the Stage 1 plan's structure (`docs/superpowers/plans/2026-09-27-stage-1-foundation.md`) — every task has a "write the failing test" step before an "implement" step. The benefit: the test is written against the *intended* behavior, not reverse-engineered from whatever the code happens to do.
- **Pure logic gets no fakes at all**: `tests/llm/json.test.ts` and `tests/auth/callbacks.test.ts` test plain functions (`extractJson`, `jwtCallback`, `sessionCallback`) with plain inputs and outputs — no database, no network, no mocking framework needed, because the functions themselves don't reach outside their own arguments.

As of this writing: **7 test files, 33 tests, all passing** (`npm test`), verified by running `npx vitest run` directly.

## Model probe results

Pending — the author pastes the output of `npm run llm:smoke` here after adding the NVIDIA key (redact anything that looks like a key). Also record the Vercel function max duration from `npx vercel inspect`.

## Questions a founder or interviewer might ask

**1. "Why should I trust the free tier will actually work when I try it live?"**
Because it isn't one provider — `llm.structured` tries NVIDIA's free Nemotron API first and automatically falls back to OpenRouter's free mirror of the same model family if NVIDIA is down or rate-limited (`src/lib/llm/config.ts`, `src/lib/llm/structured.ts`). One provider being briefly unavailable doesn't mean the demo breaks. The OpenRouter step only exists when `OPENROUTER_API_KEY` and its model ids are actually set — `freeProvidersFromEnv` skips a provider entirely if its key is missing, so the chain degrades to whichever providers are configured rather than erroring on an absent one.

**2. "What happens if the model returns garbage instead of JSON?"**
`extractJson` (`src/lib/llm/json.ts`) tries several strategies to pull a JSON value out of messy text (stripping reasoning tags, handling stray tags, scanning raw text), and if the result still doesn't validate against the expected schema, `createLLM` sends one automatic "here's your mistake, please fix it" repair call before giving up on that provider and trying the next one (`src/lib/llm/structured.ts`). This is unit-tested with intentionally malformed inputs (`tests/llm/json.test.ts`, `tests/llm/structured.test.ts`).

**3. "Where does my GitHub token go, and can anyone else see it?"**
It lives only inside an encrypted cookie that Auth.js manages (JWT session strategy) — never in our Postgres database, never in the object sent to the browser as `session`. `sessionCallback` (`src/auth/callbacks.ts`) rebuilds the session object field-by-field specifically to exclude it, and this is directly asserted by a unit test (`tests/auth/callbacks.test.ts`: `expect(JSON.stringify(session)).not.toContain("gho_secret")`).

**4. "Why can I only sign in with GitHub, not email/password or Google?"**
Leap's entire premise is "GitHub is evidence" — the product needs the user's GitHub identity and public activity to function at all, so GitHub OAuth isn't one option among several, it's the mechanism the whole product is built around.

**5. "Can Leap read my private repos?"**
No — the OAuth scope requested is `read:user` only (`src/auth.ts`), which doesn't grant access to private repository contents. This is enforced by GitHub's own permission system, not just a promise in our code.

**6. "Why Postgres/Neon instead of something simpler like SQLite or Firebase?"**
The data model (users, resumes, facts, repo scans, evidence, analyses, quiz attempts — `src/db/schema.ts`) is genuinely relational, with foreign keys and cascading deletes between them. Neon gives serverless-friendly Postgres with cheap branching (a `dev` branch and a `main` branch), which fits a solo-built project deploying to Vercel.

**7. "How do you know the database code actually works, if tests don't touch a real database?"**
Tests run against PGlite — a real Postgres engine (compiled to WebAssembly), running in memory, with the exact same migrations applied (`tests/helpers/testDb.ts`). It's not a mock of Postgres's behavior; it *is* Postgres's behavior, just running in-process instead of over a network.

**8. "What's actually deployed right now, versus what's just planned?"**
Everything under `src/`, `app/`, and `tests/` in this repo, described in `README.md`'s code map, is built and tested. GitHub sign-in, the dashboard, and the model layer's core logic all exist and pass CI. What's *not* done yet in Stage 1 (see the README's checklist): the live probe against real Nemotron models, a manual local sign-in walk-through, and the actual Vercel deployment — these need the author's own accounts/keys and are the next three concrete steps.

**9. "Why build your own JSON-repair/fallback logic instead of relying on the provider's built-in JSON mode?"**
Because it wasn't confirmed on day one whether NVIDIA's and OpenRouter's free Nemotron endpoints reliably support strict JSON schema mode (this was an explicit open question in the spec, §14) — and even providers that do support it can still occasionally return malformed output. Building the repair/fallback layer means the app doesn't have a hard dependency on that specific guarantee holding for every provider, forever.

**10. "This whole model layer seems like a lot of engineering for Stage 1 — why build it now instead of later?"**
Every feature from Stage 2 onward (scanning, screening, résumé parsing, report generation, mock-interview grading) needs to call an LLM and get structured data back reliably. Building and testing that once now (`src/lib/llm/`), behind one small interface (`llm.structured`), means every later stage is "define a schema, call the function" instead of re-solving JSON parsing, retries, and provider fallback five more times.
