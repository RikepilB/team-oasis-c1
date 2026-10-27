import type { CatalogRecord, CatalogTemplate } from "@/lib/demo/catalog";
// Pure view logic for the Inbox: safe to import from client components.
export type ReportStatus = "received" | "draft" | "needs_review" | "approved" | "completed";
export type ReportView = "all" | "mine" | "action" | "unassigned" | "drafts" | "completed";
export const REPORT_VIEWS: ReportView[] = ["all", "mine", "action", "unassigned", "drafts", "completed"];
export const SUPPORTED_FUNDERS: CatalogTemplate["funder_id"][] = ["fdf", "quebec"];
// An approval only counts for the revision it was given on; any later edit makes it stale.
const currentApproval = (t: CatalogTemplate) => t.approved && t.approved_revision === t.revision;
const currentExport = (t: CatalogTemplate) => currentApproval(t) && t.exported;
const readyForReview = (t: CatalogTemplate) => t.prepared && t.blocking_checks.length === 0 && t.french_reviewed;
export function getReportStatus(r: CatalogRecord): ReportStatus {
  const ts = r.templates;
  // The record's own status says "sent" after one export, so completion is checked per funder.
  if (SUPPORTED_FUNDERS.every(id => ts.some(t => t.funder_id === id && currentExport(t)))) return "completed";
  if (ts.some(t => !currentApproval(t) && readyForReview(t))) return "needs_review";
  if (ts.some(t => currentApproval(t) && !t.exported)) return "approved";
  if (r.preparer?.trim() || r.completed.length || ts.length) return "draft";
  return "received";
}
export function matchesReportView(r: CatalogRecord, view: ReportView, me = ""): boolean {
  const status = getReportStatus(r);
  switch (view) {
    // "My reports": the acting person is the recorded preparer (the report's owner).
    case "mine": return !!me.trim() && r.preparer?.trim().toLocaleLowerCase("en-CA") === me.trim().toLocaleLowerCase("en-CA");
    case "action": return status === "needs_review" || status === "approved";
    // No preparer recorded yet: this is not a permissions model.
    case "unassigned": return !r.preparer?.trim();
    case "drafts": return status === "draft";
    case "completed": return status === "completed";
    default: return true;
  }
}
export type ReportFilters = { status?: ReportStatus | ""; project?: string; funder?: string; me?: string };
export function filterReports(rows: CatalogRecord[], view: ReportView, query = "", filters: ReportFilters = {}): CatalogRecord[] {
  const q = query.trim().toLocaleLowerCase("en-CA");
  return rows.filter(r => matchesReportView(r, view, filters.me)
    && (!q || [r.title, r.record_id, r.period, r.project, r.funder, r.preparer, r.source_location].some(v => v?.toLocaleLowerCase("en-CA").includes(q)))
    && (!filters.status || getReportStatus(r) === filters.status)
    && (!filters.project || r.project === filters.project)
    && (!filters.funder || r.funder === filters.funder));
}
export function nextAction(r: CatalogRecord): { en: string; fr: string } {
  switch (getReportStatus(r)) {
    case "received": return { en: "Start preparing", fr: "Commencer la préparation" };
    case "needs_review": return { en: "Review and approve", fr: "Réviser et approuver" };
    case "approved": return { en: "Confirm export", fr: "Confirmer l’export" };
    case "completed": return { en: "No action", fr: "Aucune action" };
    default: {
      const t = r.templates.find(t => t.blocking_checks.length > 0);
      if (t) return { en: "Resolve blocking checks", fr: "Corriger les contrôles bloquants" };
      if (r.templates.some(t => !t.french_reviewed)) return { en: "Review the French", fr: "Réviser le français" };
      return { en: "Continue the draft", fr: "Poursuivre l’ébauche" };
    }
  }
}

// Funder deadlines come from the pack's Annual Operating Calendar (1.4). Water Care's fiscal year runs April to March,
// and the FDF financial report for each quarter is due on these dates. Other funders have no deadline in the pack.
const FDF_DUE: Record<1 | 2 | 3 | 4, [month: number, day: number, nextYear: boolean]> = { 1: [7, 31, false], 2: [10, 31, false], 3: [1, 31, true], 4: [4, 30, true] };
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
/** The fiscal quarter and fiscal-year start a report period covers, from "Q1 FY2026-27" or "May 2026 …". */
export function fiscalQuarter(period: string): { quarter: 1 | 2 | 3 | 4; fyStart: number } | null {
  const q = period.match(/Q([1-4])\s*FY(\d{4})/i);
  if (q) return { quarter: Number(q[1]) as 1 | 2 | 3 | 4, fyStart: Number(q[2]) };
  const m = period.toLowerCase().match(new RegExp("(" + MONTHS.join("|") + ")\\s+(\\d{4})"));
  if (!m) return null;
  const month = MONTHS.indexOf(m[1]) + 1, year = Number(m[2]);
  const fyStart = month >= 4 ? year : year - 1;
  const quarter = (Math.floor(((month + 8) % 12) / 3) + 1) as 1 | 2 | 3 | 4;
  return { quarter, fyStart };
}
/** The funder deadline this report feeds into, or null when the pack gives none. ISO date. */
export function dueDate(r: CatalogRecord): { date: string; quarter: number } | null {
  if (r.funder !== "FDF") return null;
  const fq = fiscalQuarter(r.period);
  if (!fq) return null;
  const [month, day, nextYear] = FDF_DUE[fq.quarter];
  const year = fq.fyStart + (nextYear ? 1 : 0);
  return { date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, quarter: fq.quarter };
}

// Priority order for every list: P0, then P1, then P2, then reports with no priority; then by due date.
export const PRIORITY_RANK: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
export const priorityRank = (r: CatalogRecord) => r.priority ? PRIORITY_RANK[r.priority.level] ?? 3 : 3;
