// The UI <-> data contract. Every shape the screens, API routes and AI jobs share lives here as a
// Zod schema with its inferred type, so a route can validate what a screen reads and the AI wrapper
// can reuse the same schemas. Field names follow the contract; change them in the docs first.
import { z } from "zod";

// ---- Inbox and Fact Record ------------------------------------------------------------------

export const InboxStatus = z.enum([
  "new",
  "extracted",
  "cleaned",
  "translated",
  "filled",
  "approved",
  "sent",
]);
export type InboxStatus = z.infer<typeof InboxStatus>;

export const InboxItem = z.object({
  id: z.string(),
  project: z.string(),
  funder: z.string(),
  received_date: z.string(),
  status: InboxStatus,
});
export type InboxItem = z.infer<typeof InboxItem>;

// Set by code, never by the AI.
export const Check = z.enum(["green", "red"]);
export type Check = z.infer<typeof Check>;

export const Fact = z.object({
  fact_id: z.string(), // "F-01"…
  label: z.string(), // "functionality_reported", "people_connected", …
  value: z.union([z.number(), z.string()]),
  unit: z.string().nullable(), // "%", "people", "committees", null
  period: z.string().nullable(), // "Q1 FY2026-27"
  quote: z.string(), // verbatim from original_text
  check: Check,
  check_reason: z.string().nullable(),
});
export type Fact = z.infer<typeof Fact>;

export const Change = z.object({
  field: z.string(),
  before: z.string(),
  after: z.string(),
});
export type Change = z.infer<typeof Change>;

export const MetricId = z.enum([
  "pct_full",
  "pct_incl_partly",
  "count_total",
  "count_full",
  "count_partly",
  "count_not",
]);
export type MetricId = z.infer<typeof MetricId>;

// A number computed by code, citable like a fact.
export const MetricRef = z.object({
  metric_id: MetricId,
  cutoff: z.string(), // ISO date
  value: z.number(),
});
export type MetricRef = z.infer<typeof MetricRef>;

export const FunderId = z.enum(["fdf", "quebec", "cedar_stone"]);
export type FunderId = z.infer<typeof FunderId>;

export const UncertainWord = z.object({
  word: z.string(),
  position: z.number(),
  reason: z.string(),
});
export type UncertainWord = z.infer<typeof UncertainWord>;

export const TemplateField = z.object({
  key: z.string(),
  label: z.string(),
  kind: z.enum(["number", "narrative"]),
  value: z.string(),
  // Required for numbers. `fixed` labels a hand-sourced figure, e.g. "5.3 (team doc) [verify]".
  source: z
    .object({
      fact_id: z.string().optional(),
      metric_id: z.string().optional(),
      fixed: z.string().optional(),
    })
    .nullable(),
  check: Check,
  check_reason: z.string().nullable(),
});
export type TemplateField = z.infer<typeof TemplateField>;

export const Approval = z.object({
  approver: z.string(),
  preparer: z.string(), // the approver must differ from the preparer (SOC 2 CC6.1)
  content_approved_at: z.string(),
  sent_at: z.string().nullable(),
});
export type Approval = z.infer<typeof Approval>;

export const FilledTemplate = z.object({
  funder_id: FunderId,
  language: z.enum(["en", "fr"]),
  fields: z.array(TemplateField),
  disclosure: z.string().nullable(),
  approval: Approval.nullable(),
});
export type FilledTemplate = z.infer<typeof FilledTemplate>;

export const FactRecord = z.object({
  record_id: z.string(), // the inbox file stem, e.g. "kijana-q1-fy2026-27"
  source_file: z.string(), // "inbox/kijana-q1-fy2026-27.txt"
  original_text: z.string(), // never modified
  received_date: z.string(),
  source_location: z.string(), // "5.6 Kijana Quarterly Reports, Report 2"
  period: z.string(), // "Q1 FY2026-27", copied from the inbox sidecar
  period_end: z.string(), // ISO date, "2026-06-30"; the water-point cut-off for this report
  facts: z.array(Fact),
  changes: z.array(Change),
  metrics: z.array(MetricRef),
  french: z
    .object({
      text: z.string(),
      uncertain_words: z.array(UncertainWord),
      check: Check,
      problems: z.array(z.string()),
    })
    .nullable(),
  templates: z.partialRecord(FunderId, FilledTemplate), // approval lives on each template
});
export type FactRecord = z.infer<typeof FactRecord>;

// ---- Water points ---------------------------------------------------------------------------

export const VisitStatus = z.enum(["working", "partly", "not_working"]);
export type VisitStatus = z.infer<typeof VisitStatus>;

export const WaterQualityTest = z.enum(["pass", "fail", "not_tested"]);
export type WaterQualityTest = z.infer<typeof WaterQualityTest>;

export const WaterPointStatus = z.object({
  id: z.string(),
  district: z.string(),
  settlement: z.string(),
  status: VisitStatus,
  repair_recorded: z.boolean(),
  latest_test: WaterQualityTest,
  latest_visit_date: z.string(),
});
export type WaterPointStatus = z.infer<typeof WaterPointStatus>;

export const PriorityGroup = z.enum([
  "red_fast_track",
  "red_unsafe",
  "amber_partly",
  "amber_repair_recorded",
  "green",
]);
export type PriorityGroup = z.infer<typeof PriorityGroup>;

