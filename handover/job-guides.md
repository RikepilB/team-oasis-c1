# Job guides

One page for each role. The full detail is in the [user manual](user-manual.md).

## Preparer

You turn a partner's programme report into checked funder drafts. Pick **Daniel** or **Grace** in the person menu, then open the report from **Inbox → Needs action** (P0 first).

**Your steps**

1. **Original** tab: read the report as received.
2. **Checks & sources** tab: click **Extract and verify facts**. A fact whose number isn't in its quote is blocked.
3. Click **Review cleaning changes**, then **Validate this evidence**. A gap between the two ways of counting is a warning, not a block.
4. **French** tab: click **Create checked French draft**, then tell the bilingual reviewer.
5. **Funder draft** tab: **Build funder draft** for FDF, then for Fondation du Québec. Code fills every number.
6. Edit a narrative if needed and click **Save & check**. This clears any earlier review or approval.

**What stops you**

| You see | Do this |
|---|---|
| Blocked by checks | Fix the field on Checks & sources or Funder draft, then Save & check |
| Build this funder version first | Funder draft → Build funder draft |
| "Only the … can …" | That step belongs to another role |

Never type a number the report doesn't support. Leave people's names out: Synapse blocks email addresses, phone numbers and supporter IDs, but not names.

## Bilingual reviewer

You decide every French word the AI wasn't sure about, then confirm the French version. Pick **Bilingual Content Coordinator** in the person menu once the preparer has created the French draft.

**Your steps**

1. Open the report, then the **French** tab. English and French sit side by side, with flagged words highlighted.
2. In the Assistant's **French review** tab, take each card under "Needs a decision". **Approve** keeps the word. **Decline** asks what is wrong and for the corrected French. The page updates at once.
3. When every card is decided, click **Confirm bilingual review** under Final French funder report.

**What stops you**

| You see | Do this |
|---|---|
| Decide every flagged French item, with all numbers preserved | Finish the cards |
| A fix changed a number. Recreate the French draft before the review | The preparer recreates the French draft, which clears your decisions |
| Current final French text requires bilingual human review | The Québec version changed after your review. Confirm it again |

Your fix changes the translated programme report, not the Fondation du Québec funder fields. Every decision and note is logged with your name.

## Approver

You approve the content and then confirm the export, in two logged steps. You can't approve a report you prepared. Pick **Director, International Programmes** in the person menu. **Approvals** in the sidebar lists what is waiting.

**Your steps**

1. Open the report, then the **Approvals** tab, and pick FDF (English) or Fondation du Québec (French).
2. Read the draft and its checks, then click **Approve content**.
3. Click **Confirm export…**, choose PDF or Word, and confirm. Only the person who approved can do this.
4. Send the downloaded file yourself: Synapse emails nothing. **Download…** gets the same file again later.

**What stops you**

| You see | Do this |
|---|---|
| The approver must be a different person from the preparer | Someone else must approve this version |
| Blocked by checks | Send the report back to the preparer |
| Finish the bilingual review under French version first | The Québec version needs the bilingual review first |
| The same approving person must confirm export | Switch to the approver, or approve the current revision |

Editing a version after approval clears the approval, so you always approve the exact text exported. Every export ends with a disclosure naming you and the approval date.

## Administrator

You look after who can do what and check the record of what happened. You don't prepare, review, approve or export reports. Pick **Director, Finance & Operations** in the person menu.

**Your tasks**

1. **Settings** (the gear next to your name): read the people × actions table, which shows what each role can do.
2. **Library → Activity log**: check who did what and when. The log is hash-chained, so a change made outside the app shows as "Audit chain broken".
3. **Library → Skills**: check that every AI job has an owner, an approver and a risk tier. **Download register (.md)** exports the list for a review.
4. If you ever see "Audit chain broken", stop all exports and tell the team.

**Limits in this demo**

- There is no sign-in. The person menu stands in for an account, so it isn't a permission system yet. Real use needs sign-in and a security review first.
- The list of people lives in the code, so adding or removing someone needs a developer.
