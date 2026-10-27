import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { aiMode, getRecord, listRecords, runAction } from "@/lib/demo/workflow";
import { atomic, context, runtimeExists, serialized } from "@/lib/demo/store";
import { Sidecar } from "@/lib/demo/types";
export type CatalogTemplate = { funder_id: "fdf" | "quebec"; language: "en" | "fr"; revision: number; approved_revision: number | null; approved: boolean; exported: boolean; prepared: boolean; french_reviewed: boolean; blocking_checks: string[] };
export type Priority = { level: "P0" | "P1" | "P2"; set_by: string; set_at: string; reason: string };
export type CatalogRecord = { priority?: Priority | null; record_id: string; title: string; period: string; received_date: string; status: string; source_file: string; source_location: string; project: string | null; funder: string | null; preparer: string | null; completed: string[]; templates: CatalogTemplate[] };
export type Catalog = CatalogRecord[];
// Project and funder live only in the original sidecar; the stored record drops them, so read them back here.
function sidecarOf(dir: string, id: string): { project: string | null; funder: string | null } {
  const file = path.join(dir, "inbox", id + ".json");
  if (!existsSync(file)) return { project: null, funder: null };
  const s = Sidecar.safeParse(JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, "")));
  return s.success ? { project: s.data.project, funder: s.data.funder } : { project: null, funder: null };
}
// Who prioritised which report, when and why: a small file beside the demo data (sample data in the demo).
function prioritiesOf(dir: string): Record<string, Priority> {
  const file = path.join(dir, "priorities.json");
  if (!existsSync(file)) return {};
  try { return JSON.parse(readFileSync(file, "utf8")).priorities ?? {}; } catch { return {}; }
}
// A fresh demo replays the sample steps in seed.json once, so "Needs action" isn't empty on first open.
// Set SYNAPSE_SEED=off to start every report from scratch. The sample is recorded work, so AI_MODE=live skips
// it rather than making billable model calls on the first Inbox load.
type SeedStep = { id: string; action: string; actor: string; funder_id?: "fdf" | "quebec" };
let seeding: Promise<void> | null = null;
async function seedOnce(): Promise<void> {
  if (process.env.SYNAPSE_SEED === "off" || aiMode() === "live") return;
  const c = context();
  const file = path.join(c.dir, "seed.json");
  if (!existsSync(file)) return;
  const marker = path.join(c.runtime, "seeded.json");
  const steps: SeedStep[] = JSON.parse(readFileSync(file, "utf8")).steps ?? [];
  // Claim the sample before running it, under the shared lock (one PostgreSQL transaction in production), so
  // another server instance never replays it over reports people have since reviewed or approved. The claim
  // stays if a step fails: the sample is never replayed twice.
  const claimed = await serialized(c.runtime, async () => {
    if (runtimeExists(marker)) return false;
    atomic(marker, { seeded_at: new Date().toISOString(), steps: steps.length });
    return true;
  });
  if (!claimed) return;
  for (const s of steps) {
    const current = await getRecord(s.id);
    const tpl = s.funder_id ? current.templates[s.funder_id] : undefined;
    await runAction(s.id, s.action, { actor: s.actor, preparer: "Daniel", ...(s.funder_id ? { funder_id: s.funder_id } : {}), ...(tpl ? { expected_revision: tpl.revision } : {}) });
  }
}
export async function reportCatalog(): Promise<Catalog> {
  seeding ??= seedOnce().catch(() => { /* a sample step failing must not hide the inbox */ }).finally(() => { seeding = null; });
  await seeding;
  const records = await listRecords();
  const dir = context().dir;
  const priorities = prioritiesOf(dir);
  return records.map(r => ({
    priority: priorities[r.record_id] ?? null, record_id: r.record_id, title: r.title, period: r.period, received_date: r.received_date, status: r.status, source_file: r.source_file, source_location: r.source_location,
    ...sidecarOf(dir, r.record_id), preparer: r.preparer.trim() || null, completed: r.completed,
    templates: Object.values(r.templates).map(t => ({
      funder_id: t.funder_id, language: t.language, revision: t.revision, approved_revision: t.approval?.approved_revision ?? null, approved: !!t.approval, exported: !!t.approval?.sent_at,
      prepared: t.fields.length > 0 && t.fields.every(f => f.value.trim() !== ""), french_reviewed: t.language !== "fr" || t.review?.revision === t.revision,
      blocking_checks: t.checks.filter(c => c.severity === "block" && !c.passed).map(c => c.label)
    }))
  }));
}
