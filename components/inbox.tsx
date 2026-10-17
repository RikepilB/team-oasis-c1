"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useLanguage, useRemote, Message, Loading } from "@/components/shell";
import type { Catalog } from "@/lib/demo/catalog";
import { REPORT_VIEWS, filterReports, getReportStatus, matchesReportView, nextAction, type ReportStatus, type ReportView } from "@/lib/demo/presentation";
const VIEW_LABELS: Record<ReportView, [string, string]> = { all: ["All reports", "Tous les rapports"], action: ["Needs action", "Action requise"], unassigned: ["Unassigned", "Non attribués"], drafts: ["Drafts", "Ébauches"], completed: ["Completed", "Terminés"] };
const STATUS_LABELS: Record<ReportStatus, [string, string]> = { received: ["Received", "Reçu"], draft: ["Draft", "Ébauche"], needs_review: ["Needs review", "À réviser"], approved: ["Approved · export pending", "Approuvé · export en attente"], completed: ["Completed", "Terminé"] };
const isView = (v: string | null): v is ReportView => !!v && (REPORT_VIEWS as string[]).includes(v);
export function Inbox({ mode = "inbox" }: { mode?: "inbox" | "reports" }) {
  const { t, language } = useLanguage();
  const params = useSearchParams();
  const view: ReportView = mode === "inbox" && isView(params.get("view")) ? params.get("view") as ReportView : "all";
  const { data, error, loading } = useRemote<Catalog>("/api/reports");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ReportStatus | "">("");
  const [project, setProject] = useState("");
  const [funder, setFunder] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);
  const rows = data ?? [];
  const projects = [...new Set(rows.map(r => r.project).filter((v): v is string => !!v))].sort();
  const funders = [...new Set(rows.map(r => r.funder).filter((v): v is string => !!v))].sort();
  const items = filterReports(rows, view, query, { status, project, funder }).sort((a, b) => (newestFirst ? -1 : 1) * a.received_date.localeCompare(b.received_date));
  const filtered = !!(query.trim() || status || project || funder);
  const clear = () => { setQuery(""); setStatus(""); setProject(""); setFunder(""); };
  const date = (d: string) => new Date(d + "T12:00:00").toLocaleDateString(language === "fr" ? "fr-CA" : "en-CA", { year: "numeric", month: "short", day: "numeric" });
  return <main id="main" className="page inbox-page">
    <div className="page-heading">{mode === "inbox" ? <><h1>{t("Inbox", "Boîte de réception")}</h1><p className="muted">{t("Programme reports received for funder reporting. Open one to check its sources, prepare the funder versions and approve them.", "Rapports de programme reçus pour les bailleurs. Ouvrez-en un pour vérifier ses sources, préparer les versions et les approuver.")}</p></> : <><h1>{t("Reports", "Rapports")}</h1><p className="muted">{t("Every programme report and where it stands, across both funder versions.", "Tous les rapports de programme et leur état, pour les deux versions de bailleurs.")}</p></>}</div>
    {mode === "inbox" && <nav className="inbox-views" aria-label={t("Saved views", "Vues enregistrées")}>
      {REPORT_VIEWS.map(v => <Link key={v} href={v === "all" ? "/" : "/?view=" + v} aria-current={view === v ? "page" : undefined} scroll={false}>{t(...VIEW_LABELS[v])}{data && <span className="inbox-count">{rows.filter(r => matchesReportView(r, v)).length}</span>}</Link>)}
    </nav>}
    <div className="inbox-filters">
      <label className="inbox-search">{t("Search", "Rechercher")}<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t("Title, ID, project or funder", "Titre, identifiant, projet ou bailleur")} /></label>
      <label>{t("Status", "État")}<select value={status} onChange={e => setStatus(e.target.value as ReportStatus | "")}><option value="">{t("Any status", "Tous les états")}</option>{(Object.keys(STATUS_LABELS) as ReportStatus[]).map(s => <option key={s} value={s}>{t(...STATUS_LABELS[s])}</option>)}</select></label>
      <label>{t("Project", "Projet")}<select value={project} onChange={e => setProject(e.target.value)}><option value="">{t("All projects", "Tous les projets")}</option>{projects.map(p => <option key={p}>{p}</option>)}</select></label>
      <label>{t("Funder", "Bailleur")}<select value={funder} onChange={e => setFunder(e.target.value)}><option value="">{t("All funders", "Tous les bailleurs")}</option>{funders.map(f => <option key={f}>{f}</option>)}</select></label>
    </div>
    <Message error={error} />
    {loading ? <Loading /> : <>
      <p className="inbox-summary" role="status">{t(`${items.length} of ${rows.length} reports`, `${items.length} rapports sur ${rows.length}`)}{filtered && <button type="button" className="link-button" onClick={clear}>{t("Clear filters", "Effacer les filtres")}</button>}</p>
      {items.length === 0 ? <div className="panel inbox-empty"><p>{t("No reports match this view.", "Aucun rapport ne correspond à cette vue.")}</p>{filtered ? <button type="button" className="secondary" onClick={clear}>{t("Clear filters", "Effacer les filtres")}</button> : view !== "all" && <Link className="secondary" href="/">{t("Show all reports", "Afficher tous les rapports")}</Link>}</div> :
        <div className="inbox-table-wrap" tabIndex={0} role="region" aria-label={t("Reports", "Rapports")}>
          <table className="inbox-table">
            <thead><tr><th scope="col">{t("Report", "Rapport")}</th><th scope="col">{t("Project", "Projet")}</th><th scope="col">{t("Funder", "Bailleur")}</th><th scope="col">{t("Period", "Période")}</th><th scope="col" aria-sort={newestFirst ? "descending" : "ascending"}><button type="button" className="sort-button" onClick={() => setNewestFirst(!newestFirst)}>{t("Received", "Reçu")} <span aria-hidden="true">{newestFirst ? "↓" : "↑"}</span></button></th><th scope="col">{t("Preparer", "Préparateur")}</th><th scope="col">{t("Status", "État")}</th><th scope="col">{t("Next action", "Prochaine action")}</th></tr></thead>
            <tbody>{items.map(r => { const s = getReportStatus(r); return <tr key={r.record_id}>
              <th scope="row"><Link href={"/runs/" + r.record_id}>{r.title}</Link><small>{r.record_id}</small></th>
              <td>{r.project ?? "—"}</td><td>{r.funder ?? "—"}</td><td className="numeric">{r.period}</td><td className="numeric">{date(r.received_date)}</td>
              <td>{r.preparer ?? <span className="muted">{t("Unassigned", "Non attribué")}</span>}</td>
              <td><span className="status-pill" data-status={s}>{t(...STATUS_LABELS[s])}</span></td>
              <td><Link className="next-action" href={"/runs/" + r.record_id}>{t(nextAction(r).en, nextAction(r).fr)} <span aria-hidden="true">→</span></Link></td>
            </tr>; })}</tbody>
          </table>
        </div>}
    </>}
  </main>;
}
