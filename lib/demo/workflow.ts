import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { loadKijana } from "@/lib/kijana/load";
import { cleanKijana } from "@/lib/kijana/clean";
import { latestStatus, countFunctionality, priorityGroups, pointsBehind } from "@/lib/kijana/metrics";
import { getSkill, isRegistered } from "@/lib/harness/skills";
import { guardPersonalData, PERSONAL_DATA_PATTERNS } from "@/lib/harness/guard";
import { ExtractSchema, FrenchSchema, FillSchema } from "@/lib/harness/jobs";
import { getTemplate, loadStandard } from "@/lib/demo/standard";
import { checkFact, checkFrench, checkNarrative, checkNumericField, type Citable } from "@/lib/demo/verify";
import { DemoRecord, DemoTemplate, DemoError, Sidecar, EvidenceView, type ActionInput, type InboxSummary } from "@/lib/demo/types";
import { context, atomic, readJson, safeId, serialized, audit, auditEntries, chainValid, hash, type Context } from "@/lib/demo/store";
import type { MetricRef } from "@/lib/types";
const recordFile = (c: Context, id: string) => path.join(c.runtime, "records", safeId(id) + ".json");
const snapshotFile = (c: Context, id: string) => path.join(c.runtime, "snapshots", safeId(id) + ".json");
const now = () => new Date().toISOString();
const who = (name: string | undefined) => {
  if (!name?.trim())
    throw new DemoError("actor_required", "A named person is required."); return name.trim();
};
const same = (a: string, b: string) => a.trim().toLocaleLowerCase("en-CA") === b.trim().toLocaleLowerCase("en-CA");
function snapshot(c: Context, cutoff: string): EvidenceView {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff) || Number.isNaN(Date.parse(cutoff)) || new Date(cutoff).toISOString().slice(0, 10) !== cutoff)
    throw new DemoError("invalid_cutoff", "Use a valid ISO cutoff date.");
  const raw = loadKijana(c.csv);
  const ids = raw.points.map(p => p.water_point_id.trim());
  const visits = raw.visits.map(v => v.visit_id.trim());
  if (ids.some(id => !id) || new Set(ids).size !== ids.length || visits.some(id => !/^\d+$/.test(id) || !Number.isSafeInteger(Number(id))) || new Set(visits.map(Number)).size !== visits.length)
    throw new DemoError("invalid_data", "Register or visit identifiers are missing, duplicated, or invalid.");
  const clean = cleanKijana(raw);
  const rows = latestStatus(clean.points, clean.visits, cutoff);
  const old = countFunctionality(rows);
  const observed = new Set(rows.map(p => p.id));
  const missing_ids = ids.filter(id => !observed.has(id));
  const total = ids.length;
  const pct = (n: number) => total ? Math.round(n / total * 1000) / 10 : null;
  const view: EvidenceView = {
    snapshot_id: hash(c.identity + cutoff).slice(0, 24), cutoff,
    counts: { ...old, total, observed_total: rows.length, missing_total: missing_ids.length, pct_full: pct(old.fully_working), pct_incl_partly: pct(old.fully_working + old.partly_working) },
    districts: [...new Set(clean.points.map(p => p.district))].sort(), groups: Object.fromEntries(Object.entries(priorityGroups(rows)).map(([id, list]) => [id, list.length])) as EvidenceView["groups"], rows, missing_ids, report: clean.report
  };
  if (!existsSync(snapshotFile(c, view.snapshot_id)))
    atomic(snapshotFile(c, view.snapshot_id), view);
  return view;
}
function status(r: DemoRecord) {
  const ts = Object.values(r.templates);
  return ts.some(t => t.approval?.sent_at) ? "sent" : ts.some(t => t.approval) ? "approved" : ts.length ? "filled" : r.french ? "translated" : r.completed.includes("validate") ? "validated" : r.completed.includes("clean") ? "cleaned" : r.facts.length ? "extracted" : "new";
}
function save(c: Context, r: DemoRecord) { r.status = status(r); atomic(recordFile(c, r.record_id), DemoRecord.parse(r)); }
function load(c: Context, id: string): DemoRecord {
  const file = recordFile(c, id);
  if (existsSync(file))
    return DemoRecord.parse(readJson(file));
  const meta = path.join(c.dir, "inbox", safeId(id) + ".json");
  if (!existsSync(meta))
    throw new DemoError("not_found", "Report not found.", 404);
  const s = Sidecar.parse(readJson(meta));
  if (s.record_id !== id)
    throw new DemoError("invalid_source", "Source metadata id does not match.");
  const e = snapshot(c, s.period_end);
  const map: {
    [key: string]: number | null;
  } = { pct_full: e.counts.pct_full, pct_incl_partly: e.counts.pct_incl_partly, count_total: e.counts.total, count_full: e.counts.fully_working, count_partly: e.counts.partly_working, count_not: e.counts.not_working };
  const metrics = Object.entries(map).filter(([, v]) => v !== null).map(([metric_id, value]) => ({ metric_id, cutoff: s.period_end, value })) as MetricRef[];
  const r = DemoRecord.parse({ ...s, dataset_id: c.dataset.id, original_text: readFileSync(path.join(c.dir, "inbox", id + ".txt"), "utf8"), preparer: "", revision: 0, status: "new", facts: [], changes: [], metrics, coverage: { total: e.counts.total, observed: e.counts.observed_total, missing_ids: e.missing_ids }, snapshot_id: e.snapshot_id, completed: [], french: null, templates: {} });
  save(c, r);
  return r;
}
export async function getRecord(id: string) { const c = context(); return serialized(c.runtime, async () => load(c, id)); }
export async function listInbox(): Promise<InboxSummary[]> {
  const c = context();
  return serialized(c.runtime, async () => readdirSync(path.join(c.dir, "inbox")).filter(f => f.endsWith(".json")).sort().map(f => {
    const id = f.slice(0, -5);
    const r = load(c, id);
    return { record_id: id, title: r.title, period: r.period, received_date: r.received_date, status: r.status };
  }));
}
export async function getEvidence(query: {
  snapshot?: string;
  cutoff?: string;
  definition?: string;
  group?: string;
  district?: string;
} = {}): Promise<EvidenceView> {
  const c = context();
  let e: EvidenceView;
  if (query.snapshot) {
    const f = snapshotFile(c, query.snapshot);
    if (!existsSync(f))
      throw new DemoError("snapshot_missing", "This saved evidence snapshot is unavailable.", 404);
    e = EvidenceView.parse(readJson(f));
  }
  else
    e = snapshot(c, query.cutoff || "2026-06-30");
  if (query.cutoff && query.cutoff !== e.cutoff)
    throw new DemoError("snapshot_mismatch", "Cutoff does not match this snapshot.");
  let rows = e.rows;
  if (query.definition) {
    if (query.definition !== "full_only" && query.definition !== "incl_partly")
      throw new DemoError("invalid_filter", "Unknown functionality definition.");
    rows = pointsBehind(rows, query.definition);
  }
  if (query.group) {
    if (!(query.group in e.groups))
      throw new DemoError("invalid_filter", "Unknown priority group.");
    const selected = new Set(priorityGroups(e.rows)[query.group as keyof typeof e.groups].map(p => p.id));
    rows = rows.filter(p => selected.has(p.id));
  }
  if (query.district)
    rows = rows.filter(p => p.district === query.district);
  return { ...e, districts: e.districts.length ? e.districts : [...new Set(e.rows.map(p => p.district))].sort(), rows };
}
function sources(c: Context, r: DemoRecord): Citable[] {
  return [...r.facts.map(f => ({ id: f.fact_id, value: f.value, unit: f.unit, valid: checkFact(f, r.original_text).check === "green" })),
  ...r.metrics.map(m => ({ id: m.metric_id, value: m.value, unit: m.metric_id.startsWith("pct") ? "%" : null, valid: true })),
  ...c.dataset.constants.map(s => ({ id: s.id, value: s.value, unit: s.unit, valid: !!s.source.trim() && checkFact({ ...s }, s.quote).check === "green" }))];
}
function standardVersion() { return hash(JSON.stringify(loadStandard())); }
function verify(c: Context, r: DemoRecord, t: DemoTemplate): DemoTemplate {
  const def = getTemplate(t.funder_id);
  const src = sources(c, r);
  t.fields = t.fields.map(f => ({ ...f, ...(f.kind === "number" ? checkNumericField(f.value, src.find(s => s.id === f.source?.id)) : checkNarrative(f.value, f.cites, src)) }));
  const required = [...def.numeric, ...def.narrative].map(f => f.key);
  const evidence = EvidenceView.parse(readJson(snapshotFile(c, r.snapshot_id)));
  const check = (rule_id: string, label: string, passed: boolean, message: string, severity: "block" | "warn" = "block") => ({ rule_id, label, passed, message, severity });
  const standard = loadStandard();
  const tolerance = Number(standard.rules.find(rule => rule.id === "functionality_cross_check")?.params.tolerance);
  if (!Number.isFinite(tolerance) || tolerance < 0) throw new DemoError("invalid_rule", "Invalid functionality comparison tolerance.");
  const reported = r.facts.find(f => f.label === "functionality_reported");
  const matches = reported && typeof reported.value === "number" ? r.metrics.filter(m => m.metric_id.startsWith("pct") && Math.abs(Number(reported.value) - m.value) <= tolerance).map(m => m.metric_id) : [];
  t.checks = [
    check("standard_version", "Current standard revision", t.standard_version === standardVersion(), "Rules or templates changed; regenerate and review this draft."),
    check("required_fields", "Required fields", required.every(k => t.fields.filter(f => f.key === k).length === 1) && t.fields.length === required.length && t.fields.every(f => !!f.value.trim()), "Every required field must be present once and filled."),
    check("facts", "Sourced facts", r.facts.length > 0 && r.facts.every(f => checkFact(f, r.original_text).check === "green"), "Facts require verbatim quotes and matching values."),
    check("numeric_integrity", "Verified fields", t.fields.every(f => f.check === "green"), "All numbers and citations must match their sources."),
    check("coverage", "Complete register coverage", r.coverage.total > 0 && r.coverage.observed === r.coverage.total, "Missing observations cannot shrink the denominator."),
    check("data_quality", "Known data rules", evidence.report.unmapped_status.length === 0, "Unknown statuses require human resolution."),
    check("workflow", "Required preparation", ["extract", "clean", "validate"].every(s => r.completed.includes(s)), "Extract, review cleaning, and validate before approval."),
    check("french", "French numerical integrity", t.language !== "fr" || r.french?.check === "green", "French draft must preserve source numbers."),
    check("functionality_cross_check", "Reported definition", matches.length > 0, matches.includes("pct_incl_partly") ? "The report matches the count including partly working points." : matches.length ? "The report matches fully working points." : "The reported figure does not match either definition.", "warn")
  ];
  return t;
}
const blocking = (t: DemoTemplate) => t.checks.filter(c => c.severity === "block" && !c.passed);
function requireValid(t: DemoTemplate) {
  if (blocking(t).length)
    throw new DemoError("checks_failed", blocking(t).map(c => c.label).join("; "));
}
function invalidate(r: DemoRecord) {
  for (const t of Object.values(r.templates)) {
    t.revision++;
    t.review = null;
    t.approval = null;
    t.disclosure = null;
  }
}
function expected(t: DemoTemplate, input: ActionInput) {
  if (input.expected_revision !== t.revision)
    throw new DemoError("stale_revision", "This draft changed. Reload and review its latest revision.", 409);
}
function guard(c: Context, r: DemoRecord, input: string) {
  const g = guardPersonalData(input);
  if (!g.ok) {
    const kinds = PERSONAL_DATA_PATTERNS.filter(({pattern}) => new RegExp(pattern).test(input)).map(p => p.id);
    audit(c, "system", "blocked", r.record_id, { reason: "personal_data_guard", kinds, count: g.matches.length });
    throw new DemoError("guard_blocked", "Personal data found (" + kinds.join(", ") + "). Remove it before continuing.");
  }
}
async function replay<T>(c: Context, r: DemoRecord, job: string, payload: unknown, schema: z.ZodType<T>, validate: (output: T) => string[], actor: string): Promise<T> {
  const skill = getSkill(job);
  if (!skill || skill.kind !== "ai" || !isRegistered(skill) || !skill.instruction)
    throw new DemoError("unregistered_skill", "This drafting job is not completely registered.");
  let failures: string[] = [];
  let output: T | undefined;
  for (const attempt of [1, 2]) {
    guard(c, r, r.original_text + "\n" + JSON.stringify(r.facts) + "\n" + failures.join("; "));
    const candidate = Array.isArray(payload) ? payload[Math.min(attempt - 1, payload.length - 1)] : payload;
    const parsed = schema.safeParse(candidate);
    audit(c, actor, "replay", r.record_id, { job, provider: "replay", attempt, skill_version: skill.version, simulated: true });
    if (!parsed.success) {
      failures = ["Recorded response has an invalid schema."];
      continue;
    }
    output = parsed.data;
    failures = validate(output);
    audit(c, "system", "verify", r.record_id, { job, attempt, passed: failures.length === 0, failures });
    if (!failures.length)
      return output;
  }
  if (output !== undefined)
    return output;
  throw new DemoError("replay_invalid", "Recorded response failed validation after two attempts.");
}
function exportContent(c: Context, r: DemoRecord, t: DemoTemplate) {
  const a = t.approval!;
  const def = getTemplate(t.funder_id);
  const disclosure = def.disclosure.replace("{approver}", a.approver).replace("{date}", a.content_approved_at.slice(0, 10));
  const fieldText = t.fields.map(f => "## " + f.label + "\n\n" + f.value + "\n\nSource: " + (f.source?.id || f.cites.join(", ") || "Qualitative statement")).join("\n\n");
  const provenance = sources(c, r).map(s => "- " + s.id + ": " + s.value + (s.unit || "")).join("\n");
  const constants = c.dataset.constants.map(s => "- " + s.id + ": " + s.source + "; " + s.period + "; " + s.definition).join("\n");
  return "# " + def.label + " — " + r.period + "\n\nFictional data / Données fictives. Replay demonstration.\n\n" + fieldText + "\n\n## Provenance\n\n" + r.source_location + "\nSnapshot: " + r.snapshot_id + "; cutoff: " + r.period_end + "; revision: " + t.revision + "\n\n" + provenance + "\n\n" + constants + "\n\n---\n\n" + disclosure + "\n";
}
const exportFile = (c: Context, id: string, funder: string, revision: number) => path.join(c.runtime, "exports", safeId(id) + "-" + safeId(funder) + "-r" + revision + ".md");
export async function getExport(id: string, funder_id: string, revision: number) {
  const c = context();
  safeId(id);
  if (!["fdf", "quebec"].includes(funder_id) || !Number.isSafeInteger(revision) || revision < 1)
    throw new DemoError("invalid_export", "Invalid export request.");
  const file = exportFile(c, id, funder_id, revision);
  if (!existsSync(file))
    throw new DemoError("not_exported", "Confirm the export before downloading.", 404);
  return { filename: path.basename(file), content: readFileSync(file, "utf8") };
}
export async function getLog() { const c = context(); const entries = auditEntries(c); return { entries, valid: chainValid(entries) }; }
export async function runAction(id: string, action: string, input: ActionInput = {}): Promise<DemoRecord> {
  const c = context();
  return serialized(c.runtime, async () => {
    const r = load(c, id);
    const actor = who(input.actor || input.preparer);
    if (!chainValid(auditEntries(c)))
      throw new DemoError("audit_corrupt", "Audit integrity failed.", 409);
    if (!r.preparer)
      r.preparer = who(input.preparer || actor);
    const replayFile = path.join(c.dir, "replay", safeId(id) + ".json");
    const recorded = () => {
      if (!existsSync(replayFile))
        throw new DemoError("replay_missing", "No recorded response is available for this report."); return readJson(replayFile);
    };
    if (action === "extract") {
      const p = recorded();
      const out = await replay(c, r, "extract_facts", { facts: p.facts }, ExtractSchema, d => d.facts.flatMap(f => checkFact(f, r.original_text).problems), actor);
      r.facts = out.facts.map((f, i) => ({ ...f, fact_id: "F-" + String(i + 1).padStart(2, "0"), ...checkFact(f, r.original_text) }));
      r.french = null;
      r.completed = ["extract"];
      invalidate(r);
    }
    else if (action === "clean" || action === "validate") {
      if (!r.facts.length)
        throw new DemoError("not_extracted", "Extract source facts first.");
      const e = EvidenceView.parse(readJson(snapshotFile(c, r.snapshot_id)));
      r.changes = e.report.changes;
      if (!r.completed.includes(action))
        r.completed.push(action);
      invalidate(r);
    }
    else if (action === "french") {
      if (!r.facts.length)
        throw new DemoError("not_extracted", "Extract source facts first.");
      const out = await replay(c, r, "draft_french", recorded().french, FrenchSchema, d => checkFrench(r.original_text, d.text).problems, actor);
      const check = checkFrench(r.original_text, out.text);
      r.french = { text: out.text, check: check.check, problems: check.problems };
      invalidate(r);
      r.completed.push("french");
    }
    else if (action === "template") {
      if (!r.facts.length)
        throw new DemoError("not_extracted", "Extract source facts first.");
      const def = getTemplate(input.funder_id || "fdf");
      const existing = r.templates[def.id];
      if (existing)
        expected(existing, input);
      const src = sources(c, r);
      const fields = def.numeric.map(f => { const s = src.find(s => s.id === f.source.id); return { ...f, kind: "number" as const, cites: [f.source.id], value: s ? new Intl.NumberFormat(def.language === "fr" ? "fr-CA" : "en-CA", { maximumFractionDigits: 5, useGrouping: false }).format(Number(s.value)) + (s.unit === "%" ? (def.language === "fr" ? " %" : "%") : "") : "", check: "red" as const, check_reason: null }; });
      const data = recorded().templates[def.id];
      if (!data)
        throw new DemoError("replay_missing", "No recorded template response.");
      const out = await replay(c, r, "fill_template", data.attempts, FillSchema, d => d.fields.flatMap(f => checkNarrative(f.value, f.cites, src).problems), actor);
      const t: DemoTemplate = { standard_version: standardVersion(), funder_id: def.id, language: def.language, preparer: r.preparer, revision: (existing?.revision || 0) + 1, fields: [...fields, ...out.fields.map(f => ({ ...f, label: def.narrative.find(n => n.key === f.key)?.label || f.key, kind: "narrative" as const, source: null, check: "red" as const, check_reason: null }))], checks: [], review: null, approval: null, disclosure: null };
      r.templates[def.id] = verify(c, r, t);
    }
    else if (["edit", "review", "approve", "export"].includes(action)) {
      if (input.funder_id !== "fdf" && input.funder_id !== "quebec")
        throw new DemoError("invalid_funder", "Choose a funder template.");
      const t = r.templates[input.funder_id];
      if (!t)
        throw new DemoError("template_missing", "Build this funder template first.");
      expected(t, input);
      if (action === "edit") {
        const f = t.fields.find(f => f.key === input.key);
        if (!f || f.kind !== "narrative" || typeof input.value !== "string" || input.value.length > 20000)
          throw new DemoError("invalid_edit", "Only a narrative field can be edited.");
        guard(c, r, input.value);
        const before = f.value;
        f.value = input.value;
        t.revision++;
        t.approval = null;
        t.review = null;
        t.disclosure = null;
        verify(c, r, t);
        audit(c, actor, "correct", id, { funder_id: t.funder_id, field: f.key, before, after: f.value, revision: t.revision });
      }
      else {
        verify(c, r, t);
        requireValid(t);
        if (action === "review") {
          if (t.language !== "fr")
            throw new DemoError("review_unneeded", "French review applies to the French template.");
          t.review = { actor, revision: t.revision, at: now() };
          audit(c, actor, "review", id, { funder_id: t.funder_id, revision: t.revision });
        }
        else {
          if (same(actor, t.preparer))
            throw new DemoError("self_approval", "The approver must be a different person from the preparer.");
          if (t.language === "fr" && t.review?.revision !== t.revision)
            throw new DemoError("french_review", "Current final French text requires bilingual human review.");
          if (action === "approve") {
            if (t.approval && same(t.approval.approver, actor) && t.approval.approved_revision === t.revision)
              return r;
            if (t.approval)
              throw new DemoError("already_approved", "Already approved by " + t.approval.approver);
            t.approval = { approver: actor, approved_revision: t.revision, content_approved_at: now(), sent_at: null };
            audit(c, actor, "approve", id, { funder_id: t.funder_id, revision: t.revision });
          }
          else {
            if (!t.approval || t.approval.approved_revision !== t.revision || !same(t.approval.approver, actor))
              throw new DemoError("not_approved", "The same approving person must confirm export of the current revision.");
            if (t.approval.sent_at)
              return r;
            const file = exportFile(c, id, t.funder_id, t.revision);
            mkdirSync(path.dirname(file), { recursive: true });
            const content = exportContent(c, r, t);
            if (existsSync(file) && readFileSync(file, "utf8") !== content)
              throw new DemoError("export_conflict", "This revision already has a different immutable export.", 409);
            if (!existsSync(file))
              writeFileSync(file, content, { encoding: "utf8", flag: "wx" });
            t.approval.sent_at = now();
            t.disclosure = getTemplate(t.funder_id).disclosure.replace("{approver}", actor).replace("{date}", t.approval.content_approved_at.slice(0, 10));
            audit(c, actor, "export", id, { funder_id: t.funder_id, revision: t.revision, filename: path.basename(file) });
          }
        }
      }
    }
    else
      throw new DemoError("unknown_action", "Unknown workflow action.", 404);
    r.revision++;
    r.completed = [...new Set(r.completed)];
    save(c, r);
    return r;
  });
}
