# Synapse user manual

As of Nov 4, 2026. Covers commit `463c3f6` (Oct 27, 2026).

Synapse turns a partner's programme report into a checked, bilingual funder report that two different people approve before it leaves. Every number comes from code and links to its source; the AI only drafts words. All data in this build is fictional. A one-page guide for each job is in [job-guides.md](job-guides.md).

## Workflow

A report passes through three people in a fixed order: the preparer builds it, the bilingual reviewer checks the French, and a different person approves and exports it. Approving the content and confirming the export are two separately logged steps, and every step writes to the Activity log.

## People and roles

You pick who you are from the person menu at the bottom of the sidebar; there is no sign-in. Each role can do one part of the work, and the app offers a one-click switch when you try something your role can't do.

| Person | Role | Does | Can't |
|---|---|---|---|
| Daniel (Grants & Compliance Officer) | Preparer | Extracts facts, runs cleaning and checks, creates the French draft, builds and edits funder templates | Review French, approve or export |
| Grace (Programme Manager, Kijana) | Preparer | Same as Daniel | Same as Daniel |
| Bilingual Content Coordinator | Reviewer | Approves or declines each flagged French item, confirms the final French version | Prepare, approve or export |
| Director, International Programmes | Approver | Approves content, then confirms export | Approve a report they prepared |
| Director, Finance & Operations | Administrator | Owns the Settings page | Prepare, review, approve or export |

Two rules hold on the server whatever the menu says: the approver must be a different person from the preparer, and French must be reviewed before approval. Settings → Your profile also lets you type a custom name and role for a walkthrough.

## Getting around

The sidebar holds Workspace (your work), Library (what explains a number) and Recent reports, with your person menu and the Settings gear at the bottom. The top bar has search, the EN/FR switch, Guide (a one-minute tour) and the Assistant. Press `/` to search from anywhere.

| Screen | Where | Use it to |
|---|---|---|
| Inbox | Workspace | See every report received, by priority (P0 first), then nearest due date. Saved views: All reports, My reports, Needs action, Unassigned, Drafts, Completed |
| Reports | Workspace | Browse and filter all reports by status, project and funder |
| Approvals | Workspace | See what waits for an approval or an export |
| Templates | Workspace | Open a funder template's own page, or build and check a new one |
| Report page | Click any report | Do the work, in 7 tabs: Overview, Original, Funder draft, Checks & sources, French, Approvals, Activity |
| Files & sources | Library | The report sources stored on this computer and their saved evidence |
| Evidence | Library | Water points by priority group, from the cleaned monitoring data |
| Workflow & rules | Library | The 9 workflow steps, every rule that can block a report, and a page for each profile |
| Activity log | Library | The hash-chained log of every action, who did it and when |
| Prompts | Library | The instruction each AI job runs on |
| Skills | Library | The skills register (owner, approver, risk tier and data for each job) and the New skill wizard |
| Settings | Gear next to your name | Who you are acting as, and the people × actions table |

On the report page, the Approvals tab holds the action bar for the funder version you pick (FDF in English, Fondation du Québec in French). The Assistant on the right has two tabs: French review (decide flagged French items) and Ask (questions about this report, answered with links to the source).

## Step by step

One report takes three people and about a dozen clicks; each person works only in their own steps. Pick the person in the sidebar menu before you start.

**Preparer (Daniel or Grace)**

1. Open the report from the Inbox. On a fresh demo, Needs action holds three sample reports: start with Healthy Schools WASH (sample), marked P0. The Original tab shows the partner's text as received.
2. Checks & sources tab: click **Extract and verify facts**. Each fact shows its quote from the report; a fact whose value is not in its quote is blocked. On the sample report, steps 2 to 4 and the FDF draft are already done, and running Extract again restarts preparation.
3. Click **Review cleaning changes**. Read the highlights: status names mapped, dates put in order, visits with no water point removed.
4. Click **Validate this evidence**. The app compares the partner's claimed figure with the figure worked out from the data, under both functionality definitions. A gap shows as a warning.
5. French tab: click **Create checked French draft**. The app checks that every number survived the translation and flags the words the AI was not sure of.
6. Funder draft tab: pick FDF, click **Build funder draft**; then pick Fondation du Québec and do the same. Numbers are filled by code; the narrative is drafted.
7. Edit any narrative field and click **Save & check**. Saving clears any earlier review or approval of that version.

