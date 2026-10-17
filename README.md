# Synapse — Team Oasis

A synthetic reporting demo: programme report → sourced facts → checked numbers → English/French funder report → human review → immutable Markdown export.

- Workspace: https://synapse-oasis-one.vercel.app
- Astro introduction: https://synapse-oasis-site.vercel.app

The workspace uses Next.js App Router, React, TypeScript and Node.js API routes. Astro serves the small static introduction. PostgreSQL on Neon persists documents, evidence snapshots, approvals, exports and hash-chained audit events. Upstash Redis accelerates immutable evidence views; it never supplies approval or export decisions.

All programme, funder and actor data is fictional. Replay uses authored fixture responses. There are no live model calls, real email intake, authentication, voice, or connected project-management service. Demo names do not establish identity or permissions. Use fictional names only.

## Local setup

Use Node.js 24 LTS and npm. After installing dependencies, no API key or network is required for file-storage mode.

```powershell
npm ci
$env:SYNAPSE_DATA_DIR = "data/fixtures/demo"
npm run dev -- --hostname 127.0.0.1 --port 3019
```

Open http://127.0.0.1:3019. `npm run dev:site` opens the Astro introduction on port 3020. `PUBLIC_WORKSPACE_URL` sets its destination when building the site.

## Storage and environment

| Variable | Purpose |
|---|---|
| `SYNAPSE_STORAGE` | `file` (default) or `postgres`; configured PostgreSQL failures never fall back to files |
| `SYNAPSE_DATA_DIR` | Dataset manifest, CSVs, inbox and replay responses; use `data/fixtures/demo` for a published demo |
| `SYNAPSE_RUNTIME_DIR` | File-mode state root; choose a new root for a separate local run |
| `DATABASE_URL` | Server-only PostgreSQL connection; use a pooled Neon URL for Vercel |
| `SYNAPSE_NAMESPACE` | Stable deployment namespace; separates datasets and preserves state across deployment path changes |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Server-only Vercel-managed Upstash Redis REST connection |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Alternate names for the same Redis configuration |

Legacy `AQUIFER_DATA_DIR`/`AQUIFER_RUNTIME_DIR` are supported. Without an explicit data directory, local mode prefers an available challenge pack. Pack files, derivatives, runtime files and `.env*` are ignored and excluded from Vercel uploads. Only independently authored synthetic fixtures are published.

For PostgreSQL, set `DATABASE_URL` securely in your environment, run `npm run db:migrate` against a **direct** connection, then run the application with the pooled URL and `SYNAPSE_STORAGE=postgres`. Never put credentials in source, browser variables, command arguments, logs, or Git.

The initial PostgreSQL adapter stores validated JSON documents transactionally. A namespace advisory lock serializes state and audit writes across instances. Database triggers reject changes to report sources, evidence snapshots, exported snapshots, and audit events. This is a demo-scale adapter; normalized tables, authentication, tenant isolation and fine-grained authorization remain future work.

## Walkthrough

1. Open a report from Inbox or Reports. Use fictional preparer **Casey**.
2. Extract facts, inspect cleaning, compare both functionality definitions, and create the checked French draft.
3. Build FDF English or Québec French. Recorded attempts demonstrate a numerical failure and one checked correction.
4. Edit a narrative with an unsupported number to see approval blocked. Correct and save it.
5. A bilingual reviewer such as **Camille** confirms the final French funder text and its meaning.
6. A different actor, such as **Morgan**, approves the current content revision.
7. The approving person separately confirms export, then downloads the approved Markdown with sources and disclosure.
8. Follow the saved evidence links and inspect Activity for attempts, corrections, approvals and exports.

Content/evidence changes invalidate dependent approvals. Missing observations stay in the full-register denominator and block approval. Empty datasets display unavailable percentages. Export checks the exact approved revision; concurrent duplicate clicks create one immutable export.

## Performance and data access

- Next routes split by page; the evidence assistant is imported only when opened.
- Simultaneous identical browser GETs share one in-flight request, without retaining stale approvals.
- The report catalog reads all report summaries in one transaction instead of one transaction per record.
- Source Sans 3 is bundled as WOFF2, with its OFL and pinned provenance preserved.
- HTTP compression is enabled; font assets have cache headers.
- Redis caches only saved evidence views, keyed by dataset, namespace, snapshot and filters, with a one-hour TTL. Its responses are schema checked. Unavailable/corrupt cache entries fall back to PostgreSQL; mutable/current views bypass caching. `X-Synapse-Cache` reports `hit`, `miss` or `bypass`.
- `/api/health` shows storage mode and Redis configuration without exposing credentials. Configuration alone does not prove Redis availability.

## API and MCP

Report operations live under `/api/reports`. The contextual questions endpoint returns verified source quotations and exact snapshot links; unmatched questions return an explicit unavailable answer. It is deterministic API retrieval, not a general chatbot.

`integrations/mcp/server.mjs` is an optional local, read-only stdio adapter for `list_reports`, `explain_report`, and `find_evidence`. See [its setup](integrations/mcp/README.md). It is not automatically installed in an agent and cannot approve or export reports.

## Verify and deploy

```powershell
npm test
npm run lint
npx tsc --noEmit
npm run build:all
```

The default suite skips real PostgreSQL tests. To run them, set `SYNAPSE_DATABASE_TEST=1` and a dedicated test `DATABASE_URL`, then run `npx vitest run tests/database/postgres.test.ts`. Tests use isolated namespaces and preserve audit history. The HTTP smoke test mutates fictional reports and creates logged exports; run it only against a designated demo:

```powershell
node scripts/smoke-demo.mjs https://your-demo.example
```

Root `vercel.json` deploys Next.js. Set the server-only database and Redis variables in Vercel, plus `SYNAPSE_STORAGE=postgres`, `SYNAPSE_DATA_DIR=data/fixtures/demo` and a stable `SYNAPSE_NAMESPACE`. Review `.vercelignore` before every upload. No secrets, challenge pack or local session history belongs in a deployment.

For the separate static site, set `PUBLIC_WORKSPACE_URL`, run `npm run build:site`, then `node scripts/prepare-site-deploy.mjs`. Link `apps/site/dist` to its separate Vercel project and deploy it using the generated static configuration. This avoids inheriting the Next install/build commands.

Public demos are for fictional data only. Real use requires identity, access controls, retention and operational review. Analytics and real external intake are not enabled. Application licensing remains a team decision; third-party fonts retain their own licenses.