export const FunctionalityCounts = z.object({
  total: z.number(),
  fully_working: z.number(),
  partly_working: z.number(),
  not_working: z.number(),
  pct_full: z.number(), // one decimal, e.g. 70.3
  pct_incl_partly: z.number(), // one decimal, e.g. 85.3
});
export type FunctionalityCounts = z.infer<typeof FunctionalityCounts>;

// ---- Audit log ------------------------------------------------------------------------------

export const AuditEntry = z.object({
  at: z.string(),
  actor: z.string(), // person name or "system"
  action: z.enum(["ai_call", "verify", "approve", "send", "blocked", "correct"]),
  record_id: z.string().nullable(),
  detail: z.record(z.string(), z.unknown()), // job, model, mode, tokens, result, reason
  // Hash chain (SOC 2 CC7.2): each entry stores the hash of the one before it.
  prev_hash: z.string().nullable(), // null on the first entry
  hash: z.string(),
});
export type AuditEntry = z.infer<typeof AuditEntry>;

// ---- Kijana programme data: raw CSV rows and the cleaned result -----------------------------

// Raw rows keep every CSV column as the string it was read as; cleaning turns them into the types below.
export const RawPoint = z.object({
  water_point_id: z.string(),
  district: z.string(),
  settlement: z.string(),
  type: z.string(),
  install_year: z.string(),
  management: z.string(),
  committee_women_share: z.string(),
  est_users: z.string(),
  tariff_model: z.string(),
  sensor_installed: z.string(),
  grid_x: z.string(),
  grid_y: z.string(),
});
export type RawPoint = z.infer<typeof RawPoint>;

export const RawVisit = z.object({
  visit_id: z.string(),
  water_point_id: z.string(),
  visit_date: z.string(),
  visitor_role: z.string(),
  status: z.string(),
  issue_category: z.string(),
  downtime_days_reported: z.string(),
  water_quality_test: z.string(),
  repair_completed: z.string(),
  notes: z.string(),
});
export type RawVisit = z.infer<typeof RawVisit>;

export const WaterPoint = z.object({
  id: z.string(),
  district: z.string(),
  settlement: z.string(),
  type: z.string(),
  sensor_installed: z.boolean(),
});
export type WaterPoint = z.infer<typeof WaterPoint>;

export const Visit = z.object({
  visit_id: z.number(),
  water_point_id: z.string(),
  visit_date: z.string(), // ISO yyyy-mm-dd
  status: VisitStatus,
  water_quality_test: WaterQualityTest,
  repair_completed: z.enum(["Y", "N", ""]),
});
export type Visit = z.infer<typeof Visit>;

// Everything cleaning touched, so the screens can show before -> after and the demo can say what changed.
export const CleaningReport = z.object({
  status_mapped: z.record(z.string(), z.number()), // raw non-standard status -> number of visits
  day_first_dates: z.array(z.number()), // visit_ids whose dd/mm/yyyy date was read day-first
  ambiguous_dates: z.array(z.number()), // the subset where both parts are <= 12 ("assumed day-first")
  orphan_visits: z.array(z.object({ visit_id: z.number(), water_point_id: z.string() })),
  unmapped_status: z.array(z.object({ visit_id: z.number(), raw: z.string() })),
  changes: z.array(Change),
});
export type CleaningReport = z.infer<typeof CleaningReport>;

export const CleanResult = z.object({
  points: z.array(WaterPoint),
  visits: z.array(Visit),
  report: CleaningReport,
});
export type CleanResult = z.infer<typeof CleanResult>;

// ---- The standard: workflow and profiles ----------------------------------------------------

// One workflow, as data (standard/workflows/funder-report.json). The home screen and the step rail
// render from it, so the interface always shows the workflow the standard defines.
export const WorkflowStep = z.object({
  n: z.number(),
  id: z.string(),
  label_en: z.string(),
  label_fr: z.string(),
  done_by: z.enum(["code", "ai", "person"]),
  skill: z.string().optional(), // the registered skill an AI step runs
  rules: z.array(z.string()), // rule ids that check this step
  decides: z.string(), // who decides at this step
  output: z.string(),
});
export type WorkflowStep = z.infer<typeof WorkflowStep>;

export const WorkflowDef = z.object({
  id: z.string(),
  label_en: z.string(),
  label_fr: z.string(),
  hours_today: z.number(), // staff hours a year this workflow takes today
  source: z.string(), // where that figure comes from
  steps: z.array(WorkflowStep),
});
export type WorkflowDef = z.infer<typeof WorkflowDef>;

// Where the workflow runs (standard/profiles/*.json): language, formats, templates, provider.
export const Profile = z.object({
  id: z.string(),
  label: z.string(),
  language: z.enum(["en", "fr"]),
  number_locale: z.string(), // "en-CA" -> 85.3%, "fr-CA" -> 85,3 %
  functionality_definition: z.enum(["full_only", "incl_partly", "both"]),
  templates: z.array(FunderId),
  provider: z.enum(["replay", "live", "manual"]),
  offline: z.boolean(),
});
export type Profile = z.infer<typeof Profile>;
