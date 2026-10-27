# Synapse Design System

Design system for Synapse, the Water Care Canada web app (C1 hackathon). Water Care is the pack's fictional organisation. Synapse takes its colour mood and page rhythm from the WaterAid Canada website, but not its logo, typeface, photography or wording (see Inspiration).

Version 3.9. New in 3.9: traffic-light priorities (P0 / P1 / P2, with who set them, when and why), lists ordered by priority then due date, a plain white table header and taller rows (Notion/Jira calm), and the next step shown under each status. From 3.8: Perplexity-calm spacing (fewer lines, more air), Lucide line icons, blue for every highlight and progress mark, green and red only for results (approved / declined), outlined tab counts, a blue row highlight, a simple blue segmented text-size control, compact 40px filters, and a roomier action bar. From 3.7: a neutral white (`#FEFEFE`) on a cool, site-like canvas (`#F3F5F8`); one button system (blue action buttons, raised white tools); stronger glass on floating layers and raised cards; one 20px icon size; and folded sidebar groups that open the sidebar when clicked. From 3.6: page titles at 32px and reading text at 16px, a goal-gradient progress bar with locked steps, unavailable buttons with a lock and a dashed edge in every state, one tooltip at a time, and a text-size control the same height as the language menu. From 3.5: an even whiter bone (`#FEFEFD`), a text-size control in the top bar, roomier dropdowns with a clear 3:1 edge, "Guide" written first with the ? after it, and the Assistant closed until you open it. From 3.4: a lighter, whiter bone (`#FDFCFA`), full-width pages beside a slimmer sidebar, a folding "Recent reports" menu, the "Guide" button, a "Sample data" chip, and plainer wording. From 3.3: a navy, blue and cream palette adapted from the WaterAid Canada site; bolder, larger headings; cream statistic cards; and light project-management structure in the inbox (owners, due dates, "My reports"). Glass, rounded corners, Inter and everything from 3.2 stay.

The tokens live in `packages/design-tokens/tokens.css`. The app-wide styling that applies them lives in `components/synapse-theme.css`, which loads last. Shared building blocks (`GuardedButton`, `Tip`, `BackBar`, `ExportDialog`) are in `components/ui.tsx`.

## Inspiration: WaterAid Canada website

The look takes cues from wateraid.org/ca, adapted for a working tool rather than a fundraising site.

| From the site | In Synapse |
|---|---|
| Deep navy text (`#151435`) | `navy-900`, the same hex |
| Muted grey-navy (`#44435D`) | `navy-600`, the same hex |
| Bright blue for headings, links and buttons (`#006BD9`) | `blue-700` `#004FA3`, darkened to pass 7:1, and used only for actions and cues. Headings stay navy |
| Cream "The facts" statistic cards (`#F8F0E4`) | `cream` statistic cards with a big bold number |
| Big, bold headings | 40px / 28px headings at weight 700 |
| Generous white space between sections | The 4–96px spacing scale |

Not borrowed: the logo, the typefaces (Synapse uses Inter), the lime Donate green (`#D6FF00`), square corners and flat panels (Synapse keeps rounded corners and restrained glass), documentary photography, and any wording. WaterAid is a real charity; Synapse is built for the pack's fictional Water Care and must not look like an official WaterAid product.

## Principles

- **Calm and clear.** A reporting workspace with light project-management structure (owners, due dates, saved views), not a task board.
- **Few colours, one meaning each.** Four colour families only. Each status colour means one thing across the whole app.
- **Space does the work.** Groups are separated by space and a hairline, not by boxes, fills or colour.
- **Nothing fails silently.** Anything a person can't click says why and what to do next.
- **Never stuck.** Every nested page has a visible way back.
- **Every number leads to its source.** Numbers are styled as clickable and open the Fact Record behind them.
- **Bilingual by default.** Layouts leave room for French, which runs about 20–30% longer than English.
- **A person decides.** Anything waiting for a human is shown clearly and never auto-completes.

## Colour

Four families, 14 colour tokens, plus three line tokens. No other colours. Pure white (`#FFFFFF`) is not used anywhere; bone white replaces it.

### 1. Surfaces (bone and cream)

| Token | Hex | Use |
|---|---|---|
| `bone-50` | `#FEFEFE` | Neutral white, a hair off pure white, like the WaterAid site's pages. Cards, inputs, the base of every glass panel, text on blue buttons |
| `cream` | `#F8F0E4` | Statistic cards, table headers, row hover, disabled buttons, inset wells |
| `bone-200` | `#F3F5F8` | Cool light grey-blue page canvas behind the glass, echoing the site |

### 2. Navy (text)

| Token | Hex | Use |
|---|---|---|
| `navy-900` | `#151435` | Body text, headings, nav items, secondary buttons, tooltip background |
| `navy-600` | `#44435D` | Labels, sources, timestamps, disabled text |

### 3. Blue (the only brand hue, used rarely)

