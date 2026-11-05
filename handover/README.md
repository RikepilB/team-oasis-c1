# Hand-over documents

Everything a new owner needs to run Synapse and teach people to use it. These documents describe the app as of commit `463c3f6` (Oct 27, 2026). All data in the app is fictional.

| Document | For | What it covers |
|---|---|---|
| [setup-run-test.md](setup-run-test.md) | Whoever installs or maintains it | Install, run the demo, check it, run the tests, optional live AI and hosting |
| [user-manual.md](user-manual.md) | Everyone who uses it | Screens, roles, the step-by-step flow, rules, templates, troubleshooting, limits |
| [job-guides.md](job-guides.md) | Each person in a role | One page each for the preparer, bilingual reviewer, approver and administrator |

The design system is in [`../design.md`](../design.md). The code is under the MIT licence ([`../LICENSE`](../LICENSE)). Fonts and icons keep their own licences (see the main README).

## Before any real report goes in

- **No sign-in.** A person menu stands in for accounts. Real use needs sign-in, access control and a security review.
- **Names aren't screened.** The personal-data guard blocks email addresses, phone numbers and supporter IDs before any AI call. It doesn't detect names.
- **Live AI is untested.** Live mode is built for the Anthropic API, but the team never tested it end to end with a real key. The demo replays recorded answers.
- **Never tested on real reports.** The demo data is modelled on the challenge pack's fictional organisation, Water Care Canada.
- **Ownership.** The repository sits on a team member's personal GitHub account until a new owner is named.
