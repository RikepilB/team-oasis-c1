import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { listRecords } from "@/lib/demo/workflow";
import { context } from "@/lib/demo/store";
import { Sidecar } from "@/lib/demo/types";
export type CatalogTemplate = { funder_id: "fdf" | "quebec"; language: "en" | "fr"; revision: number; approved_revision: number | null; approved: boolean; exported: boolean; prepared: boolean; french_reviewed: boolean; blocking_checks: string[] };
export type CatalogRecord = { record_id: string; title: string; period: string; received_date: string; status: string; source_file: string; source_location: string; project: string | null; funder: string | null; preparer: string | null; completed: string[]; templates: CatalogTemplate[] };
export type Catalog = CatalogRecord[];
// Project and funder live only in the original sidecar; the stored record drops them, so read them back here.
function sidecarOf(dir: string, id: string): { project: string | null; funder: string | null } {
  const file = path.join(dir, "inbox", id + ".json");
  if (!existsSync(file)) return { project: null, funder: null };
  const s = Sidecar.safeParse(JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, "")));
  return s.success ? { project: s.data.project, funder: s.data.funder } : { project: null, funder: null };
}
export async function reportCatalog(): Promise<Catalog> {
  const records = await listRecords();
  const dir = context().dir;
  return records.map(r => ({
    record_id: r.record_id, title: r.title, period: r.period, received_date: r.received_date, status: r.status, source_file: r.source_file, source_location: r.source_location,
    ...sidecarOf(dir, r.record_id), preparer: r.preparer.trim() || null, completed: r.completed,
    templates: Object.values(r.templates).map(t => ({
      funder_id: t.funder_id, language: t.language, revision: t.revision, approved_revision: t.approval?.approved_revision ?? null, approved: !!t.approval, exported: !!t.approval?.sent_at,
      prepared: t.fields.length > 0 && t.fields.every(f => f.value.trim() !== ""), french_reviewed: t.language !== "fr" || t.review?.revision === t.revision,
      blocking_checks: t.checks.filter(c => c.severity === "block" && !c.passed).map(c => c.label)
    }))
  }));
}