| Token | Hex | Use |
|---|---|---|
| `blue-900` | `#003E80` | Primary button hover and pressed |
| `blue-700` | `#004FA3` | The one primary button, links and clickable numbers, active nav bar, active tab, focus ring, logo mark |
| `blue-100` | `#D6E4F5` | The soft glow in the page canvas only |

`blue-700` is the site's `#006BD9` darkened so that blue text passes 7:1 on bone and cream. The site's lime Donate green is not used.

The 3.2 names still work as aliases in `tokens.css` (`ink-900` → `navy-900`, `lake-700` → `blue-700`, `bone-100` → `cream`, and so on), so older styles pick up the new palette automatically. New styles use the 3.3 names.

### 4. Status (three meanings only)

| Meaning | Text token | Hex | Chip fill | Hex |
|---|---|---|---|---|
| Needs a person | `status-attention` | `#6B4507` | `status-attention-fill` | `#F2EEE6` |
| Fast-track water points only | `status-urgent` | `#8A2A24` | `status-urgent-fill` | `#F4EDE8` |
| Done, approved, working | `status-done` | `#21543E` | `status-done-fill` | `#EEEFE9` |

### Lines

| Token | Value | Use |
|---|---|---|
| `hairline` | `rgba(21,20,53,.08)` | Dividers between sections and rows |
| `line-soft` | `rgba(21,20,53,.12)` | Card and input borders |
| `line-strong` | `rgba(21,20,53,.45)` | Secondary button border, dashed disabled border |
| `control-border` | `#7D7C8E` | Edge of every input and dropdown: at least 3:1 against bone, cream and the canvas (WCAG 1.4.11) |

### Blue is rare

Blue is a cue, not a decoration. On any screen it should cover **well under 3%** of the area. A good test: squint at the screen; you should be able to count the blue spots on one hand.

Blue is allowed for:
- the **one primary button** on a screen (filled `blue-700`, `bone-50` text, hover `blue-900`)
- the **active nav item** (a 2px bar on the left; the text stays `navy-900`, weight 500)
- the **active tab** (text and a 2px underline)
- **links and clickable numbers** (`blue-700`)
- the **focus ring**
- the **logo mark** (the wordmark is `navy-900`)

Blue is never used for:
- the sidebar, top bar, any panel, card or dialog background
- headings, eyebrows, labels or body text
- icons in the nav (they are `navy-600`)
- disabled buttons (bone, see Buttons)
- secondary buttons such as "Assistant", "Open guide", "Cancel"
- selected states in lists or radio cards (use a navy border and `bone-50`)

### Colour rules

- Amber-brown always means "a person needs to act".
- Red-brown is only for the fast-track water points. Form errors use the attention colour and a message.
- Never use colour alone. Every status has a label and an icon too.
- Don't add new accents for new screens; use navy first, blue only if it is one of the allowed cues above.

## Depth: glass, neumorphism and shadow (restrained)

Three depth tools. Each has one job, and a screen uses each sparingly.

| Tool | Job | Where | Never |
|---|---|---|---|
| **Glass** (`rgba(254,254,254,.62)`, blur 22px, saturate 150%) | Things that float over content | Top bar, sidebar, assistant drawer, floating action bar, dialogs | Cards in the page, tables, forms, anything inside another glass |
| **Neumorphism** (`neu-raised`, `neu-raised-sm`, `neu-inset`) | Cards, tools and wells: raised for panels, cards and tool buttons; inset for text fields, the progress track and a pressed tool | Metric (count) cards: raised. "Next step" well and search: inset | Buttons, inputs other than search, text blocks, more than one row of cards |
| **Soft shadow** | Ordinary cards | Report panels, cards on the canvas | Stacked shadows, coloured shadows (shadows are navy at low opacity) |

### Glass recipe

```css
.glass {
  background: rgba(254, 254, 253, 0.72);            /* --glass-bg */
  backdrop-filter: blur(18px) saturate(120%);       /* --glass-blur */
  -webkit-backdrop-filter: blur(18px) saturate(120%);
  border: 1px solid rgba(254, 254, 253, 0.6);       /* --glass-border */
  box-shadow: inset 0 1px 0 rgba(254, 254, 253, .7), var(--shadow-soft);
  border-radius: 20px;                              /* --radius-glass */
}
```

Rules:
- **One layer only.** Never glass on glass. Content inside glass sits on solid `bone-50`.
- **Fallback:** solid `bone-50` where `backdrop-filter` isn't supported or the user prefers reduced transparency.

```css
@supports not (backdrop-filter: blur(1px)) { .glass { background: #FEFEFD; } }
@media (prefers-reduced-transparency: reduce) { .glass { background: #FEFEFD; backdrop-filter: none; } }
```

### Neumorphism recipe

```css
--neu-raised: 6px 6px 16px rgba(21,20,53,.06), -6px -6px 16px rgba(254,254,253,.9);
--neu-inset:  inset 2px 2px 6px rgba(21,20,53,.07), inset -2px -2px 6px rgba(254,254,253,.9);
```

Keep it soft: the dark side never goes above 7% navy. Raised cards lift to `--shadow-lift` on hover by 1px; nothing bounces.

### Shadows

