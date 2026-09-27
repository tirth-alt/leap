# Leap Roadmap — Staged Build

**Spec:** `docs/superpowers/specs/2026-09-26-leap-design.md` (v2)

Each stage ends with four things:
1. A working, testable increment.
2. Green CI.
3. A push to `github.com/tirth-alt/leap` with a `stage-N` git tag.
4. An update to the learning docs in `docs/learn/`.

Only the current stage has a detailed plan. The next stage's plan is written when that stage starts, so it can use what the previous stage taught us (real model IDs, API quirks, timings).

## Learning docs (updated at the end of every stage)

| File | Purpose |
|---|---|
| `docs/learn/README.md` | **Code map.** Which folder holds what, and which stage added it. Also a progress checklist of stages and features. Start here. |
| `docs/learn/decisions.md` | **Decision log.** For each decision: the context, the choice, the alternatives considered, why this one, and how to defend it in 30 seconds. |
| `docs/learn/stage-N.md` | **Stage walkthrough.** What was built, the request/data flow, the TypeScript concepts that appeared (explained with our own code), and questions a founder or interviewer might ask, with answers. |

The author reads code and doesn't write it. The docs explain *where* and *why*. Code comments stay minimal.

## Stages

| # | Stage | You can demo at the end | Spec sections |
|---|---|---|---|
| 1 | **Foundation**: scaffold, design system, database, GitHub login, model layer, first deploy | Sign in with GitHub on the live URL. The dashboard shows your profile and 3 free analyses. `npm run llm:smoke` gets validated JSON back from Nemotron. | 6, 7, 8, 9 (tokens) |
| 2 | **GitHub scan**: incremental ingest, rule-based filtering, fast-tier screening, summaries, scan progress UI | Click "Scan", watch "repo 6/15", see your evidence list. A rescan only touches changed repos. | 5.1 |
| 3 | **Résumé + clarifications**: PDF/text parsing, sample résumé, claims, shortlist, verification, the chat panel with voice, saved facts | Enter a goal and résumé (or the sample), answer the gap-probing questions by voice or text, and see the facts saved. | 3, 5.2, 5.3, 5.7 |
| 4 | **Report + graph**: goal report, unlisted experience, improvements, better-fit projects, JD fit, skill graph | A full report with a skill graph on the live URL. | 5.4, 5.5 |
| 5 | **Mock interview**: built in the background, one-on-one flow, MCQ matching, grading as you go, results in the graph | Take a 6-question interview by voice and get per-question scores and "what to add" feedback. | 5.6 |
| 6 | **BYOK + quota + landing**: API key page, OpenAI/Gemini/Anthropic adapters, the lifetime quota, the illustrated landing page, the public sample report | Use up the 3 free runs, add a key, keep going. The landing page is ready to send to the founder. | 4, 9 |
| 7 | **Eval + write-up + polish**: labelled eval against the keyword baseline, `WRITEUP.md`, browser checks, final polish | The eval numbers and a one-page write-up. Send it to the founder. | 11, 13 |

The first deploy happens in Stage 1 and every later stage redeploys, so the live link is never more than one stage behind.

## What you need to do (the build can't do these for you)

| When | Action |
|---|---|
| Stage 1 | Create a **Neon** account and project (free) and copy the connection strings for a `dev` and a `main` branch. |
| Stage 1 | Create two **GitHub OAuth apps** (local + production). The callback URLs are in the Stage 1 plan. |
| Stage 1 | Get an **NVIDIA API key** at build.nvidia.com. An **OpenRouter** key is optional (it's the fallback provider). |
| Stage 1 | Log in to **Vercel** (`npx vercel login`). |
| Stage 7 | Label 15+ goal/JD cases for the eval: yours plus friends' who agree to it. |