**Bilingual Content Coordinator**

1. Open the French tab. The English report and the French draft sit side by side as pages; flagged words are highlighted.
2. In the Assistant's French review tab, take each card under "Needs a decision": **Approve** keeps the word; **Decline** asks what is wrong and for the corrected French (pick a suggestion or type one). The French page updates at once.
3. When every item is decided and the numbers still match, click **Confirm bilingual review** under Final French funder report.

**Approver (Director, International Programmes)**

1. On the Approvals tab, pick the funder version and click **Approve content**. The app refuses if you prepared it, if a blocking check is red, or (Québec version) if the bilingual review does not cover the current revision.
2. Click **Confirm export…**, choose PDF or Word, and confirm. This is the second, separately logged step, and only the person who approved can do it.
3. Click **Download…** to get the same file again later; that isn't logged as a new export. Every file ends with a disclosure naming you and the approval date. Nothing is emailed: you send the file yourself.

Every click above writes a line to the Activity tab and the Activity log.

## Use cases

Twelve use cases run end to end in this build; each maps to a step above. Try them on the seven demo reports in the Inbox.

| # | Use case | Who | What they do | What they get |
|---|---|---|---|---|
| 1 | Turn a partner report into a funder report | Preparer | Extract, clean, validate, build the FDF version | A draft where every number is filled by code and linked to its source |
| 2 | Catch a wrong headline figure | Preparer | Validate on **demo-spring-q1** | A warning: the report claims a rate the data does not support (about 70%) |
| 3 | One set of facts, several formats | Preparer | Build FDF and Fondation du Québec from the same facts, or start from a preset | Same numbers in every format, no retyping |
| 4 | French version with a human check | Preparer, then Reviewer | Create the French draft; decide each flagged word | French text with numbers preserved and every unsure word decided by a person |
| 5 | Fix a translation live | Reviewer | Decline a flagged word with a note and the corrected French | The French page changes at once; the fix and the note are logged |
| 6 | Approve without self-approval | Approver | Approve content, then confirm export | Two logged steps by a different person than the preparer |
| 7 | Hand a funder the file | Approver | Confirm export as PDF or Word | A file with provenance and a disclosure naming the approver and date |
| 8 | Answer "where does this number come from?" | Anyone | Ask the Assistant, or click See the points behind this number | An answer with links to the quote, fact or water-point rows |
| 9 | Decide which water points to fix first | Programme staff | Open Library → Evidence | Water points grouped by priority, from the cleaned monitoring data |
| 10 | Show an auditor what happened | Administrator or anyone | Open the Activity log | Every action with person and time, in a hash chain that shows tampering |
| 11 | Register a new AI job | The job's owner | Library → Skills → New skill: five short steps, then download the SKILL.md | A draft checked as you go; it runs only after a reviewer adds it and a developer names it in a workflow step |
| 12 | See where a template's numbers come from | Anyone | Templates → open a template, or open a profile under Workflow & rules | Each number's source, the sections a person approves, the export disclosure, and how numbers and dates are written |

The workflows these support, from the workload inventory: I2 donor reporting (use cases 1–3, 6–8) and C4 French translation (4–5).

## Rules the app enforces

A red blocking check stops approval; a warning does not. Rules are listed with their ids under Library → Workflow & rules.

| Rule | What it checks | Effect |
|---|---|---|
| Quotes match the original | Every fact's quote appears word for word in the report | Blocks |
| Fact values match their quotes | The number in a fact is in its quote | Blocks |
| Reported functionality definition | The partner's claimed rate vs the rate from the data (0.5-point tolerance) | Warns only |
| French preserves every number | The French text has the same numbers as the English | Blocks |
| Narrative numbers have valid citations | Every number in drafted text points at a fact | Blocks |
| Numeric fields equal their sources | Each template number equals its fact, metric or constant | Blocks |
| All registered points have an observation | Every water point has a monitoring visit | Blocks |
| Preparer is not the approver | Approver name differs from preparer name | Blocks |
| Personal-data guard | Email addresses, phone numbers and supporter IDs in any text sent to the AI. It does not detect names | Blocks the AI call |
| Flagged French items decided | Every flagged item is approved or declined before the bilingual review | Blocks the review |