| Token | Value |
|---|---|
| `shadow-soft` | `0 1px 2px rgba(21,20,53,.04), 0 8px 24px rgba(21,20,53,.06)` |
| `shadow-lift` | `0 2px 6px rgba(21,20,53,.06), 0 18px 48px rgba(21,20,53,.10)` (hover, tooltips, dialogs) |

### Page canvas

```css
body {
  background:
    radial-gradient(40rem 30rem at 15% 10%, #DCE8F5 0%, transparent 70%),  /* blue-100 glow */
    radial-gradient(36rem 28rem at 85% 90%, #F8F0E4 0%, transparent 70%),  /* cream glow */
    #F5F4F1;                                                               /* bone-200 */
}
```

## Contrast

Checked against the worst case: glass over the blue glow (about `#F4F6F9`).

| Text | On `bone-50` | On `cream` | On glass (worst case) | On `bone-200` |
|---|---|---|---|---|
| `navy-900` | 17.3 | 15.7 | 16.4 | 15.7 |
| `navy-600` | 9.3 | 8.4 | 8.8 | 8.4 |
| `blue-700` (links, active) | 7.7 | 7.0 | 7.3 | 7.0 |
| `status-attention` | 8.3 | 7.5 | 7.8 | 7.5 |
| `status-urgent` | 8.4 | 7.6 | 8.0 | 7.6 |
| `status-done` | 8.5 | 7.7 | 8.1 | 7.7 |
| `bone-50` on `blue-700` (buttons) | 7.7 | | | |
| `bone-50` on `blue-900` (button hover) | 10.2 | | | |
| `bone-50` on `navy-900` (tooltips) | 17.3 | | | |

All text reaches at least 7:1 on every surface, including the lighter canvas.

## Type

**Inter** for all interface text, weights 400, 500, 600 and 700, with Apple system fallbacks. The WaterAid site's typefaces are not used:
`"Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif`.

Headings are big and bold, like the WaterAid site, and slightly tightened (negative letter-spacing), like Apple's product pages; body text is not. Headings are always `navy-900`, never blue.

| Semantic role | Element / token | Weight | Size / line height | Letter-spacing |
|---|---|---|---|---|
| Page title | `h1` / `--type-page-title` | 700 | 32 / 40px | −0.025em |
| Section heading | `h2` / `--type-section` | 700 | 24 / 32px | −0.02em |
| Subsection / card heading | `h3` / `--type-subsection` | 600 | 18 / 26px | −0.015em |
| CTA label | button / `--type-cta` | 500 | 16 / 24px | 0 |
| Body paragraph | `p` / `--type-body` | 400 | 16 / 24px | 0 |
| Small interface text | `--type-small` | 400 or 500 | 14 / 20px | 0 |
| Eyebrow | `.eyebrow` | 600, caps | 12 / 16px | +0.08em |
| Statistic number | `.count-card strong` | 700, tabular | 32 / 40px | −0.03em |
| Caption / metadata | `--type-caption` | 400 | 12 / 16px | 0 |
| Tooltip | `.tip` | 400 | 13 / 18px | 0 |

Rules:
- One `h1` per page; `h2` for sections; `h3` inside them. Don't use a heading tag to get a size.
- Status meaning and required instructions are never only in caption text.
- `font-variant-numeric: tabular-nums` for metrics and numeric columns.
- Long French strings wrap; never shrink body text to fit.
- Page titles wrap at their natural break ("Spring protection ·" / "Q1 FY2026-27"), never inside a period like "FY2026-27".

## Spacing and shape

A 4px-based scale with large steps at the top, so pages breathe like Apple's site. Use the big steps between sections and the small steps inside a component; never invent in-between values.

| Token | Value | Typical use |
|---|---|---|
| `space-1` | 4px | Icon to label nudge |
| `space-2` | 8px | Inside chips, between stacked labels |
| `space-3` | 12px | Icon gap in nav rows, label to input |
| `space-4` | 16px | Inside controls, between form fields |
| `space-5` | 20px | Between cards in a grid |
| `space-6` | 24px | Card padding |
| `space-7` | 32px | Between groups inside a card |
| `space-8` | 40px | Between page sections (with a hairline) |
| `space-9` | 48px | Page side padding, top of page, panel padding |
| `space-10` | 64px | Above a major new region |
| `space-11` | 80px | Hero spacing on landing pages |
| `space-12` | 96px | Bottom of a page, before the footer |

| Shape token | Value | Use |
|---|---|---|
| `radius-control` | 10px | Buttons, inputs, nav rows |
| `radius-card` | 16px | Cards, panels, count cards |
| `radius-glass` | 20px | Glass panels, action bar; dialogs use 24px |
| `radius-chip` | 999px | Status chips |

**Page width:** pages use the full width beside the sidebar (no max-width cap), so tables and the side-by-side French pages get room. Paragraphs are capped at 72 characters a line so text stays readable.

Mobile (under 860px): page padding drops to `space-4` at the sides and `space-7` at the top; section spacing drops one step.

## Dividers (the "divider screen")

