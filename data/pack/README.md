# data/pack: challenge pack files (not committed)

Everything here except this README is gitignored. The files are the organisers' fictional C1 pack,
marked "for hackathon use only", so each builder copies them from the team Drive
(`Provided Documents/5.Sandbox Data/`).

| Put here | From the Drive | Used by |
|---|---|---|
| `kijana_water_points.csv` | `5.5 Kijana Programme Data/` | Feature 2 (register, 320 points) |
| `kijana_monitoring_visits.csv` | `5.5 Kijana Programme Data/` | Feature 2 (latest status per point) |
| `inbox/kijana-q4-fy2025-26.txt` | text of Report 1 in `5.6 Kijana Quarterly Reports.pdf` | Feature 1 inbox item |
| `inbox/kijana-q1-fy2026-27.txt` | text of Report 2 in the same PDF | Feature 1 inbox item |

Each inbox `.txt` has a sidecar `.json` with the same base name, for example
`inbox/kijana-q1-fy2026-27.json`:

```json
{ "project": "Kijana Resilient Towns", "funder": "FDF", "received_date": "2026-07-29",
  "source_file": "inbox/kijana-q1-fy2026-27.txt", "source_location": "5.6 Kijana Quarterly Reports, Report 2",
  "period": "Q1 FY2026-27", "period_end": "2026-06-30" }
```

Report 1 uses `received_date` `2026-04-22`, `period` `Q4 FY2025-26`, `period_end` `2026-03-31`.
`period_end` sets the water point cut-off, so the template's numbers depend on it (plan Task 3). Tests that need these files skip when they are missing;
the committed fixtures in `data/fixtures/` cover the logic.

Never add `supporters.csv` or `gifts.csv`: they hold Restricted fields (`relationship_notes_RESTRICTED`)
and the demo does not need them.