Editing or regenerating a funder version clears its review and approval, so an approval always covers the exact text exported. Each export is stored once per revision and can't be changed.

## Templates

Two funder formats are approved and in use (FDF in English, Fondation du Québec in French); anyone can draft more in the builder, but a draft only becomes a standard when a developer adds its file and the team reviews it.

Each approved template opens its own page: where each number comes from, the sections a person writes and approves, the disclosure on every export, and the profiles that use it. Each profile (English or French) has a page too, under Workflow & rules, showing how it writes percentages, counts and dates.

| Preset | Language | Audience | Numbers | Sections |
|---|---|---|---|---|
| FDF · quarterly report | English | FDF | 6 | Progress; Definition and limitations |
| Fondation du Québec · rapport trimestriel | French | Fondation du Québec | 6 | Progrès; Définition et limites |
| Donor update · one page | English | Individual donors | 2 | Headline; What your support did; What comes next |
| Board summary | English | Board of directors | 4 | Status against targets; Risks; Decisions requested |
| Government grant · results report | English | Public funder | 6 | Results this period; Data quality and limitations |

To make a new format:

1. Templates → **New template**, or **Duplicate as draft** on a preset.
2. Fill Basics (name, language, audience), then **Add number** for each figure, picking its source from the list, and **Add section** for each piece of text with guidance for the writer.
3. Watch the Checks panel until it says Ready for review, then **Save draft** (kept in this browser only) and **Download JSON**.
4. A developer runs `npm run template -- check <file>` and adds it under `standard/templates/` after review.

The checks refuse a template whose numbers do not come from a known source, whose sections are optional, or whose disclosure lacks `{approver}` and `{date}`, so every export still names who approved it.

## Troubleshooting

Most refusals mean the step belongs to someone else or an earlier step is not done; the message names which.

| You see | Why | Do this |
|---|---|---|
| "Only the … can …" with a Switch link | Your role can't do this step | Click Switch to …, or pick the person in the sidebar |
| The approver must be a different person from the preparer | You prepared this version | Switch to the Director, International Programmes |
| Decide every flagged French item, with all numbers preserved | Items are still open, or a fix changed a number | Finish the French review cards; if a number changed, Recreate checked French draft |
| A fix changed a number. Recreate the French draft before the review | A corrected word altered a figure | Recreate the French draft (this clears the item decisions) |
| Current final French text requires bilingual human review | The Québec version changed after its review | Ask the Bilingual Content Coordinator to confirm the review again |
| The same approving person must confirm export | Someone else approved, or the text changed after approval | Switch to the approver, or approve the current revision first |
| Blocked by checks | A blocking rule is red on this funder version | Open Checks & sources or Funder draft, fix the field, Save & check |
| Build this funder version first | No draft exists for the funder you picked | Funder draft → Build funder draft |
| Already approved by … | This revision is approved | Nothing to do; confirm export as that person |
| Audit chain broken | The activity log was altered outside the app | Stop and tell the team; do not export |

On **fixture-q1**, the saved French draft predates review items: click Recreate checked French draft first.

## Limits of this demo

This build is a working demo on fictional data, not a system for real reports yet.

- **Recorded AI.** The AI steps replay recorded responses for the seven demo reports; a new report can't be processed until live AI is switched on and tested.
- **No upload.** Reports enter only as demo files; PDF, Word and Excel upload is not built.
- **No sign-in.** The person menu stands in for an account; it is not a permission system.
- **Names not screened.** The personal-data guard blocks email addresses, phone numbers and supporter IDs before any AI call. It doesn't detect names, so report writers leave them out.
- **Drafts stay in your browser.** New skills and templates you draft are saved only in this browser until a reviewer adds their file to the standard.
- **Warning only.** A gap between the claimed and the measured functionality rate does not block approval.
- **Not built yet:** inbox triage (suggested category, approver and priority), duplicate detection, sending a report back with a reason, rejecting or closing a report, SMS status coding, and French text for the review reasons.
- **Québec fields.** A reviewer's French fix changes the translated programme report, not the Fondation du Québec funder fields.
- **Fictional data.** All names and figures are fictional (Water Care, Kijana, FDF, Fondation du Québec).