Sections are divided by **space plus one hairline**, never by thick rules, coloured bars or filled bands.

- `border-top: 1px solid var(--hairline)` with `space-8` (40px) above and below.
- Section titles under a divider are `h2` in `navy-900`; an optional eyebrow sits above in `navy-600`.
- Rows in lists use the same hairline with `space-3`–`space-4` padding.
- No divider directly under the page title; the title's own spacing does that job.

## Motion

| Token | Value |
|---|---|
| `ease` | `cubic-bezier(.2,.8,.2,1)` |
| `dur-fast` | 120ms (hover colour) |
| `dur` | 200ms (tooltips, dialog, lift) |

Respect `prefers-reduced-motion`: transitions drop to 0 and the tooltip nudge is off.

## Unavailable actions: tooltips and feedback

Every control that can't be used right now must say **why** and **what to do next**. A greyed button with no explanation is a bug.

- **Buttons** use `GuardedButton`. They stay focusable with `aria-disabled="true"` (not the `disabled` attribute, which hides them from keyboard users and swallows hovers).
  - Hover or keyboard focus shows the reason in a tooltip.
  - Clicking repeats the reason with a small nudge for about 2.5 seconds.
  - The reason is linked with `aria-describedby`, so screen readers read it.
- **Read-only fields, icons and truncated names** use `Tip`, a focusable wrapper with the same tooltip.
- **Phrase reasons as the next step**, naming the person or role:
  - "Only the approver can do this. Switch to Amara under “Acting as”."
  - "Fix 2 blocking checks first: missing source for Water points repaired; …"
  - "The French version needs the bilingual coordinator's review first."
  - "Approve the content before exporting."
  - "Another step is running. Wait for it to finish."
- **Never** say only "Not allowed", "Disabled" or "Access denied".
- **Tooltip style:** `navy-900` fill, `bone-50` text, 13/18px, `radius 10px`, `shadow-lift`, max 280px wide, 10px from the control, fades in over 200ms.
- **Disabled look:** `cream` fill, `navy-600` text, a 1.5px dashed `control-border` edge and a small lock before the label. It looks the same on hover, focus and click (no colour change), so it is never mistaken for a working button.
- **One tooltip at a time:** tooltips show on mouse hover or keyboard focus only, never left over from a click, and hovering one hides any other.

## Navigation

### Back on nested pages

Any page one level below a main section shows a **Back** link above the title: a chevron, "Back", and the parent's name ("Back to Inbox", "Back to Files & sources").

- It uses browser history when the person came from inside Synapse; otherwise it goes to the parent section.
- Style: `navy-600`, 14px, weight 500; hover `navy-900`. Not blue.
- When the back link is present, the breadcrumb is hidden so there's only one way-finding element.

| Page | Back goes to |
|---|---|
| A report (`/runs/…`) | Inbox |
| Evidence (`/evidence/…`) | Files & sources |
| A template (`/templates/…`) | Templates |
| Workflow & rules (`/standard`), Activity log (`/log`) | Files & sources |

### Sidebar (compact)

Modelled on popular dashboards (Linear, Vercel, Notion): few top-level items, small rows, everything else folded away.

- **Glass**, 224px wide, never dark or blue.
- **Main (4 items, always visible):** Inbox, Reports, Approvals, Templates. Each has a 16px line icon in `navy-600`.
- **Library (collapsible group, open by default):** Files & sources, Evidence, Workflow & rules, Activity log, Prompts, Skills. Indented, no icons.
- **Recent reports (folding menu, closed by default):** a clock icon, the label and a count. It opens by itself while you're on a report. Inside: up to 4 reports, single line, truncated with the full name in a tooltip, then "All reports →".
- **Footer:** the person menu ("Acting as") and a settings icon with a tooltip.
- **Rows:** 36px high, 14px text, `radius-control`, hover `cream` at 85%.
- **Active item:** `navy-900` text at weight 500, a 2px `blue-700` bar on the left, no fill.
- **Collapsed (≥861px):** a 68px icon rail. Labels, Library children, recents and person text hide; each icon shows its label as a tooltip on hover and focus.
- **Mobile:** the sidebar becomes a drawer from the top bar button.

### Top bar

Glass, 60px. Sidebar toggle, logo mark (`blue-700`) and "Synapse" wordmark (`navy-900`), search (inset, neumorphic), the **text size** control, language, **Guide** (the word, then a small circled ? after it) and **Assistant** as ghost buttons in navy. The Assistant panel starts closed so pages get the full width; it opens when asked, and by itself for French review. Each has a tooltip so they aren't confused: Guide is "a 1-minute tour of how Synapse works"; Assistant "answers questions about the report you're looking at, and reviews the French draft". Top-bar tooltips open downwards.

## Core components

- **Buttons**
  - Primary (one per screen): `blue-700` fill, `bone-50` text, hover `blue-900`, 40px high, `radius-control`.
  - Secondary: `bone-50` fill, `navy-900` text, 1px `line-strong` border.
  - Ghost: no fill, `navy-900` text, `cream` on hover.
  - Disabled: see "Unavailable actions".
