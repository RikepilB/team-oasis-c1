# Synapse — Team Oasis

Synapse helps Water Care Canada turn programme reports into checked, bilingual funder reports. A report arrives in the Inbox; Synapse pulls out the facts with their sources, checks every number, drafts the funder version in English and French, and a named person approves it before anyone exports it.

Built for The Water Challenge AI Hackathon, track C1 ("Reimagining an AI-Enabled Water Care Canada"). Water Care is the challenge pack's fictional organisation; all programme, funder and people data here is fictional.

- Workspace: https://synapse-oasis-one.vercel.app
- Astro introduction: https://synapse-oasis-site.vercel.app

## Assumptions

These are the assumptions the design and the demo rest on. Anything here that turns out to be wrong changes the plan, so they are listed in one place.

### The AI

1. **The AI is a tool Water Care already approves, not something Synapse invents.** Synapse calls one approved large language model (LLM) through one small adapter (`lib/harness/providers/live.ts`). We assume Water Care would run it on the model provided with its approved office suite (called "Workspace Suite" in the pack) or another model it signs off. Swapping the model means swapping that one file; nothing else changes.
2. **If Water Care chooses Claude, Claude Haiku 5.5 works.** The adapter defaults to `claude-haiku-5-5`, chosen for speed and cost on short, structured jobs. Another Claude model can be set with `SYNAPSE_MODEL` without a code change.
3. **The AI only drafts.** It does three registered jobs ("skills"): pull facts out of a report, draft the French version, and write the narrative parts of a funder template. Each skill has a written instruction, an owner, a data class, a risk tier and a named approver (`standard/skills/`).
4. **Code, not the AI, does the maths.** Percentages and counts come from code over the evidence data. The AI may only repeat a number that is in a cited fact or metric; a check blocks approval otherwise.
5. **A person decides.** Nothing is approved, exported or sent automatically. Synapse never emails a funder; staff send the exported file themselves.
6. **No chatbot.** The Assistant answers "where does this number come from?" by quoting the report's own facts and checks. A general chatbot is out of scope and would need Federation approval first.
7. **Personal data is stopped before the model.** A guard blocks email addresses, phone numbers and supporter IDs before any AI call. Names are not detected automatically, so report writers are asked to leave them out.

### The organisation and the data

8. **Pack data only.** Figures and rules come from the C1 challenge pack (for example funder deadlines from the Annual Operating Calendar, 1.4, and cost bands from 2.3). The Kijana water-point data stands in for real programme data in the demo only.
9. **One sample project in a Water Care style.** "Healthy Schools WASH (sample)" is a fictional project written in the style of a Water Care programme report, to show a realistic case. It is labelled "Sample data" in the app. It is not WaterAid's data and Synapse is not a WaterAid product.
10. **Two ways of counting, not wrongdoing.** "Fully working" and "including partly working" water points give different percentages (for example 85% vs 70%). Synapse shows both and asks which one a report means; a mismatch is a question for the programme team, not an accusation.
11. **Reports arrive by email (simulated).** In the real system, programme reports would be CC'd to a Synapse inbox address. In the demo they are files in `data/fixtures/demo/inbox/`.
12. **Roles stand in for sign-in.** "Acting as" switches between fictional people (preparer, bilingual reviewer, approver, administrator). Real use needs Water Care's single sign-on and group permissions.
13. **No job cuts.** Synapse is sized in hours given back to staff, not in roles removed. Job cuts are out of scope.
14. **Due dates** come from the pack's operating calendar: FDF financial reports are due 31 Jul (Q1), 31 Oct (Q2), 31 Jan (Q3) and 30 Apr (Q4) of an April–March fiscal year. Funders with no deadline in the pack show none.
15. **Priorities and the Needs action sample are demo data.** `data/fixtures/demo/priorities.json` says who set each report's priority (P0 do first, P1 next, P2 later), when and why. `seed.json` replays a few steps once when a fresh demo starts, so three reports are waiting in Needs action. Both are fictional. Set `SYNAPSE_SEED=off` to start with untouched reports.

