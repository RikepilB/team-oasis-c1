# Aquifer — Team Oasis

A local, replay-based demonstration of a programme report becoming a sourced, checked, human-approved funder report in English and French.

The application preserves the original report, extracts facts with source quotes, computes water-point metrics in code, checks every numerical field, and requires separate human approval and export confirmation. The Québec template also requires review of its final French text.

All programme and funder data is fictional. Replay reads prepared responses from disk; the integrated application makes no live model calls and sends no email.

## Run locally

Use Node 20+ and npm.

```powershell
npm install
npm test
npm run dev -- --hostname 127.0.0.1
```

Open http://127.0.0.1:3000. A production check uses `npm run build`, then `npm start -- --hostname 127.0.0.1`.

No API key or internet connection is needed after dependencies are installed.

## Demo data and state

| Variable | Default | Purpose |
|---|---|---|
| `AQUIFER_DATA_DIR` | `data/pack` when its dataset manifest exists; otherwise `data/fixtures/demo` | Dataset manifest, CSVs, inbox and replay responses |
| `AQUIFER_RUNTIME_DIR` | `data/runtime` | Local records, immutable exports, evidence snapshots and audit log |

Each dataset has `dataset.json`, two CSVs, `inbox/<id>.txt` with a JSON sidecar, and `replay/<id>.json`. The original synthetic fixtures are committed and work without the challenge pack. They intentionally have different counts from the larger pack.

The pack and all derivatives remain gitignored. Copy authorised pack files from the team Drive; do not commit report text, recordings derived from it, supporter/gift data, keys or organiser-only material.

State is separated by dataset identity and content. Set a **new runtime directory** for a fresh demonstration; existing runs and exports stay intact.

```powershell
$env:AQUIFER_DATA_DIR = "data/fixtures/demo"
$env:AQUIFER_RUNTIME_DIR = "data/runtime/my-demo"
npm run dev -- --hostname 127.0.0.1
```

## Walkthrough

1. Open a report. Enter a fictional preparer such as **Casey** and an acting person.
2. Extract facts, review cleaning, validate both definitions, and create the checked French draft.
3. Build the FDF or Québec template. Each recorded template demonstrates a failed first attempt and a checked correction.
4. Change a narrative number to an unsupported value: its check turns red and approval is blocked. Correct it and save.
5. For Québec, a named bilingual reviewer confirms the final French text.
6. Enter a different approver, such as **Morgan**, and approve the content.
7. The same approver confirms export, then downloads the immutable Markdown revision.
8. Follow the evidence links and inspect Activity for attempts, checks, corrections, approval and export.

Changing content invalidates review and approval. Missing observations remain in the full-register denominator and block approval. Changing the standard requires regenerating and reviewing the draft. Named people are demo identities, not authentication.

## Development

- Next.js App Router, TypeScript, React, plain CSS/Tailwind, Zod, papaparse and Vitest.
- `lib/demo/` is the integrated replay application service. It reuses the Kijana data functions and the existing harness schemas, skill registry and privacy guard.
- Existing `lib/record/` and live/manual harness experiments are retained for continuity; the new API does not expose those legacy approval/provider paths.
- `standard/` contains the workflow, registered jobs, rules, profiles and two templates.
- `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build` are the verification gates.
- Shared team documents, review evidence and handoffs remain local under ignored `docs/`.

The app uses the Aquifer connected vector wordmark and system UI fonts. The wordmark's accompanying licence is in `public/aquifer-wordmark.LICENSE.txt`.

Private team project. Application licence remains a team decision. No deployment, real email, live AI, authentication or configuration administration is included in this milestone.