- **Cards:** `bone-50`, 1px `hairline` border, `radius-card`, `shadow-soft`, padding `space-6`.
- **Statistic (count) cards:** borrowed from the WaterAid site's "The facts" cards. `cream` fill, soft neumorphic raise, `radius-card`. A short label on top in `navy-900` 600, the number big below (40px, 700, tabular, `navy-900`), and a small "See the points behind this number ↗" link in `blue-700`. The number stays navy so blue stays rare.
- **Next step:** an inset well on `cream`.
- **Tabs:** `navy-600` text; the active tab is `blue-700` with a 2px underline. The tab row has a hairline under it.
- **Status chips:** opaque, never glass.

| Status | Colours | Label (EN / FR) |
|---|---|---|
| Received | `navy-600` on `cream` | Received / Reçu |
| Draft | `navy-900` on `cream` | Draft / Brouillon |
| Needs approval | `status-attention` on `status-attention-fill` | Needs approval / À approuver |
| Approved | `status-done` on `status-done-fill` | Approved / Approuvé |
| Sent | `status-done` on `status-done-fill` | Sent / Envoyé |

(Draft moved from blue to navy in 3.2, to keep blue rare.)

- **Inbox (light project-management structure):** a `bone-50` table with a `cream` header row.
  - **Saved views** as tabs with counts: All reports, **My reports**, Needs action, Unassigned, Drafts, Completed. "My reports" shows reports where the person you're acting as is the preparer.
  - **Columns:** Report (title + ID), Project · Funder (funder small underneath), Received (sortable), **Due**, **Owner**, Status, Next action.
  - **Due** comes from the pack's Annual Operating Calendar (1.4): the FDF financial report for each fiscal quarter (Q1 31 Jul, Q2 31 Oct, Q3 31 Jan, Q4 30 Apr; April–March year). A tooltip names the deadline. Funders with no deadline in the pack show "—" with a tooltip saying so. No invented dates.
  - **Owner** is the report's preparer, shown with a small initial avatar on `cream`. "Unassigned" has a tooltip: whoever runs the first step as preparer becomes the owner.
  - **Filters:** search, status, project, funder.
  - No task boards, sub-tasks or story points. Synapse organises reports, not tasks.
- **Clickable number:** `blue-700` with a dotted underline; opens the Fact Record.
- **Two-panel French view:** two bone-50 panels; uncertain words on `status-attention-fill`.
- **Action bar:** glass, floating 16px above the bottom of the report, `radius-glass`. Shows the funder version, who acts next and the two steps: **Approve content**, then **Confirm export…**. After export the primary button becomes **Download…**. On mobile it compacts to the two buttons side by side.
- **Permission notice:** says who can do it instead, never just "access denied".
- **Error state:** a plain message and a retry button, in the attention colour.

### Export dialog

Confirming export is a decision, so it gets a proper modal, not a bare button.

- Native `<dialog>` opened with `showModal()`: focus is trapped, Esc and a click on the backdrop close it.
- **Glass**, 560px max wide, `radius 24px`, `shadow 0 24px 80px rgba(21,20,53,.22)`. The backdrop is navy at about 25% with a 6px blur.
- **Header:** eyebrow ("Step 2 of 2 · Export"), `h2` "Confirm export", one line on what happens: the approved revision is locked, the export is logged with your name, and **nothing is emailed**; you send the file yourself.
- **Summary list:** report, funder version, revision, approved by and when (formatted dates, not ISO).
- **Format choice:** two radio cards, **PDF** (default; "fixed layout for sharing and printing") and **Word document** (".docx, editable"). The selected card gets an `navy-900` border; no blue fill.
- **Footer:** "Cancel" (secondary) and one primary: "Export and download PDF" or "… Word".
- **Download mode** (already exported): title "Download the exported report", button "Download PDF/Word", and a note that downloading again is not a new export.

### Sample data chip

A small cream pill reading **Sample data**, beside the title of any fictional demonstration report (the Inbox row and the report heading). Its tooltip explains it's a fictional project in a WaterAid Canada style, for demonstration only.

### French review (side by side)

- **Create checked French draft** opens the French tab like a Word review: the English original on the left, the French draft on the right, each as a page.
- Flagged words are highlighted in the French page: **to decide** (attention fill), **approved** (done fill), **fixed by reviewer** (struck-through old word, new word).
- The Assistant opens by itself on **French review**: progress, then one card per flagged word with **Approve** or **Decline and fix**. Cards say whether the AI wasn't sure or a meaning rule flagged it.
- Only the bilingual reviewer can decide; anyone else sees who to switch to.

## Buttons: two kinds only

Every button on every screen is one of two kinds, so people learn it once.

| Kind | What it's for | Look | Examples |
|---|---|---|---|
| **Action** | Does something to the report | Filled `blue-700`, bone-white 600 text, soft blue shadow; hover `blue-900` | Next, Approve content, Confirm export…, Create checked French draft, Approve (French word), Ask |
| **Tool** | Opens, switches or filters | Raised white (`neu-raised-sm`), navy text, `control-border` edge; hover navy edge; when on or pressed: inset with a navy ring | Guide, Assistant, EN/FR, Acting as, text size, filters, funder version, Decline, Cancel, Back |

