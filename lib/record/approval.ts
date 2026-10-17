import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { appendAudit } from "@/lib/audit";
import { dataDir, isRecordId, readRecord, saveRecord } from "@/lib/record/store";
import type { Approval, FactRecord, FilledTemplate, FunderId } from "@/lib/types";

// Approval is two logged steps per funder template: approve the content, then confirm the send.
// The state lives on `record.templates[funder_id].approval`; each step is idempotent, so a
// double click logs once. A refusal returns a reason for the screen and writes nothing.

type Refused = { ok: false; reason: string };
export type ApproveResult = { ok: true; record: FactRecord } | Refused;
export type SendResult = { ok: true; record: FactRecord; export_path: string } | Refused;

const refuse = (reason: string): Refused => ({ ok: false, reason });
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// The line that goes at the foot of every export. Local until lib/templates.ts (Task 6) owns the
// funder wording and this becomes an import.
export function disclosureFor(approver: string, date: string): string {
  return `Prepared with AI assistance. Reviewed and approved by ${approver} on ${date}. Figures are traced to the Kijana programme data.`;
}

const FUNDER_NAME: Record<FunderId, string> = {
  fdf: "FDF",
  quebec: "Québec foundation",
  cedar_stone: "Cedar & Stone",
};

function exportPath(record_id: string, funder_id: FunderId): string {
  return path.join(dataDir(), "exports", `${record_id}-${funder_id}.md`);
}

function exportMarkdown(record: FactRecord, funder_id: FunderId, template: FilledTemplate, approval: Approval): string {
  const fields = template.fields.map((f) => `## ${f.label}\n\n${f.value}\n`).join("\n");
  const date = approval.content_approved_at.slice(0, 10);
  return `# ${FUNDER_NAME[funder_id]} report: ${record.period}\n\n${fields}\n---\n\n${disclosureFor(approval.approver, date)}\n`;
}

function load(record_id: string, funder_id: FunderId): { record: FactRecord; template: FilledTemplate } | Refused {
  if (!isRecordId(record_id)) return refuse(`"${record_id}" is not a valid record id`);
  const record = readRecord(record_id);
  if (!record) return refuse(`record "${record_id}" not found`);
  const template = record.templates[funder_id];
  if (!template) return refuse(`record "${record_id}" has no ${funder_id} template`);
  return { record, template };
}

function withApproval(record: FactRecord, funder_id: FunderId, template: FilledTemplate, approval: Approval): FactRecord {
  return { ...record, templates: { ...record.templates, [funder_id]: { ...template, approval } } };
}

// Step 1. Needs a template with every field green, and an approver who is not the preparer
// (SOC 2 CC6.1). The same approver again changes nothing and logs nothing; anyone else is told it
// is already approved.
export function approve(record_id: string, funder_id: FunderId, approver: string, preparer: string): ApproveResult {
  const found = load(record_id, funder_id);
  if ("reason" in found) return found;
  const { record, template } = found;
  const who = approver.trim();
  const prep = preparer.trim();

  if (template.approval) {
    return sameName(who, template.approval.approver)
      ? { ok: true, record }
      : refuse(`already approved by ${template.approval.approver}`);
  }
  if (!who) return refuse("approver name is required");
  if (!prep) return refuse("preparer name is required");
  if (sameName(who, prep)) return refuse("the approver must be a different person from the preparer");
  const red = template.fields.filter((f) => f.check !== "green");
  if (red.length > 0) {
    return refuse(`${red.length} field${red.length === 1 ? " is" : "s are"} still red: ${red.map((f) => f.key).join(", ")}`);
  }

  const approval: Approval = {
    approver: who,
    preparer: prep,
    content_approved_at: new Date().toISOString(),
    sent_at: null,
  };
  const next = withApproval(record, funder_id, template, approval);
  saveRecord(next);
  appendAudit({ actor: who, action: "approve", record_id, detail: { funder_id, preparer: prep } });
  return { ok: true, record: next };
}

// Step 2. Needs step 1. Writes data/runtime/exports/<record_id>-<funder_id>.md once, stamps
// `sent_at`, and logs. The disclosure names the person who approved the content, on the day they
// approved it. A repeat returns the same path and touches nothing.
export function send(record_id: string, funder_id: FunderId, approver: string): SendResult {
  const found = load(record_id, funder_id);
  if ("reason" in found) return found;
  const { record, template } = found;
  const approval = template.approval;
  if (!approval) return refuse("not approved yet: approve the content before sending");

  const file = exportPath(record_id, funder_id);
  if (approval.sent_at) return { ok: true, record, export_path: file };
  const who = approver.trim();
  if (!who) return refuse("approver name is required");

  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, exportMarkdown(record, funder_id, template, approval));
  const next = withApproval(record, funder_id, template, { ...approval, sent_at: new Date().toISOString() });
  saveRecord(next);
  appendAudit({ actor: who, action: "send", record_id, detail: { funder_id, export_file: path.basename(file) } });
  return { ok: true, record: next, export_path: file };
}
