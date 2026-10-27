"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useLanguage, usePreferences, useRemote, Message, Loading } from "@/components/shell";
import { Tip } from "@/components/ui";
import type { Catalog, CatalogRecord } from "@/lib/demo/catalog";
import { REPORT_VIEWS, dueDate, filterReports, priorityRank, getReportStatus, matchesReportView, nextAction, type ReportStatus, type ReportView } from "@/lib/demo/presentation";
const VIEW_LABELS: Record<ReportView, [string, string]> = { all: ["All reports", "Tous les rapports"], mine: ["My reports", "Mes rapports"], action: ["Needs action", "Action requise"], unassigned: ["Unassigned", "Non attribués"], drafts: ["Drafts", "Ébauches"], completed: ["Completed", "Terminés"] };
const STATUS_LABELS: Record<ReportStatus, [string, string]> = { received: ["Received", "Reçu"], draft: ["Draft", "Ébauche"], needs_review: ["Needs review", "À réviser"], approved: ["Approved · export pending", "Approuvé · export en attente"], completed: ["Completed", "Terminé"] };
const isView = (v: string | null): v is ReportView => !!v && (REPORT_VIEWS as string[]).includes(v);
const PRIORITY_TEXT: Record<string, [string, string, string, string]> = { P0: ["P0", "Do first", "P0", "En premier"], P1: ["P1", "Next", "P1", "Ensuite"], P2: ["P2", "Later", "P2", "Plus tard"] };
// Traffic-light priority: a coloured light plus the level and a word, so colour is never the only signal.
export function PriorityBadge({ r, compact }: { r: CatalogRecord; compact?: boolean }) {
  const { t, language } = useLanguage();
  if (!r.priority) return <span className="priority-none" aria-label={t("No priority set", "Aucune priorité")}>—</span>;
  const [lvl, en, , fr] = PRIORITY_TEXT[r.priority.level];
  const when = new Date(r.priority.set_at + "T12:00:00").toLocaleDateString(language === "fr" ? "fr-CA" : "en-CA", { month: "short", day: "numeric" });
  return <Tip text={t(`Set by ${r.priority.set_by}, ${when}. ${r.priority.reason}`, `Fixée par ${r.priority.set_by}, ${when}. ${r.priority.reason}`)}>
    <span className="priority-badge" data-level={lvl}><span className="priority-light" aria-hidden="true" /><strong>{lvl}</strong>{!compact && <span className="priority-word">{t(en, fr)}</span>}</span>
    {!compact && <small className="priority-by">{r.priority.set_by.split(",")[0]} · {when}</small>}
  </Tip>;
}
export function Inbox({ mode = "inbox" }: { mode?: "inbox" | "reports" }) {
  const { t, language } = useLanguage();
  const params = useSearchParams();
  const view: ReportView = mode === "inbox" && isView(params.get("view")) ? params.get("view") as ReportView : "all";
  const { name: me } = usePreferences();
  const { data, error, loading } = useRemote<Catalog>("/api/reports");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ReportStatus | "">("");
  const [project, setProject] = useState("");
  const [funder, setFunder] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);
  const rows = data ?? [];
  const projects = [...new Set(rows.map(r => r.project).filter((v): v is string => !!v))].sort();
  const funders = [...new Set(rows.map(r => r.funder).filter((v): v is string => !!v))].sort();
  const items = filterReports(rows, view, query, { status, project, funder, me }).sort((a, b) => priorityRank(a) - priorityRank(b) || (newestFirst ? -1 : 1) * ((dueDate(a)?.date ?? "9999") + a.received_date).localeCompare((dueDate(b)?.date ?? "9999") + b.received_date));
  const filtered = !!(query.trim() || status || project || funder);
  const clear = () => { setQuery(""); setStatus(""); setProject(""); setFunder(""); };
  const date = (d: string) => new Date(d + "T12:00:00").toLocaleDateString(language === "fr" ? "fr-CA" : "en-CA", { year: "numeric", month: "short", day: "numeric" });
  return <main id="main" className="page inbox-page">
    <div className="page-heading">{mode === "inbox" ? <><h1>{t("Inbox", "Boîte de réception")}</h1><p className="muted">{t("Reports sent in by programme teams. Open one to check it, prepare the funder version and get it approved.", "Rapports envoyés par les équipes de programme. Ouvrez-en un pour le vérifier, préparer la version du bailleur et la faire approuver.")}</p></> : <><h1>{t("Reports", "Rapports")}</h1><p className="muted">{t("Every programme report and where it stands, across both funder versions.", "Tous les rapports de programme et leur état, pour les deux versions de bailleurs.")}</p></>}</div>
    {mode === "inbox" && <nav className="inbox-views" aria-label={t("Saved views", "Vues enregistrées")}>
      {REPORT_VIEWS.map(v => <Link key={v} href={v === "all" ? "/" : "/?view=" + v} aria-current={view === v ? "page" : undefined} scroll={false}>{t(...VIEW_LABELS[v])}{data && (() => { const n = rows.filter(r => matchesReportView(r, v, me)).length; return <span className={"inbox-count" + (view === v ? " is-active" : "") + (v === "action" && n > 0 ? " is-important" : "")} aria-label={t(`${n} reports`, `${n} rapports`)}>{n}</span>; })()}</Link>)}
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
      {items.length === 0 ? <div className="panel inbox-empty"><p>{view === "mine" && !filtered ? t(`No reports are owned by ${me || "you"} yet. A report becomes yours when you run its first step as the preparer.`, `Aucun rapport n’appartient encore à ${me || "vous"}. Un rapport devient le vôtre quand vous lancez sa première étape comme préparateur.`) : t("No reports match this view.", "Aucun rapport ne correspond à cette vue.")}</p>{filtered ? <button type="button" className="secondary" onClick={clear}>{t("Clear filters", "Effacer les filtres")}</button> : view !== "all" && <Link className="secondary" href="/">{t("Show all reports", "Afficher tous les rapports")}</Link>}</div> :
        <div className="inbox-table-wrap" tabIndex={0} role="region" aria-label={t("Reports", "Rapports")}>
          <table className="inbox-table">
            <thead><tr><th scope="col" className="col-priority">{t("Priority", "Priorité")}</th><th scope="col">{t("Report", "Rapport")}</th><th scope="col" aria-sort={newestFirst ? "descending" : "ascending"}><button type="button" className="sort-button" onClick={() => setNewestFirst(!newestFirst)}>{t("Due", "Échéance")} <span aria-hidden="true">{newestFirst ? "↓" : "↑"}</span></button></th><th scope="col">{t("Owner", "Responsable")}</th><th scope="col">{t("Status · next step", "État · prochaine étape")}</th></tr></thead>
            <tbody>{items.map(r => { const s = getReportStatus(r); return <tr key={r.record_id} data-priority={r.priority?.level}><td className="col-priority"><PriorityBadge r={r} /></td>
              <th scope="row"><Link href={"/runs/" + r.record_id}>{r.title}</Link>{r.source_location.startsWith("Sample data") && <Tip text={t("A fictional project written in the style of a Water Care programme report, for demonstration only.", "Projet fictif rédigé dans le style d’un rapport de programme de Water Care, pour la démonstration.")}><span className="sample-chip">{t("Sample data", "Données d’exemple")}</span></Tip>}<small>{r.funder ?? "—"} · {t("Received", "Reçu")} {date(r.received_date)} · {r.record_id}</small></th>
              <td className="numeric">{(() => { const d = dueDate(r); return d
                ? <Tip text={t(`FDF Q${d.quarter} financial report deadline, from the Annual Operating Calendar.`, `Échéance du rapport financier FDF T${d.quarter}, selon le calendrier annuel.`)}>{date(d.date)}</Tip>
                : <Tip text={t("No deadline for this funder in the operating calendar.", "Aucune échéance pour ce bailleur dans le calendrier.")}><span className="muted">—</span></Tip>; })()}</td>
              <td>{r.preparer ? <span className="owner"><span className="owner-avatar" aria-hidden="true">{r.preparer.trim()[0]?.toUpperCase()}</span>{r.preparer}</span> : <Tip text={t("No preparer yet. Whoever runs the first step as preparer becomes the owner.", "Pas encore de préparateur. La personne qui lance la première étape devient responsable.")}><span className="muted">{t("Unassigned", "Non attribué")}</span></Tip>}</td>
              <td className="col-status"><span className="status-pill" data-status={s}>{t(...STATUS_LABELS[s])}</span>{s !== "completed" && <Link className="next-action" href={"/runs/" + r.record_id}>{t(nextAction(r).en, nextAction(r).fr)} <span aria-hidden="true">→</span></Link>}</td>
            </tr>; })}</tbody>
          </table>
        </div>}
    </>}
  </main>;
}