Unavailable buttons of either kind use the locked look (cream, dashed edge, lock). There is no third colour: no green, red or amber buttons.

### Colour meaning stays with status, not buttons

- **Green** (`status-done`) shows a success result only: "Approved" and "Exported" chips, "Numbers preserved", an approved French word.
- **Amber-brown** (`status-attention`) means a person needs to act: a French word still to decide, "Needs approval".
- **Red-brown** (`status-urgent`) shows a declined result (a declined and changed French word, a declined item) and fast-track water points. Nothing else.
- **Blue** (`blue-700`) is everything else that needs to stand out: action buttons, progress bars and step markers, the active tab and its count, "Needs action" counts, the row highlight, focus.

## Highlights

| What | Look |
|---|---|
| Table header | Plain white, 12px caps in `navy-600`, one hairline underneath (Notion/Jira calm) |
| Row on hover or keyboard focus | `blue-50` `#EEF4FB` across the row, 3px `blue-700` bar on the left |
| Tab counts | White pill with a `control-border` outline; the active tab's count and "Needs action" above 0 are filled `blue-700` with white text |
| Active tab | Navy 600 text with a 2px `blue-700` underline |
| French words in the draft | Under the legend "Highlighted words:": **Needs a decision** (amber fill, amber underline), **✓ Approved** (green fill, green underline), **✎ Changed by reviewer** (red fill, red underline). Focused word: 2px blue outline |
| French review cards | Raised white card with a 4px left edge in the same colour as its state; the card being worked on gets a 2px blue ring |

## Priority (traffic light)

Who decided what comes first, shown on every list. The traffic-light colours are used **only** in priority badges, always with the level and a word, so colour is never the only signal.

| Level | Badge | Meaning |
|---|---|---|
| **P0** | Red light `#C62828` on `#FBEDEC`, "P0 Do first" | Finish before anything else |
| **P1** | Amber light `#D97706` on `#FDF3E3`, "P1 Next" | Do after P0 |
| **P2** | Green light `#2E7D32` on `#EDF5EE`, "P2 Later" | When P0 and P1 are clear |
| none | "—" | No priority set |

- Under the badge: who set it and when ("Director · Oct 20"). Hover or focus: the full name, date and reason.
- All reports, Needs action and Recent reports are ordered P0 → P1 → P2 → none, then by due date.
- In the sidebar, Recent reports shows a small P0/P1/P2 marker with a coloured edge.
- Badge text is navy on a pale tint (13:1+); the lights are decorative.

## Table columns

Priority · Report (title, then funder, received date and ID underneath) · Due · Owner · Status with the next step as a blue link underneath. Rows are 22px × 20px padded; dividers are navy at 5%.

## Icons

Lucide line icons (ISC licence, inlined in `components/icons.tsx`), 1.5px stroke, 20px in navigation and 18px in tools, `navy-600` at rest and `navy-900` when active.

## Spacing (Perplexity-calm)

Fewer lines and more air: cards have no border (a soft raised shadow instead); tables keep only hairline row dividers; 64px above the page title; 40px under the page intro; 32px above filters; 16px between filters; 18px × 20px table cells; the action bar has 20px × 32px padding and 16px between its buttons.

## Progress (goal gradient)

The report Overview shows progress as a `blue-700` bar that fills as steps finish, with the count ("5 / 9") and what's left in plain words ("4 steps to go", "Almost there: 2 steps to go", "Last step to go"). Below it, the nine steps in order:

- **Done:** a filled blue circle with a tick.
- **Next:** `blue-50` row with a blue bar, a blue-ringed number and a blue "NEXT" tag.
- **Open:** a numbered circle; it can be done now.
- **Locked:** a dashed circle with a lock and a tooltip saying what has to happen first.

Locks follow the rules the server enforces: facts come first; cleaning, numbers, French and the funder draft need the facts; review and approval need a funder draft; export needs approval.

## Text size

Three equal segments in one outlined box, 40px tall like the language menu; the chosen one is filled `blue-700` with a white A, and nothing grows or overlaps. Small to large: **Standard (100%)**, **Larger (115%)**, **Largest (130%)**. The chosen one is filled navy. It scales the whole interface, like browser zoom, so nothing overlaps, and it is remembered on this device. Each A has a tooltip and a spoken label. On phones it sits at the top of the menu drawer. Pages reflow by the space they actually have: the Inbox filters drop to two columns, then one.

## Dropdowns and fields

- 44px tall (40px with 14px text in the Inbox filters and the top bar), 15px text, 14px side padding and room for a navy chevron on the right.
- Bone-white fill with a `control-border` edge and a faint shadow, so they stand out from the page; the edge turns navy on hover.
- Labels sit above the field with 8px between them.
- Status pills: 13px text, 4px × 12px padding.

## Writing in the interface

Plain words, short sentences, so a new person needs little training.

