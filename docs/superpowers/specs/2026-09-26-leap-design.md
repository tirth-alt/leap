# Leap — Design Spec (v2)

**One line:** Résumés are claims. GitHub is evidence. Tell Leap your goal. It reads your résumé and the code you actually wrote, asks what it can't see, and gives you an evidence-backed plan to get there. Then it interviews you on it.

*v2 (2026-09-27) replaces v1. Changes: goal-driven flow, clarification chat with saved facts, GitHub login + incremental cache, skill graph, mock-interview quiz, free open models with bring-your-own-key, JD upload/paste instead of job links. The CLI is dropped.*

---

## 1. Problem

- Candidates undersell work they really did and oversell things they only touched.
- ATS checkers match keywords and can't tell the two apart.
- Generic "résumé tips" ignore the specific goal ("SDE II → tech lead" needs different evidence than "first internship").
- Nobody connects a claim to the commits that prove it, or asks about the experience that never made it onto the page.

## 2. Users

Anyone with a GitHub account and a career goal, from students looking for internships to senior engineers aiming for Staff or EM roles. The first user and demo persona is the author: an SDE with about 2 years' experience targeting SDE II / tech + management roles.

## 3. User flow

1. **Landing (public):** the pitch, persona cards (Student · Early career · Mid-level · Senior → Staff/EM), a **public sample report** with its skill graph, and "Sign in with GitHub".
2. **Set up an analysis:**
   - **Goal** (required, free text).
   - **Résumé:** PDF upload or pasted text. Required the first time, then saved and reused, and replaceable.
   - **Job description** (optional): PDF/.txt upload or pasted text.
   - A **"Use sample résumé + goal"** button fills in a fictional generic résumé for a 5–6-year industry engineer and a matching goal, for testing and demos.
   - A banner above the form: *"Runs on NVIDIA Nemotron 3 (free, 3 analyses). For better results, use your own OpenAI, Gemini or Anthropic key →"*. It links to the API key page.
   - **On submit, the GitHub scan starts in the background.**
3. **Clarifications (chat, voice or text):**
   - The deep-tier model asks as many questions as actually change the advice, highest impact first, with a soft cap of 8. "Skip the rest" is always available.
   - It deliberately **probes gaps**: things the goal or JD needs that the résumé doesn't show ("Have you led a cross-team design at your current or past job?").
   - It never re-asks something already saved as a fact.
   - Each answer is saved as a **fact**. The scan keeps running during the chat.
4. **Report:** built once the scan finishes (§5.4).
5. **Mock interview (optional, "Test yourself"):** §5.6.
6. **Return visits:** a dashboard with the latest report and graph.
   - **Rescan** fetches only new repos and commits.
   - **New analysis** accepts a new goal or JD and reuses the cached evidence, the saved résumé and the facts.
   - **What you told Leap** lists all saved facts, editable and deletable.
   - **Delete my data** wipes every row for the account.

## 4. Quota and bring-your-own-key (BYOK)