## Run it on your computer

You need **Node.js 22 or 24** (from nodejs.org) and a terminal. Steps for a Mac, in Terminal or the VS Code terminal:

```bash
cd ~/Downloads/team-oasis-c1-main     # or wherever the project folder is
npm ci                                # first time only
SYNAPSE_DATA_DIR=data/fixtures/demo npm run dev -- --hostname 127.0.0.1 --port 3019
```

Open http://127.0.0.1:3019. Press Control + C in the terminal to stop.

On Windows PowerShell, set the variable first: `$env:SYNAPSE_DATA_DIR = "data/fixtures/demo"`, then `npm run dev -- --hostname 127.0.0.1 --port 3019`.

For a demo without the Next.js developer badge, build once and run the production server:

```bash
SYNAPSE_DATA_DIR=data/fixtures/demo npm run build
SYNAPSE_DATA_DIR=data/fixtures/demo npm start -- --hostname 127.0.0.1 --port 3019
```

To start the demo fresh, add a new state folder, for example `SYNAPSE_RUNTIME_DIR=demo-run-2`, before the command.

`npm run dev:site` opens the Astro introduction on port 3020. `PUBLIC_WORKSPACE_URL` sets its destination when building the site.

## Try live AI with your own key

By default Synapse **replays** recorded AI answers, so it needs no key and no internet. To run the same steps against a real model:

1. Copy `.env.example` to `.env.local` in the project folder (`cp .env.example .env.local`).
2. In `.env.local`, set `ANTHROPIC_API_KEY=` to your key. Optionally set `SYNAPSE_MODEL` (default `claude-haiku-5-5`).
3. Check the key and model work: `npm run ai:check`. It sends one short test request and prints the answer.
4. Set `AI_MODE=live` in `.env.local` and restart Synapse. Settings → AI mode shows "Live" and the model.
5. Open a report and run Extract facts, Create checked French draft and the funder draft. Each call is logged in Activity with the model used. The same checks apply: if the AI's answer fails them twice, the step stops and says why.

Keep the key only in `.env.local`. It is ignored by Git and must never go into code, a commit, a screenshot or a chat. Set `AI_MODE=replay` (or remove it) to go back to recorded answers.

## Put it on GitHub

1. Create a new **private** repository on GitHub (no README, no .gitignore; this package has both).
2. In this folder:
   ```bash
   git init
   git add .
   git commit -m "Synapse: Team Oasis C1 demo"
   git branch -M main
   git remote add origin https://github.com/<your-account>/<repo-name>.git
   git push -u origin main
   ```
3. Check before pushing: `git status` must not list `.env.local`, `node_modules/`, `.next/` or `data/pack/`. `.gitignore` already excludes them. Never commit an API key.
4. To try it in the browser without installing anything, open the repository on GitHub and choose **Code → Codespaces → Create codespace**, then run `npm ci` and `SYNAPSE_DATA_DIR=data/fixtures/demo npm run dev -- --hostname 0.0.0.0 --port 3019`, and open the forwarded port.

## Testing checklist

- `npm test`: all tests pass (live-AI tests use a stand-in model, so no key is needed).
- `npm run lint` and `npx tsc --noEmit`: no errors.
- `npm run build`: production build succeeds.
- Follow the **Walkthrough** below with the sample project, as Daniel, then the Bilingual Content Coordinator, then the Director.
- Optional: `npm run ai:check` with your own key, then `AI_MODE=live` (see above).

## What's in the package