- Say what a thing does, not what it is called internally ("Checks & sources", not "Issues & evidence"; "Funder draft", not "Standardized draft").
- Buttons start with a verb ("Approve content", "Create checked French draft").
- Explain a rule once, in one sentence, where it applies.
- Avoid system words in the UI (replay, revision hash, schema) unless a person needs them to act.

## Water point groups

| Group | Colour | Count (5.5, latest visit by 30 Jun 2026) |
|---|---|---|
| Not working, no repair recorded (fast track) | `status-urgent` | 22 |
| Unsafe water (latest visit failed the test) | `status-attention` | 60 |
| Partly working | `status-attention`, outline dot | 37 |
| Not working, repair recorded | `navy-600` | 25 |
| Working | `status-done` | 176 |
| **Total** | | **320** |

## Accessibility

- All text at least 7:1 (see Contrast).
- Every status has a label and an icon, not only colour.
- Unavailable controls stay focusable and explain themselves (`aria-disabled` + `aria-describedby`).
- Glass falls back to solid bone for reduced transparency; motion is off for reduced motion.
- All actions reachable by keyboard; focus ring 2px `blue-700` with a 2px bone-50 gap.
- Dialogs trap focus and return it to the button that opened them.

## Logo idea

Two dots joined by a short curved line, which reads as both a synapse and a water drop. `blue-700` on bone; bone-50 on `blue-700`.

## Token reference (`packages/design-tokens/tokens.css`)

```css
:root {
  --bone-50:#FEFEFE; --cream:#F8F0E4; --bone-200:#F3F5F8; --control-border:#7D7C8E;
  --navy-900:#151435; --navy-600:#44435D;
  --blue-900:#003E80; --blue-700:#004FA3; --blue-100:#DCE8F5;
  --status-attention:#6B4507; --status-attention-fill:#F2EEE6;
  --status-urgent:#8A2A24;    --status-urgent-fill:#F4EDE8;
  --status-done:#21543E;      --status-done-fill:#EEEFE9;
  --hairline:rgba(21,20,53,.08); --line-soft:rgba(21,20,53,.12); --line-strong:rgba(21,20,53,.45);

  /* 3.2 names kept as aliases */
  --bone-100:var(--cream); --ink-900:var(--navy-900); --ink-600:var(--navy-600);
  --lake-900:var(--blue-900); --lake-700:var(--blue-700); --lake-600:var(--blue-700); --lake-100:var(--blue-100);

  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-5:20px; --space-6:24px;
  --space-7:32px; --space-8:40px; --space-9:48px; --space-10:64px; --space-11:80px; --space-12:96px;

  --radius-control:10px; --radius-card:16px; --radius-glass:20px; --radius-chip:999px;

  --shadow-soft:0 1px 2px rgba(21,20,53,.04),0 8px 24px rgba(21,20,53,.06);
  --shadow-lift:0 2px 6px rgba(21,20,53,.06),0 18px 48px rgba(21,20,53,.10);
  --neu-raised:6px 6px 16px rgba(21,20,53,.06),-6px -6px 16px rgba(254,254,253,.9);
  --neu-inset:inset 2px 2px 6px rgba(21,20,53,.07),inset -2px -2px 6px rgba(254,254,253,.9);
  --glass-bg:rgba(254,254,253,.72); --glass-border:rgba(254,254,253,.6); --glass-blur:blur(18px) saturate(120%);

  --ease:cubic-bezier(.2,.8,.2,1); --dur-fast:120ms; --dur:200ms;

  --font-stack:"Inter",-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,sans-serif;
  --type-page-title:32px; --type-section:24px; --type-subsection:18px;
  --type-cta:16px; --type-body:16px; --type-small:14px; --type-caption:12px;
}
```

Older variable names used across the app (`--accent`, `--water`, `--chalk`, `--primary` and so on) are mapped onto these tokens at the bottom of `tokens.css`, so no component has a raw hex value.

## Changes from 3.1

| Area | 3.1 | 3.2 |
|---|---|---|
| Spacing | 6 steps, up to 32px | 12 steps, up to 96px; 48px page padding, 40px between sections |
| Radii | 8 / 12px | 10 / 16 / 20px (24px dialogs) |
| Headings | 400–500 | 600 with slight negative tracking |
| CTA label | 18px | 16px (buttons were crowding the action bar) |
| Active nav | Lake text and bar | Ink text, lake bar only |
| Draft chip | Lake text | Ink text |
| Depth | Glass on everything incl. cards | Glass only for floating layers; neumorphism for metric cards and the search/next-step wells |
| Disabled | Reason shown under the button | Reason in a tooltip on hover, focus and click; buttons stay focusable |
| Navigation | No back link | Back link on every nested page |
| Sidebar | Long flat list | 4 main items + collapsible Library + 4 recents; collapsible to an icon rail |
| Export | "Confirm export" button, then links | Glass dialog with PDF or Word choice |
| Dividers | Not specified | Hairline plus 40px space |

## Changes from 3.2