- **Free tier:** 3 completed analyses per account for its whole lifetime (failed runs don't count), and up to 2 mock interviews per analysis, on NVIDIA Nemotron 3. An interview built in the background counts only once the user starts it.
- **BYOK:** the API key page takes a provider (OpenAI, Gemini, Anthropic) and a key.
  - The key is checked with one tiny call.
  - The model list is fetched from the user's account, with a suggested model preselected for each tier.
  - **The key lives only in the browser** (sessionStorage, or localStorage if "remember on this device" is ticked). It's sent with each request, used only in memory on the server, and never stored or logged.
  - BYOK runs have no quota.

## 5. Features

### 5.1 GitHub scan (incremental)
- **Login and scope:** GitHub OAuth via Auth.js, profile scope only (public repos only). API calls use the user's own token, so each user gets their own 5,000-requests-per-hour limit.
- **What gets scanned:** owned, non-fork, non-archived repos, up to 15 on the first scan. Only commits authored by the user are read. For each repo we record the user's share of commits, its languages, and frameworks detected from manifest files without the model (package.json, requirements.txt, pyproject.toml, go.mod, Cargo.toml, Dockerfile).
- **Incremental rescans:** repos whose `pushed_at` hasn't changed are skipped. Changed repos fetch only commits newer than the last one scanned, and their changes are added to each file's running totals. Only files that received new code are re-screened and re-summarised. Repos that were deleted, made private or archived get their evidence marked stale and left out.
- **Batched and resumable:** the browser calls `/api/scan` repeatedly, and each call finishes in under about 50s. A failure resumes from the last finished repo. Progress shows as "repo 6/15".
- **Selecting files:**
  1. **Rules:** drop lockfiles, vendored, generated, minified and binary files. Rank by authored churn (additions + ½ deletions + 25 × commits), capped per repo for diversity. Keep about 80 candidates.
  2. **Fast-tier screening:** 15 files per call, 4 calls at a time. Each file is sent as its path plus the first ~40 lines the user added. It gets back a substantive score (0–1) and a goal-relevance score (1–5).
  3. **Fast-tier summaries** for the top 25 files, 8 per call, within a budget of about 30k characters of added lines. Each gives a 1–2 sentence summary plus skills.

### 5.2 Résumé
- PDFs are converted to text on the server. Scanned or image-only PDFs get an error asking the user to paste the text instead.
- The fast tier splits the résumé into claims: at most 25, each with text, section and skills.

### 5.3 Matching and verification
- A **deterministic lexical shortlist** (IDF-weighted tokens + skill overlap + synonyms + light stemming) picks candidate evidence for each claim or requirement. Claims with no candidates are labelled "no public evidence" without a model call.
- **Deep-tier verification**, 8 claims per call, labels each claim *supported*, *weak* or *no_evidence*. **Citation guards:** cited ids must come from that claim's own shortlist, and a verdict that loses all its citations is downgraded.
- **Facts** are a separate source of support (◆ "you told us"). They are never presented as code evidence.

### 5.4 Report (deep tier, grounded in ids)
1. **Where you stand for this goal:** 3–4 lines.
2. **Unlisted experience:** things the user said in clarifications that are missing from the résumé, each with a ready-to-paste bullet. This is the headline section whenever facts exist.
3. **Claims vs. your code:** backed / partly backed / no public evidence, with file links. The wording is neutral, because private work is common.
4. **Improvements** in two tracks:
   - *This week:* concrete résumé edits, surfacing existing work, READMEs and benchmarks.
   - *1–3 months:* scoped side projects or open-source contributions that would create evidence for the goal.
   - Each improvement cites the claim, fact, gap or quiz result it comes from.
5. **Better-fit projects:** repos with strong goal-relevant evidence that the résumé doesn't mention, each with a suggested bullet and what to replace.
6. **JD fit** (only if a JD was given):
   - Requirements are pulled from the JD (must / nice, at most 15).
   - Each is marked *met / partial / gap*, citing evidence, claims or facts.
   - The weighted score counts must-haves double and partial as half.
   - Guards: "met" needs code evidence, a supported claim, or a fact.
7. **Skill graph** (§5.5).
8. A **run footer** listing the provider and models used, calls, tokens, time taken, and repos/commits/files read.

### 5.5 Skill graph
- **Deterministic SVG built from data**, with no layout library. Projects on the left, skills on the right, and an edge for each "project shows skill". Edge thickness follows authored churn.
- **Node states:** ● backed by code, ◐ partly, ◆ told us, ○ claimed only, ✕ needed for the goal but missing.
- **Badges:** goal skills are outlined and placed first, "new since the last scan", and "tested 4/5" after a quiz.
- Tapping a node lists its sources: file links, claims, facts, quiz results.
- **Under 640px** it switches to a grouped list (skill → projects).
- Each report stores a snapshot of the graph.

### 5.6 Mock interview (optional)
- **Built in the background:** when a report opens, a default interview (medium difficulty, goal skills that are partly backed or claimed only) starts generating. Changing the settings regenerates it behind a progress screen (~40–60s).
- **Settings:** difficulty easy / medium / hard; skills; 4–10 questions, default 6.
- **Content:**
  - About 60% of the questions come from résumé skills and claims, about 40% from the user's own projects.
  - Roughly two-thirds are MCQs (A–D).
  - Every question is generated **together with its rubric**, so grading can't drift later.
- **One-on-one flow:** one question on screen at a time. The user types or speaks the answer. The mic dictates into the text box, which stays editable. MCQs are plain text too: the user types or says a letter or the option itself, code matches it, and asks again if it's ambiguous.
- **Grading as you go:**
  - Each answer is graded while the user moves on, so results appear immediately at the end.
  - MCQs are graded by code (0 or 100).
  - Written and spoken answers are graded by the deep tier against the rubric, out of 100.
  - Feedback covers *what was wrong*, *what to add* (e.g. "mention a caching strategy and how you'd invalidate it"), and, for spoken answers, communication (structure, directness, completeness). The grader ignores filler words and speech-to-text errors.
- **Results:** a score for each question, per skill and overall. They're saved, add a "tested" layer on the graph (never overriding code evidence), and feed the next analysis's improvements.
- **"End test"** works at any point.

### 5.7 Speech input
The browser's built-in speech recognition (Web Speech API): free, no key, and in Chrome the audio is streamed to Google. The mic button is hidden where it isn't supported (for example Firefox), and typing always works.

## 6. Model layer

- **One interface,** `llm.structured({ task, tier, system, content, schema })`. Callers never name a provider.
- **Tiers:**

  | Tier | Tasks | Free provider | BYOK |
  |---|---|---|---|
  | fast | screening, code summaries, claim extraction, JD requirement extraction | Nemotron 3 **Nano** | the user's chosen fast model |
  | deep | clarifications, verification, report, JD fit, interview generation, grading | Nemotron 3 **Super**, thinking on | the user's chosen deep model |

  With an Anthropic key, the suggested defaults are Claude Haiku 4.5 (fast) and Claude Opus 5 (deep).
- **Free provider chain:** NVIDIA API catalog (OpenAI-compatible, `integrate.api.nvidia.com/v1`, 40 requests per minute), then OpenRouter `:free` Nemotron as the fallback. Model ids, base URLs and flags come from env vars.
- **Adapters:** an OpenAI-compatible client covers NVIDIA, OpenRouter, OpenAI and Gemini (via its OpenAI-compatible endpoint). The Anthropic SDK is used for Anthropic keys.
- **Reliable structured output:**
  1. Send the JSON schema. It goes into `response_format` where the provider supports it, and into the prompt always.
  2. Strip `<think>` blocks and code fences, then take the first complete JSON object.
  3. Validate with zod.
  4. On failure, make **one repair call** with the validation errors.
  5. If that fails too, or on 429/5xx/timeout (honouring Retry-After once), **move to the next provider**. BYOK runs have no free fallback: the error is shown instead.
- **Concurrency:** 4 fast-tier calls in flight at a time.
- **Prompt hygiene:** all untrusted text (résumé, code, JD, answers) is wrapped in tags and declared as data.
- **Metering:** calls, tokens, provider and models are recorded for each analysis.

## 7. Data model (Neon Postgres, Drizzle ORM)

| Table | Key fields |
|---|---|
| `users` | id, github_id, login, name, avatar_url, free_analyses_used, created_at |
| `resumes` | id, user_id, text, source (pdf / paste / sample), created_at |
| `user_facts` | id, user_id, question, answer, skills[], kind (experience / preference / context), analysis_id, created_at, updated_at |
| `repo_scan` | user_id, repo, pushed_at, last_commit_sha, last_scanned_at, author_share, languages, frameworks, status (active / stale) |
| `evidence` | id, user_id, repo, path, additions, deletions, commits, newest_sha, url, substantive, relevance, summary, skills[], stale, updated_at. Unique (user_id, repo, path). |
| `analyses` | id, user_id, goal, jd_text, resume_id, status (clarifying / scanning / building / ready / failed), questions, report (JSON incl. graph snapshot), usage, provider, created_at |
| `quiz_attempts` | id, user_id, analysis_id, difficulty, skills[], questions (incl. rubrics), answers, grades, status, created_at |

The GitHub OAuth token is kept only in the encrypted Auth.js JWT cookie, never in the database.

## 8. Architecture

- **Next.js (App Router) on Vercel.** Framework-free core library in `src/lib/`, with thin route handlers.
- **Step endpoints.** Each is short, idempotent and saved to the database:
  - `POST /api/analyses`: create from goal, résumé, JD
  - `POST /api/analyses/:id/questions`: generate clarifications
  - `POST /api/analyses/:id/answers`: save answers → facts
  - `POST /api/scan`: one batch; the client loops until done
  - `POST /api/analyses/:id/report`: build the report
  - `POST /api/quiz`: generate an interview
  - `POST /api/quiz/:id/answer`: grade one answer
  - `POST /api/quiz/:id/finish`
  - `GET/PATCH/DELETE /api/facts`, `DELETE /api/me`, `POST /api/keys/test`
- **Background work** (scanning during clarifications, building the interview while the report is read, grading as the user answers) is driven by the client firing requests without waiting on them. No queue infrastructure.
- **Quota** is checked and incremented in a transaction when an analysis reaches `ready` on the free tier.

## 9. Visual design

**Direction** (inspiration: the cream-and-green career-guide boards the author shared):

- **Palette:**
  - Cream background (~`#FBF6E4`)
  - Primary green (~`#2FA24D`) and light green panels (~`#BFE6B5`)
  - Near-black text and pill CTAs (~`#1C1C1A`)
  - A warm coral (~`#E8603C`), used only inside illustrations
  - A dark mode derived from the same tokens
- **Type:** **Outfit** (Google Fonts) for headings and **Inter** for body text. Headings are large with tight tracking, and a small green dot follows the hero headline.
- **Shapes:** large rounded cards (radius ~24px); pill chips, outlined green and filled green; dark pill buttons with a circular arrow; soft shadows. The landing page has tall rounded **persona cards** with vertical labels.
- **Imagery:** **illustrations and design elements only, never photos.** Use **unDraw** SVGs (free, no attribution required, recoloured to the primary green) plus custom SVG motifs (node-graph patterns, commit dots, rising paths).
- **Landing sections:** hero with persona cards → "How it works" (3 steps) → the sample skill graph → why evidence beats claims → CTA.
- **App screens use the same system:** the chat panel, report cards, the graph, and the interview screen.
- Everything must work at 375px wide with no horizontal scrolling, respect reduced-motion, and meet AA contrast.

## 10. Error handling

- **Every step is saved.** A failure retries that step only.
- **All free providers fail:** "Free models are busy. Retry, or use your own key."
- **GitHub:** a rate limit shows its reset time. No public repos → a résumé-only analysis with an explanation. A scan that fails partway keeps the repos it finished.
- **Bad PDF:** the user is asked to paste the text.
- **No speech support:** the mic is hidden.
- **Unexpected errors:** a plain message to the user; details go to the server logs only.

## 11. Testing and evaluation

- **Unit tests (vitest), no network:**
  - noise filter, stack detection, churn ranking, incremental diff and merge
  - shortlist, citation guards, fit score
  - graph building
  - MCQ answer matching
  - JSON extraction and repair, provider fallback order
  - quota rules
  - BYOK header parsing
  - These use a fake model, a fake GitHub and a fake database layer.
- **Live smoke script:** the sample résumé + goal against the author's GitHub on the free provider chain.
- **Eval:** 15+ hand-labelled goal + JD cases. Labels come from the résumé owner and are written before seeing Leap's output. Leap is compared with a keyword-ATS baseline on accuracy, met-precision and over-claim rate, with the provider recorded.
- **Browser check before each deploy:** the sample report, a full flow, the mic in Chrome, and a 375px layout.

## 12. Out of scope

- LinkedIn/X scraping or posting, auto-apply, auto-messaging, private-repo access
- WhatsApp/Telegram, job-link fetching, the CLI, any payment

## 13. Success criteria

- The founder can sign in, run the sample (or their own) analysis, and get a report plus graph in about 1.5 minutes on the free tier.
- Every "backed" or "met" label links to a real file at a real commit. Every fact-based suggestion quotes the fact it came from.
- A rescan after new commits touches only the changed repos and updates the graph.
- The mock interview starts instantly when it was built in the background, and shows per-question scores with "what to add" feedback right at the end.
- The eval covers 15+ labelled cases with honest numbers against the baseline.
- `docs/WRITEUP.md` covers decisions, eval results, failure modes, and cost and latency per analysis.

## 14. To confirm on day 1

- Exact Nemotron 3 Nano and Super model ids on NVIDIA and OpenRouter.
- Whether they support `response_format` / JSON schema.
- How thinking is switched on and off.
- Vercel's function duration limit on the chosen plan.
- The Gemini OpenAI-compatible base URL.
- The current OpenAI/Gemini model lists for the suggested defaults.

## 15. Schedule (about 5 focused days)

| Day | Build |
|---|---|
| 1 | Scaffold, design tokens, Auth.js GitHub login, database schema, model layer (providers, tiers, JSON repair, fallback) |
| 2 | Incremental scan, screening, summaries, résumé parsing, claims, shortlist, verification |
| 3 | Clarification chat (voice), facts, report builder, JD fit, graph. **First deploy.** |
| 4 | Mock interview (background build, grading as you go, results), BYOK page, quota, landing page, sample report |
| 5 | Eval, write-up, polish, browser checks |
