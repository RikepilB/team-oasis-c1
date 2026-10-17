import { z } from "zod";
import { Fact, Change, MetricRef, CleaningReport, WaterPointStatus, PriorityGroup } from "@/lib/types";
import { SourceRef } from "@/lib/demo/standard";
export const RuleResult = z.object({ rule_id: z.string(), label: z.string(), severity: z.enum(["block", "warn"]), passed: z.boolean(), message: z.string() });
export const Field = z.object({ key: z.string(), label: z.string(), kind: z.enum(["number", "narrative"]), value: z.string(), cites: z.array(z.string()), source: SourceRef.nullable(), check: z.enum(["green", "red"]), check_reason: z.string().nullable() });
export const DemoTemplate = z.object({
  standard_version: z.string().default(""), funder_id: z.enum(["fdf", "quebec"]), language: z.enum(["en", "fr"]), revision: z.number().int().positive(), preparer: z.string(), fields: z.array(Field), checks: z.array(RuleResult),
  review: z.object({ actor: z.string(), revision: z.number(), at: z.string() }).nullable(),
  approval: z.object({ approver: z.string(), approved_revision: z.number(), content_approved_at: z.string(), sent_at: z.string().nullable() }).nullable(), disclosure: z.string().nullable()
});
export type DemoTemplate = z.infer<typeof DemoTemplate>;
export const EvidenceView = z.object({
  snapshot_id: z.string(), cutoff: z.string(), counts: z.object({ total: z.number(), observed_total: z.number(), missing_total: z.number(), fully_working: z.number(), partly_working: z.number(), not_working: z.number(), pct_full: z.number().nullable(), pct_incl_partly: z.number().nullable() }),
  districts: z.array(z.string()).default([]), groups: z.record(PriorityGroup, z.number()), rows: z.array(WaterPointStatus), missing_ids: z.array(z.string()), report: CleaningReport
});
export type EvidenceView = z.infer<typeof EvidenceView>;
export const DemoRecord = z.object({
  record_id: z.string(), title: z.string(), period: z.string(), period_end: z.string(), received_date: z.string(), dataset_id: z.string(),
  source_file: z.string(), source_location: z.string(), original_text: z.string(), preparer: z.string(), revision: z.number().int(), status: z.string(),
  facts: z.array(Fact), changes: z.array(Change), metrics: z.array(MetricRef), coverage: z.object({ total: z.number(), observed: z.number(), missing_ids: z.array(z.string()) }),
  snapshot_id: z.string(), completed: z.array(z.string()),
  french: z.object({ text: z.string(), check: z.enum(["green", "red"]), problems: z.array(z.string()) }).nullable(),
  templates: z.partialRecord(z.enum(["fdf", "quebec"]), DemoTemplate)
});
export type DemoRecord = z.infer<typeof DemoRecord>;
export type InboxSummary = {
  record_id: string;
  title: string;
  period: string;
  received_date: string;
  status: string;
};
export type ActionInput = {
  actor?: string;
  preparer?: string;
  funder_id?: "fdf" | "quebec";
  key?: string;
  value?: string;
  expected_revision?: number;
};
export const Constant = z.object({ id: z.string(), label: z.string(), value: z.number(), unit: z.string(), quote: z.string(), source: z.string(), definition: z.string(), period: z.string() });
export const Dataset = z.object({ id: z.string(), label: z.string(), csv_dir: z.string(), constants: z.array(Constant) });
export const Sidecar = z.object({ record_id: z.string(), title: z.string(), project: z.string(), funder: z.string(), received_date: z.string(), source_file: z.string(), source_location: z.string(), period: z.string(), period_end: z.string() });
export type AuditEvent = {
  id: string;
  at: string;
  actor: string;
  action: string;
  record_id: string | null;
  detail: Record<string, unknown>;
  prev_hash: string | null;
  hash: string;
};
export class DemoError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