| Area | 3.2 | 3.3 |
|---|---|---|
| Palette | Ink `#1A262B`, lake `#0F4C5C`, bone-100 `#F4F0E6` | Navy `#151435` / `#44435D`, blue `#004FA3`, cream `#F8F0E4` (adapted from the WaterAid Canada site) |
| Shadows and lines | Ink and lake tints | Navy tints only |
| Headings | 32 / 24px at 600 | 40 / 28px at 700 (32 / 24 on mobile) |
| Statistic cards | Bone, 600 number | Cream, 40px 700 number |
| Inbox | Report, project, funder, period, received, preparer, status, next action | Adds "My reports", Due (from the operating calendar) and Owner with avatar; project and funder share a column |
| Principle | "Not a project board" | "Light project-management structure, not a task board" |

## Changes from 3.3

| Area | 3.3 | 3.4 |
|---|---|---|
| Bone | `#FBF9F4`, canvas `#E9E3D6` | `#FDFCFA`, canvas `#F3F1EC` (whiter, still warm) |
| Page width | Capped at 1180px | Full width; 72-character paragraphs |
| Sidebar | 248px; recent reports always listed | 224px; recent reports in a folding menu |
| Top bar | "Open guide" | "Guide", with tooltips on Guide and Assistant |
| Tabs | Standardized draft, Issues & evidence, French version, Approvals & access | Funder draft, Checks & sources, French, Approvals |
| Demo | Synthetic reports only | Adds a "Sample data" project in a WaterAid Canada style |

## Changes from 3.4

| Area | 3.4 | 3.5 |
|---|---|---|
| Bone | `#FDFCFA`, canvas `#F3F1EC` | `#FEFEFD`, canvas `#F5F4F1` |
| Fields and dropdowns | Soft 45% navy edge, native arrow, tight padding | `#7D7C8E` edge (3:1+), custom chevron, 44px, 15px text |
| Text size | Browser only | A A A control in the top bar (100 / 115 / 130%) |
| Guide | "? Guide" | "Guide ?" |
| Assistant | Open by default on wide screens | Closed until opened |

## Changes from 3.5

| Area | 3.5 | 3.6 |
|---|---|---|
| Type | Titles 40px, sections 28px | Titles 32px, sections 24px, reading text 16px |
| Progress | Ticked list and a separate "Next" box | Goal-gradient bar, step states, locked steps explain themselves |
| Disabled buttons | Bone fill, could change colour on hover | Cream, dashed edge, lock icon, no hover change |
| Tooltips | Could stack after a click | One at a time |
| Text size control | Taller than the language menu | Same 40px height |

## Accessibility statement

Synapse targets **WCAG 2.1 AA**, with **AAA contrast** (1.4.6: all text 7:1 or better, measured on bone, cream, glass over the blue glow and the canvas), **AAA focus** (2.4.7 visible focus with a 2px ring), keyboard access to every control, labelled controls (`aria-label`, `aria-describedby` for every unavailable reason, `aria-pressed`/`aria-expanded` on tools), a progress bar with `role="progressbar"` and a spoken value, reduced-motion and reduced-transparency fallbacks, and an in-app text-size control. Full WCAG 2.1 AAA conformance is not claimed: some AAA criteria (for example sign-language video and a lower-secondary reading level for all content) are outside what this demo can show.

## Changes from 3.6

| Area | 3.6 | 3.7 |
|---|---|---|
| White and canvas | `#FEFEFD` on warm `#F5F4F1` | `#FEFEFE` on cool `#F3F5F8`, closer to the site |
| Buttons | Mixed styles; French Approve green, Decline red | Two kinds: blue actions, raised white tools; no coloured buttons |
| Depth | Light glass; flat cards | Stronger frosted glass on floating layers; raised cards and tools |
| Icons | 18–20px mixed | All 20px |
| Folded sidebar | Library and Recent reports did nothing | Clicking them opens the sidebar with that menu expanded |

## Changes from 3.7

| Area | 3.7 | 3.8 |
|---|---|---|
| Green / red | Green for ticks and progress; declined in amber | Green = success results, red = declined results; everything else blue |
| Row highlight | Cream, same as header | `blue-50` with a blue bar |
| Tab counts | Faint cream | Outlined white; active and "Needs action" filled blue |
| Text size | Raised pill with a ring | Blue segmented control |
| Filters | 46px, 15px | 40px, 14px |
| Icons | Hand-drawn | Lucide, 1.5px stroke |
| Spacing | Dense table and bar | Calmer: no card borders, larger gaps, roomier action bar |
| French legend | "to decide / approved / fixed by reviewer" | "Highlighted words: Needs a decision · ✓ Approved · ✎ Changed by reviewer" |

## Changes from 3.8

| Area | 3.8 | 3.9 |
|---|---|---|
| Priority | None | Traffic-light P0/P1/P2 with who, when, why; lists ordered by priority |
| Table | Cream header, separate Project and Next action columns | White header, project in the title, next step under the status |
| Spacing | Calm | Calmer: 80px above the page title, 48px under the intro, taller rows |
| Demo | Inbox starts empty of work | Opens with 3 sample reports in Needs action |