| Path | What it is |
|---|---|
| `README.md` | This file: assumptions, setup, live AI, GitHub, walkthrough |
| `design.md` | The Synapse design system (colours, type, spacing, buttons, accessibility) |
| `app/`, `components/` | The Next.js workspace (pages, API routes, interface) |
| `lib/` | Workflow, checks, AI harness (replay and live), storage |
| `standard/` | The registered AI skills, templates and workflow rules |
| `data/fixtures/demo/` | Fictional demo reports, replayed AI answers and synthetic water-point data |
| `tests/` | Automated tests |
| `.env.example` | Settings to copy into `.env.local` |

## Storage and environment

| Variable | Purpose |
|---|---|
| `SYNAPSE_STORAGE` | `file` (default) or `postgres`; configured PostgreSQL failures never fall back to files |
| `SYNAPSE_DATA_DIR` | Dataset manifest, CSVs, inbox and replay responses; use `data/fixtures/demo` for a published demo |
| `SYNAPSE_RUNTIME_DIR` | File-mode state root; choose a new root for a separate local run |
| `AI_MODE` | `replay` (default: recorded answers, no key) or `live` (calls the model) |
| `ANTHROPIC_API_KEY` | Server-only key for `AI_MODE=live`; keep it in `.env.local` |
| `SYNAPSE_MODEL` | Claude model for live mode; default `claude-haiku-5-5` |
| `SYNAPSE_SEED` | `off` starts the demo without the sample Needs action work |
| `DATABASE_URL` | Server-only PostgreSQL connection; use a pooled Neon URL for Vercel |
| `SYNAPSE_NAMESPACE` | Stable deployment namespace; separates datasets and preserves state across deployment path changes |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Server-only Vercel-managed Upstash Redis REST connection |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Alternate names for the same Redis configuration |

Legacy `AQUIFER_DATA_DIR`/`AQUIFER_RUNTIME_DIR` are supported. Without an explicit data directory, local mode prefers an available challenge pack. Pack files, derivatives, runtime files and `.env*` are ignored and excluded from Vercel uploads. Only independently authored synthetic fixtures are published.

For PostgreSQL, set `DATABASE_URL` securely in your environment, run `npm run db:migrate` against a **direct** connection, then run the application with the pooled URL and `SYNAPSE_STORAGE=postgres`. Never put credentials in source, browser variables, command arguments, logs, or Git.

The initial PostgreSQL adapter stores validated JSON documents transactionally. A namespace advisory lock serializes state and audit writes across instances. Database triggers reject changes to report sources, evidence snapshots, exported snapshots, and audit events. This is a demo-scale adapter; normalized tables, authentication, tenant isolation and fine-grained authorization remain future work.

## Walkthrough

1. Open the Inbox: **Needs action** shows three sample reports, ordered by priority (P0 first). Hover a priority to see who set it and why. Open **Healthy Schools WASH (sample) · Q2 FY2026-27** (P0). Act as **Daniel** (preparer).
2. On **Checks & sources**, extract facts, clean the data and compare the two ways of counting working water points.
3. On **French**, click **Create checked French draft**. The English and French pages open side by side and the Assistant opens on the words the AI wasn't sure about.
4. Switch to the **Bilingual Content Coordinator**. Approve each flagged word, or decline it and type the fix; the French page updates as you go.
5. As Daniel, build the **FDF (English)** and **Fondation du Québec (French)** versions on **Funder draft**. Recorded attempts in other reports show a failed number check being corrected.
6. Edit a narrative with an unsupported number to see approval blocked. Correct and save it.
7. Switch to the **Director, International Programmes**: **Approve content**, then **Confirm export…** and choose PDF or Word.
8. Open **Activity** to see every attempt, decision, approval and export, each with a name.

### Skills, templates and profiles

- **Library → Skills** lists every registered skill with its owner, approver, risk tier, data classes and the workflow steps that use it. Each one opens on its own page and downloads as its exact `SKILL.md`; **Download register (.md)** exports the whole list.
- **+ New skill** is a five-step wizard (basics, ownership and risk, where it runs, instruction, review). It checks the draft as you go, saves it in this browser and downloads a `SKILL.md`. A reviewer places it at `standard/skills/<name>/SKILL.md`; it only runs once a developer names it in a workflow step.
- On **Workflow & rules** and **Templates**, every template and profile opens a visual page: where each number comes from, the sections a person approves, the export disclosure, and how a profile writes numbers and dates.

