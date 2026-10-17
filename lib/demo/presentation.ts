import type { CatalogRecord, CatalogTemplate } from "@/lib/demo/catalog";
// Pure view logic for the Inbox: safe to import from client components.
export type ReportStatus = "received" | "draft" | "needs_review" | "approved" | "completed";
export type ReportView = "all" | "action" | "unassigned" | "drafts" | "completed";
export const REPORT_VIEWS: ReportView[] = ["all", "action", "unassigned", "drafts", "completed"];
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
export function matchesReportView(r: CatalogRecord, view: ReportView): boolean {
  const status = getReportStatus(r);
  switch (view) {
    case "action": return status === "needs_review" || status === "approved";
    // No preparer recorded yet: this is not a permissions model.
    case "unassigned": return !r.preparer?.trim();
    case "drafts": return status === "draft";
    case "completed": return status === "completed";
    default: return true;
  }
}
export type ReportFilters = { status?: ReportStatus | ""; project?: string; funder?: string };
export function filterReports(rows: CatalogRecord[], view: ReportView, query = "", filters: ReportFilters = {}): CatalogRecord[] {
  const q = query.trim().toLocaleLowerCase("en-CA");
  return rows.filter(r => matchesReportView(r, view)
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
