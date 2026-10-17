# Evidence Ledger — Team C1, The Water Challenge

Working component for **Track C1: Reimagining an AI-Enabled Water Care Canada**
(The Water Challenge, build day 17 Oct 2026, TMU). Private team repository.

**The idea in one line:** information comes in once, gets checked once, one approved AI tool does
the repeated jobs (one written instruction per job), plain code does every number, and a person
approves everything before it goes out.

The app has two features that share one checked record:

1. **Inbox → funder report.** A Kijana quarterly report arrives, becomes a Fact Record, is cleaned,
   gets a French version with unsure words flagged, fills a funder's template, and is approved and
   sent in two logged steps.
2. **Water points that need fixing first.** A priority list from the programme data and the two ways
   of counting "functional" side by side (70.3% fully working vs 85.3% including partly working).
   The funder report's functionality number links to the points behind it.

All data is the organisers' fictional pack plus our own labelled synthetic data. Water Care, Kijana
and every funder are fictional; do not use real organisation names in the app or the deck.

## Docs

Requirements, architecture, the build plan and the team rules are not in this repo. The team shares
them through the Drive; keep your local copy in `docs/` (git-ignored, so it never gets committed).

## Setup (each builder laptop)

1. Node 20 or newer, npm, Git.
2. Clone, then `npm install` (after Task 1 has scaffolded the app).
3. Copy the pack files listed in [data/pack/README.md](data/pack/README.md) from the team Drive.
4. Create `.env.local` (see Environment). Never commit it, paste it in chat or show it on screen.
5. `npm test`, then `npm run dev` → http://localhost:3000.

## Environment

| Variable | Values | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | key from the team's approved account | Only needed when `AI_MODE=live` |
| `AI_MODE` | `replay` (default) or `live` | `replay` returns recorded AI responses from `data/fixtures/ai/` so the demo runs offline |
| `STATUS_CUTOFF` | `2026-06-30` | Latest-visit cut-off for water point status (end of the Q1 FY2026–27 report period) |

## Team workflow

- `main` is the demo branch. Work on `feat/<task>` branches; merge only with tests green.
- One integrator merges to `main` (proposed: Richard). Feature freeze **16:30**.
- Never commit pack data, keys, `.env*` or organiser-only material.

## Status

Licence: not chosen yet (private until after judging; the team decides whether to open-source).