Content/evidence changes invalidate dependent approvals. Missing observations stay in the full-register denominator and block approval. Empty datasets display unavailable percentages. Export checks the exact approved revision; concurrent duplicate clicks create one immutable export.

## Performance and data access

- Next routes split by page; the evidence assistant is imported only when opened.
- Simultaneous identical browser GETs share one in-flight request, without retaining stale approvals.
- The report catalog reads all report summaries in one transaction instead of one transaction per record.
- The interface uses Inter, self-hosted at build time through `next/font` so visitors never contact Google Fonts, with system-font fallback. Source Sans 3 is still bundled as WOFF2 for the Astro site, with its OFL and pinned provenance preserved.
- HTTP compression is enabled; font assets have cache headers.
- Redis caches only saved evidence views, keyed by dataset, namespace, snapshot and filters, with a one-hour TTL. Its responses are schema checked. Unavailable/corrupt cache entries fall back to PostgreSQL; mutable/current views bypass caching. `X-Synapse-Cache` reports `hit`, `miss` or `bypass`.
- `/api/health` shows storage mode, AI mode and model, whether a key is set (never the key), and Redis configuration. Configuration alone does not prove Redis availability.

## API and MCP

Report operations live under `/api/reports`. The contextual questions endpoint returns verified source quotations and exact snapshot links; unmatched questions return an explicit unavailable answer. It is deterministic API retrieval, not a general chatbot.

`integrations/mcp/server.mjs` is an optional local, read-only stdio adapter for `list_reports`, `explain_report`, and `find_evidence`. See [its setup](integrations/mcp/README.md). It is not automatically installed in an agent and cannot approve or export reports.

## Verify and deploy

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build:all
```

The default suite skips real PostgreSQL tests. To run them, set `SYNAPSE_DATABASE_TEST=1` and a dedicated test `DATABASE_URL`, then run `npx vitest run tests/database/postgres.test.ts`. Tests use isolated namespaces and preserve audit history. The HTTP smoke test mutates fictional reports and creates logged exports; run it only against a designated demo:

```bash
node scripts/smoke-demo.mjs https://your-demo.example
```

To give every screen something to show, `npm run seed:demo -- <base-url>` walks the untouched demo reports to different stages through the same API: one received, one being cleaned, one with a draft, one waiting for the bilingual review, one approved and one exported. It uses the demo people, skips any report that already has progress, and logs every step like a person would.

Root `vercel.json` deploys Next.js. Set the server-only database and Redis variables in Vercel, plus `SYNAPSE_STORAGE=postgres`, `SYNAPSE_DATA_DIR=data/fixtures/demo` and a stable `SYNAPSE_NAMESPACE`. Review `.vercelignore` before every upload. No secrets, challenge pack or local session history belongs in a deployment.

For the separate static site, set `PUBLIC_WORKSPACE_URL`, run `npm run build:site`, then `node scripts/prepare-site-deploy.mjs`. Link `apps/site/dist` to its separate Vercel project and deploy it using the generated static configuration. This avoids inheriting the Next install/build commands.

Public demos are for fictional data only. Real use requires identity, access controls, retention and operational review. Analytics and real external intake are not enabled. Application licensing remains a team decision; third-party fonts retain their own licenses.

## Design

The look is documented in [`design.md`](design.md): colours adapted from the WaterAid Canada website (navy, blue, cream, bone white), Inter type, restrained glass, and plain-language rules for every button that can't be used yet.

Interface icons are from [Lucide](https://lucide.dev) (ISC licence), inlined in `components/icons.tsx` with their licence notice.
