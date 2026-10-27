"use client";
import Link from "next/link";
import { useState } from "react";
import { api, useLanguage, useRemote, usePreferences, useAssistant, Message, Loading, Badge } from "@/components/shell";
import type { DemoRecord, DemoTemplate } from "@/lib/demo/types";
import type { AuditEvent } from "@/lib/demo/types";
import workflow from "@/standard/workflows/funder-report.json";
import { TABS, STEP_TAB, type Tab } from "@/lib/demo/report-tabs";
import { actionFor, canDo, whoCan, ROLE_LABEL } from "@/lib/demo/people";
import { GuardedButton, Tip, ExportDialog, downloadFile, type ExportFormat } from "@/components/ui";
import { PersonSelect, SwitchNotice, usePerson } from "@/components/person-switcher";
import { publishRecord, useLiveRecord } from "@/components/live-record";
import { FrenchDocuments } from "@/components/french-review";
const CHECK_FR: Record<string, string> = { standard_version: "Version actuelle du référentiel", required_fields: "Champs obligatoires", facts: "Faits sourcés", numeric_integrity: "Champs vérifiés", coverage: "Couverture complète", data_quality: "Règles de qualité des données", workflow: "Préparation obligatoire", french: "Conservation des chiffres en français", functionality_cross_check: "Définition du taux déclaré" };
const STEPS = workflow.steps.map(step => [step.id, step.label_en, step.label_fr]);
const FUNDERS: Record<"fdf" | "quebec", [string, string]> = { fdf: ["FDF · English", "FDF · anglais"], quebec: ["Fondation du Québec · French", "Fondation du Québec · français"] };
export default function RunWorkspace({ id, tab, initialFunder }: { id: string; tab: Tab; initialFunder?: string }) {
  const { t, language } = useLanguage();
  // Shared with the assistant, so a French decision there updates this page at once.
  const remote = useLiveRecord(id);
  const record = remote.record;
  const prefs = usePreferences();
  const assistant = useAssistant();
  // The person picked in the sidebar acts. No typed override, so a switch can never leave the old name acting.
  const person = usePerson();
  const actor = person.name;
  const preparer = record?.preparer || person.name;
  const allowed = (step: string) => canDo(person.role, actionFor(step));
  const [funderPicked, setFunder] = useState<"fdf" | "quebec" | null>(initialFunder === "quebec" || initialFunder === "fdf" ? initialFunder : null);
  const funder = funderPicked ?? prefs.defaultFunder;
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [exportDialog, setExportDialog] = useState<null | "confirm" | "download">(null);
  const template = record?.templates[funder];
  const percent = (n: number) => new Intl.NumberFormat(language === "fr" ? "fr-CA" : "en-CA", { maximumFractionDigits: 1 }).format(n) + (language === "fr" ? " %" : "%");
  const evidence = (definition: string) => "/evidence/water-points?snapshot=" + record?.snapshot_id + "&cutoff=" + record?.period_end + "&definition=" + definition;
  const href = (to: Tab) => "/runs/" + encodeURIComponent(id) + (to === "overview" ? "" : "?tab=" + to) + (funder === "quebec" ? (to === "overview" ? "?" : "&") + "funder=quebec" : "");
  async function action(name: string, extra: Record<string, unknown> = {}): Promise<boolean> {
    setBusy(name); setError(""); setNotice("");
    try {
      const next = await api<DemoRecord>("/api/reports/" + id + "/" + name, { actor: actor || preparer, preparer: preparer || actor, funder_id: funder, ...(template ? { expected_revision: template.revision } : {}), ...extra });
      publishRecord(next);
      setNotice(t("Saved. Checks and review state are up to date.", "Enregistré. Les contrôles et les révisions sont à jour."));
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Request failed"); return false; }
    finally { setBusy(""); }
  }
  const named = !!(actor || preparer).trim();
  // Every unavailable action says why, as the next thing to do (design system v3.2: no silent dead buttons).
  const roleReason = (step: string) => { const to = whoCan(actionFor(step)); return t("Only the " + ROLE_LABEL[to.role][0].toLowerCase() + " can do this. Switch to " + to.name + " under “Acting as”.", "Seul le rôle " + ROLE_LABEL[to.role][1].toLowerCase() + " peut le faire. Choisissez " + to.name + " sous « Agir en tant que ».") };
  const stepReason = (step: string) => !named ? t("Pick a person under “Acting as” first.", "Choisissez d’abord une personne sous « Agir en tant que ».") : !allowed(step) ? roleReason(step) : null;
  const button = (name: string, en: string, fr: string, extra?: Record<string, unknown>) => <><GuardedButton className="primary" busy={!!busy} reason={stepReason(name)} onClick={() => void action(name, extra)}>{busy === name ? t("Checking…", "Vérification…") : t(en, fr)} <span aria-hidden="true">→</span></GuardedButton>{named && !allowed(name) && <SwitchNotice action={actionFor(name)} />}</>;
  if (remote.loading && !record) return <main id="main" className="page"><Loading /></main>;
  if (!record) return <main id="main" className="page"><Message error={remote.error} /><Link href="/">{t("Back to the Inbox", "Retour à la boîte de réception")}</Link></main>;
  const openFrench = record.french?.items.filter(i => !i.decision).length ?? 0;
  const metric = (key: string) => record.metrics.find(m => m.metric_id === key)?.value;
  const blocks = (tpl?: DemoTemplate) => tpl?.checks.filter(c => c.severity === "block" && !c.passed) || [];
  const frenchPending = (tpl?: DemoTemplate) => tpl?.language === "fr" && tpl.review?.revision !== tpl.revision;
  const stepDone = (key: string) => record.completed.includes(key) || key === "record" || (key === "template" && !!template) || (key === "review" && (!!template?.review || template?.language === "en")) || (key === "approve" && !!template?.approval) || (key === "export" && !!template?.approval?.sent_at);
  const nextStep = STEPS.find(([key]) => !stepDone(key));
  const notNamed = !named && <p className="muted small">{t("Pick a person in the sidebar, or enter a custom name in Settings, to run this step.", "Choisissez une personne dans le menu, ou un nom dans Paramètres, pour lancer cette étape.")}</p>;
  // The bar names who acts next instead of showing two dead buttons.
  const barAction = !template || template.approval?.sent_at ? null : frenchPending(template) ? "review" : template.approval?.approved_revision === template.revision ? "export" : "approve";
  const selfApproval = !!template && allowed("approve") && actor.trim().toLowerCase() === template.preparer.trim().toLowerCase();
  const approveReason = !template ? t("Build this funder version first, under Standardized draft.", "Créez d’abord cette version dans Ébauche normalisée.")
    : stepReason("approve") ?? (selfApproval ? t("You prepared this version. A different person must approve it.", "Vous avez préparé cette version. Une autre personne doit l’approuver.")
    : blocks(template).length ? t("Fix the blocking checks first: ", "Corrigez d’abord les contrôles bloquants : ") + blocks(template).map(c => t(c.label, CHECK_FR[c.rule_id] || c.label)).join(", ") + t(". See Issues & evidence.", ". Voir Problèmes et données.")
    : frenchPending(template) ? t("Finish the bilingual review under French version first.", "Terminez d’abord la révision bilingue dans Version française.")
    : template.approval?.approved_revision === template.revision ? t("This revision is already approved. Next: confirm export.", "Cette révision est déjà approuvée. Suite : confirmer l’export.") : null);
  const exportReason = !template ? t("Build this funder version first, under Standardized draft.", "Créez d’abord cette version dans Ébauche normalisée.")
    : template.approval?.sent_at ? t("Already exported. Use Download to get the file again.", "Déjà exportée. Utilisez Télécharger pour obtenir le fichier.")
    : !template.approval || template.approval.approved_revision !== template.revision ? t("Approve the content first. Export is step 2 of 2.", "Approuvez d’abord le contenu. L’export est l’étape 2 sur 2.")
    : stepReason("export");
  const when = (at: string) => { const d = new Date(at); return isNaN(d.getTime()) ? at : d.toLocaleString(language === "fr" ? "fr-CA" : "en-CA", { dateStyle: "medium", timeStyle: "short" }); };
  const exportHref = (format: ExportFormat) => template ? "/api/reports/" + id + "/export?funder_id=" + funder + "&revision=" + template.revision + "&format=" + format : "";
  async function confirmExport(format: ExportFormat) {
    const confirming = exportDialog === "confirm";
    if (confirming) {
      const ok = await action("export");
      if (!ok) { setExportDialog(null); return; }
    }
    downloadFile(exportHref(format));
    setExportDialog(null);
    setNotice(confirming
      ? t("Exported and logged. Your " + (format === "pdf" ? "PDF" : "Word document") + " is downloading.", "Exportée et consignée. Votre " + (format === "pdf" ? "PDF" : "document Word") + " se télécharge.")
      : t("Downloading the exported report.", "Téléchargement du rapport exporté."));
  }
  const funderPicker = <label className="funder-picker">{t("Funder version", "Version du bailleur")}<select value={funder} onChange={e => { setFunder(e.target.value as "fdf" | "quebec"); setError(""); setNotice(""); }}>{(Object.keys(FUNDERS) as (keyof typeof FUNDERS)[]).map(f => <option key={f} value={f}>{t(...FUNDERS[f])}</option>)}</select></label>;
  const fields = (tpl: DemoTemplate, editable: boolean) => <div lang={tpl.language}>{tpl.fields.map(f => <article className={"template-field " + (f.check === "red" ? "has-error" : "")} key={f.key}><div className="field-heading"><label htmlFor={"field-" + f.key}>{f.label}</label><Badge ok={f.check === "green"}>{f.check === "green" ? t("Verified", "Vérifié") : t("Needs attention", "À vérifier")}</Badge></div>{f.kind === "narrative" && editable ? <EditableField key={tpl.funder_id + "-" + tpl.revision + "-" + f.key} id={"field-" + f.key} value={f.value} disabled={!!busy || !allowed("edit")} onSave={value => action("edit", { key: f.key, value })} saveLabel={t("Save & check", "Enregistrer et vérifier")} /> : f.kind === "narrative" ? <p className="field-text">{f.value}</p> : <strong className="numeric-value">{f.value}</strong>}<p className="source-chip">{t("Source", "Source")} · {f.source?.id || f.cites.join(" · ") || t("Qualitative statement", "Énoncé qualitatif")}</p>{f.check_reason && <p className="error-text">{f.check_reason}</p>}</article>)}</div>;
  const versionState = (tpl?: DemoTemplate) => !tpl ? t("Not prepared", "Non préparée") : tpl.approval?.sent_at && tpl.approval.approved_revision === tpl.revision ? t("Exported", "Exportée") : tpl.approval?.approved_revision === tpl.revision ? t("Approved · export pending", "Approuvée · export en attente") : blocks(tpl).length ? t("Blocked by checks", "Bloquée par des contrôles") : frenchPending(tpl) ? t("French review needed", "Révision française requise") : t("Ready for approval", "Prête pour l’approbation");
  return <main id="main" className="page run-page">
    <div className="breadcrumb"><Link href="/">{t("Inbox", "Boîte de réception")}</Link><span>/</span><span>{record.period}</span></div>
    <div className="run-heading"><div><h1>{record.title}</h1><p className="muted">{record.source_location} · {t("Cutoff", "Date limite")} {record.period_end} · {t("Received", "Reçu")} {record.received_date}</p></div><div className="identity-fields"><label>{t("Preparer", "Préparateur")}<Tip text={t("Filled in automatically by whoever runs the first step. It can’t be typed.", "Rempli automatiquement par la personne qui lance la première étape. Non modifiable.")}><input value={record.preparer || t("Set by the first step", "Fixé à la première étape")} disabled readOnly aria-readonly="true" /></Tip></label><PersonSelect label={t("Acting as", "Agir en tant que")} /></div></div>
    <Message error={error || remote.error} />{notice && <p role="status" className="message success">{notice}</p>}
    <nav className="report-tabs" aria-label={t("Report sections", "Sections du rapport")}>{TABS.map(([key, en, fr]) => <Link key={key} href={href(key)} scroll={false} aria-current={tab === key ? "page" : undefined}>{t(en, fr)}</Link>)}</nav>
    <section className="report-panel" aria-labelledby="tab-heading">
      <h2 id="tab-heading" className="sr-only">{t(...(TABS.find(x => x[0] === tab)!.slice(1) as [string, string]))}</h2>
      {tab === "overview" && <div className="overview-grid">
        <div><h3>{t("Progress", "Progression")}</h3><ol className="progress-list">{STEPS.map(([key, en, fr]) => <li key={key} data-done={stepDone(key) || undefined}><span aria-hidden="true">{stepDone(key) ? "✓" : "○"}</span><Link href={href(STEP_TAB[key])}>{t(en, fr)}</Link></li>)}</ol>
          {nextStep ? <p className="next-step">{t("Next", "Suivant")} : <Link href={href(STEP_TAB[nextStep[0]])}><strong>{t(nextStep[1], nextStep[2])}</strong> →</Link></p> : <p className="success-text">✓ {t("This funder version is exported.", "Cette version est exportée.")}</p>}</div>
        <div><h3>{t("Funder versions", "Versions des bailleurs")}</h3>{(Object.keys(FUNDERS) as (keyof typeof FUNDERS)[]).map(f => { const tpl = record.templates[f]; return <div className="version-row" key={f}><strong>{t(...FUNDERS[f])}</strong><span>{tpl ? t("Revision", "Révision") + " " + tpl.revision + " · " : ""}{versionState(tpl)}</span></div>; })}
          <h3>{t("Key numbers", "Chiffres clés")}</h3><div className="count-grid">{[["pct_full", "Fully working", "Entièrement fonctionnels", "full_only"], ["pct_incl_partly", "Including partly working", "Partiellement fonctionnels inclus", "incl_partly"]].map(([key, en, fr, def]) => <Link className="count-card" key={key} href={evidence(def)}><span>{t(en, fr)}</span><strong>{metric(key) !== undefined ? percent(metric(key)!) : "—"}</strong><small>{t("See the points behind this number", "Voir les points correspondant au chiffre")} ↗</small></Link>)}</div>
          <p className="muted">{record.coverage.observed} / {record.coverage.total} {t("registered points have observations.", "points enregistrés ont des observations.")} {record.facts.filter(f => f.check === "green").length} / {record.facts.length} {t("facts checked against source quotes.", "faits vérifiés dans les citations.")}</p></div>
      </div>}
      {tab === "original" && <><p>{t("The report exactly as received. It cannot be edited; extracted facts must point back to these words.", "Le rapport tel qu’il a été reçu. Il ne peut pas être modifié; chaque fait extrait doit renvoyer à ces mots.")}</p><div className="source-note">{record.source_file}<br />{record.source_location}</div><pre className="source-document">{record.original_text}</pre></>}
      {tab === "draft" && <>{funderPicker}<p>{t("Numbers are filled by code from the checked facts and metrics; recorded responses draft the narrative. Editing or regenerating clears any review and approval of this version.", "Le code remplit les chiffres à partir des faits et indicateurs vérifiés; les réponses enregistrées rédigent le texte. Modifier ou régénérer annule la révision et l’approbation de cette version.")}</p>{button("template", template ? "Regenerate draft" : "Build funder draft", template ? "Régénérer l’ébauche" : "Créer l’ébauche")}{notNamed}
        {template ? <><div className="template-meta"><span>{t("Revision", "Révision")} {template.revision}</span><span>{t("Prepared by", "Préparé par")} {template.preparer}</span><span>{versionState(template)}</span></div>{fields(template, true)}</> : <p className="empty-note">{t("Build this funder version first. Facts, cleaning and validation must be done.", "Créez d’abord cette version. Faits, nettoyage et validation doivent être faits.")}</p>}</>}
      {tab === "issues" && <>
        <div className="issue-section"><h3>{t("1 · Facts from the report", "1 · Faits du rapport")}</h3><p>{t("Replay a recorded extraction, then check each value against a verbatim source quote.", "Rejouez une extraction enregistrée, puis vérifiez chaque valeur dans une citation exacte.")}</p>{button("extract", "Extract and verify facts", "Extraire et vérifier les faits")}{notNamed}<div className="facts-list">{record.facts.map(f => <article key={f.fact_id} className="fact"><div><code>{f.fact_id}</code><Badge ok={f.check === "green"}>{t("Source check", "Contrôle de source")}</Badge></div><h3>{f.label.replaceAll("_", " ")} <strong>{f.value}{f.unit === "%" ? "%" : ""}</strong></h3><blockquote>{f.quote}</blockquote>{f.check_reason && <p className="error-text">{f.check_reason}</p>}</article>)}</div></div>
        <div className="issue-section"><h3>{t("2 · Data cleaning", "2 · Nettoyage des données")}</h3><p>{t("Status labels and dates are normalised by code. Ambiguous dates stay visible for review.", "Le code normalise les statuts et les dates. Les dates ambiguës restent visibles pour révision.")}</p>{button("clean", "Review cleaning changes", "Examiner le nettoyage")}<div className="changes-list">{record.changes.length ? <><p className="muted">{record.changes.length} {t("recorded changes; first 30 shown", "changements enregistrés; 30 premiers affichés")}</p>{record.changes.slice(0, 30).map((c, i) => <div className="change-row" key={i}><code>{c.field}</code><span><del>{c.before}</del> → <strong>{c.after}</strong></span></div>)}</> : <p className="empty-note">{record.completed.includes("clean") ? t("Cleaning ran: no status or date needed a change.", "Nettoyage effectué : aucun statut ni date à corriger.") : t("Changes appear after the cleaning step.", "Les changements apparaissent après le nettoyage.")}</p>}</div></div>
        <div className="issue-section"><h3>{t("3 · Numbers and definitions", "3 · Chiffres et définitions")}</h3><div className="message warning"><strong>{t("A definition to agree", "Une définition à convenir")}</strong><p>{t("The reported figure may include partly working points. The historical baseline does not specify its definition; do not infer a directly comparable improvement.", "Le chiffre déclaré peut inclure les points partiellement fonctionnels. La définition historique n’est pas précisée; évitez d’en déduire une amélioration directement comparable.")}</p></div><p>{record.coverage.observed} / {record.coverage.total} {t("registered points have observations.", "points enregistrés ont des observations.")}</p>{button("validate", "Validate this evidence", "Valider ces données")}</div>
        <div className="issue-section"><h3>{t("Checks on the selected funder version", "Contrôles de la version choisie")}</h3>{funderPicker}{template ? template.checks.map(c => <div className={"check-item " + (!c.passed ? (c.severity === "warn" ? "warning-text" : "error-text") : "")} key={c.rule_id}><span>{c.severity === "warn" ? "!" : c.passed ? "✓" : "✕"}</span><div><strong>{t(c.label, CHECK_FR[c.rule_id] || c.label)}</strong>{!c.passed || c.severity === "warn" ? <p>{t(c.message, c.severity === "warn" ? "Comparez les deux définitions du taux déclaré." : "Ce contrôle doit réussir avant l’approbation.")}</p> : null}</div></div>) : <p className="empty-note">{t("Checks run once this funder version is built.", "Les contrôles s’exécutent une fois la version créée.")}</p>}
          <div className="snapshot-note"><span>{t("SAVED SNAPSHOT", "INSTANTANÉ CONSERVÉ")}</span><code>{record.snapshot_id}</code><Link href={evidence("incl_partly")}>{t("Inspect evidence", "Examiner les données")} ↗</Link></div>
          <button className="secondary" aria-expanded={assistant.open} aria-controls="synapse-assistant" onClick={() => assistant.setOpen(true)}>{t("Ask the evidence assistant", "Demander à l’assistant de données")} →</button></div>
      </>}
      {tab === "french" && <>
        <div className="issue-section"><h3>{t("Programme report in French", "Rapport de programme en français")}</h3><p>{t("Replay a French draft and check that every number is preserved. Number checks do not establish translation quality.", "Rejouez une traduction française et vérifiez la conservation de chaque chiffre. Les contrôles numériques ne garantissent pas la qualité de la traduction.")}</p>{button("french", record.french ? "Recreate checked French draft" : "Create checked French draft", record.french ? "Recréer le brouillon français vérifié" : "Créer le brouillon français vérifié")}{notNamed}
          {record.french && <FrenchDocuments record={record} />}</div>
        <div className="issue-section"><h3>{t("Final French funder report", "Rapport final en français")}</h3>{record.templates.quebec ? <><p>{t("A bilingual person reads the final French version for meaning before anyone approves it.", "Une personne bilingue lit la version française finale avant toute approbation.")}</p><div className="template-meta"><span>{t("Revision", "Révision")} {record.templates.quebec.revision}</span>{record.templates.quebec.review?.revision === record.templates.quebec.revision ? <span className="success-text">✓ {record.templates.quebec.review.actor} · {t("reviewed this revision", "a révisé cette version")}</span> : <span className="warning-text">{t("Bilingual review pending", "Révision bilingue en attente")}</span>}</div>{fields(record.templates.quebec, false)}{frenchPending(record.templates.quebec) && (openFrench > 0 ? <p className="warning-text">{openFrench} {t("flagged French items still need a decision in the review panel.", "éléments français signalés attendent encore une décision dans le panneau de révision.")} <button type="button" className="link-button" onClick={() => assistant.setOpen(true)}>{t("Open review", "Ouvrir la révision")} →</button></p> : record.french?.check === "red" ? <p className="error-text">{t("A fix changed a number. Recreate the French draft before the review.", "Une correction a changé un chiffre. Recréez le brouillon français avant la révision.")}</p> : button("review", "Confirm bilingual review", "Confirmer la révision bilingue", { funder_id: "quebec", expected_revision: record.templates.quebec.revision }))}</> : <p className="empty-note">{t("Build the Fondation du Québec version under Standardized draft first.", "Créez d’abord la version Fondation du Québec dans Ébauche normalisée.")}</p>}</div>
      </>}
      {tab === "approvals" && <>{funderPicker}
        <div className="approval-box"><h3>{t("Two separate steps, two named people", "Deux étapes distinctes, deux personnes nommées")}</h3><p>{t("The approver is a different person from the preparer. They approve this exact revision, then confirm a local export. No email is sent; any later edit clears the approval.", "L’approbateur est une autre personne que le préparateur. Il approuve cette révision exacte, puis confirme un export local. Aucun courriel n’est envoyé; toute modification annule l’approbation.")}</p>
          {template ? <><div className="template-meta"><span>{t("Revision", "Révision")} {template.revision}</span><span>{t("Prepared by", "Préparé par")} {template.preparer}</span><span>{versionState(template)}</span></div>
            {blocks(template).length > 0 && <p className="warning-text">{t("Blocking checks", "Contrôles bloquants")} : {blocks(template).map(c => t(c.label, CHECK_FR[c.rule_id] || c.label)).join(", ")}</p>}
            {frenchPending(template) && <p className="warning-text">{t("Complete the bilingual review under French version before approving.", "Terminez la révision bilingue dans Version française avant d’approuver.")}</p>}
            {template.approval && <p className="success-text">✓ {template.approval.approver} · {t("approved revision", "a approuvé la révision")} {template.approval.approved_revision} · {template.approval.content_approved_at}{template.approval.sent_at ? " · " + t("exported", "exportée") + " " + template.approval.sent_at : ""}</p>}
            <p className="muted small">{t("Use the action bar below to approve or export.", "Utilisez la barre d’actions ci-dessous pour approuver ou exporter.")}</p></> : <p className="empty-note">{t("Build this funder version first.", "Créez d’abord cette version.")}</p>}</div>
        <div className="approval-box"><h3>{t("Access", "Accès")}</h3><p>{t("Pick who you are acting as in the sidebar. Each step names the role that can act and offers a switch. This is demo-level gating, not sign-in: the server enforces that the approver is not the stored preparer and that final French is reviewed.", "Choisissez la personne dans le menu. Chaque étape nomme le rôle qui peut agir et propose de changer. C’est un contrôle de démonstration, pas une connexion : le serveur exige que l’approbateur ne soit pas le préparateur et que le français final soit révisé.")}</p></div>
      </>}
      {tab === "activity" && <Activity id={record.record_id} />}
    </section>
    <div className="report-actionbar" role="region" aria-label={t("Approval and export", "Approbation et export")}>
      <div className="actionbar-inner">{funderPicker}{!actor.trim() && <span className="actionbar-hint">{t("Pick a person in the sidebar to approve or export.", "Choisissez une personne dans le menu pour approuver ou exporter.")}</span>}{actor.trim() && barAction && !allowed(barAction) && <div className="actionbar-hint"><SwitchNotice action={barAction} /></div>}{selfApproval && barAction === "approve" && <span className="actionbar-hint">{t("You prepared this version. A different person must approve it.", "Vous avez préparé cette version. Une autre personne doit l’approuver.")}</span>}<span className="actionbar-state"><strong>{template ? t("Revision", "Révision") + " " + template.revision : "—"}</strong> · {versionState(template)}</span>
        <div className="actionbar-buttons"><GuardedButton className="secondary" busy={busy === "approve"} reason={approveReason} onClick={() => void action("approve")}>{busy === "approve" ? t("Checking…", "Vérification…") : t("Approve content", "Approuver le contenu")}</GuardedButton>{template?.approval?.sent_at
          ? <button type="button" className="primary" aria-haspopup="dialog" onClick={() => setExportDialog("download")}>{t("Download…", "Télécharger…")}</button>
          : <GuardedButton className="primary" busy={busy === "export"} reason={exportReason} aria-haspopup="dialog" onClick={() => setExportDialog("confirm")}>{busy === "export" ? t("Exporting…", "Export…") : t("Confirm export…", "Confirmer l’export…")}</GuardedButton>}</div></div>
    </div>
    <ExportDialog open={!!exportDialog} mode={exportDialog ?? "confirm"} busy={busy === "export"} onClose={() => setExportDialog(null)} onConfirm={f => void confirmExport(f)}
      summary={template ? [
        { label: t("Report", "Rapport"), value: record.title },
        { label: t("Funder version", "Version du bailleur"), value: t(...FUNDERS[funder]) },
        { label: t("Revision", "Révision"), value: String(template.revision) },
        { label: t("Approved by", "Approuvée par"), value: template.approval ? template.approval.approver + " · " + when(template.approval.content_approved_at) : "—" },
        { label: template.approval?.sent_at ? t("Exported", "Exportée") : t("Will be logged as", "Sera inscrite au nom de"), value: template.approval?.sent_at ? when(template.approval.sent_at) : actor || "—" },
      ] : []} />
  </main>;
}
function Activity({ id }: { id: string }) {
  const { t, language } = useLanguage();
  const { data, error, loading } = useRemote<{ entries: AuditEvent[]; valid: boolean }>("/api/log");
  if (loading) return <Loading />;
  const entries = (data?.entries ?? []).filter(e => e.record_id === id).reverse();
  const when = (at: string) => new Date(at).toLocaleString(language === "fr" ? "fr-CA" : "en-CA", { dateStyle: "medium", timeStyle: "short" });
  return <><Message error={error} />{data && <p>{data.valid ? <Badge ok>{t("Audit chain intact", "Chaîne d’audit intacte")}</Badge> : <Badge ok={false}>{t("Audit chain broken", "Chaîne d’audit rompue")}</Badge>} <Link href="/log">{t("Full activity log", "Journal complet")} ↗</Link></p>}
    {entries.length === 0 ? <p className="empty-note">{t("No recorded activity for this report yet.", "Aucune activité enregistrée pour ce rapport.")}</p> : <ol className="activity-list">{entries.map(e => <li key={e.id}><time dateTime={e.at}>{when(e.at)}</time><strong>{e.actor}</strong><span className="activity-action">{e.action}</span><code>{Object.entries(e.detail).filter(([, v]) => typeof v !== "object").slice(0, 4).map(([k, v]) => k + ": " + String(v)).join(" · ")}</code></li>)}</ol>}</>;
}
function EditableField({ id, value, disabled, onSave, saveLabel }: { id: string; value: string; disabled: boolean; onSave: (s: string) => void; saveLabel: string }) { const { t } = useLanguage(); const [draft, setDraft] = useState(value); return <>{disabled ? <Tip block text={t("Only the preparer can edit the narrative. Switch person under “Acting as”, or wait for the current step to finish.", "Seul le préparateur peut modifier le texte. Changez de personne sous « Agir en tant que », ou attendez la fin de l’étape.")}><textarea id={id} rows={4} value={draft} readOnly aria-readonly="true" /></Tip> : <textarea id={id} rows={4} value={draft} onChange={e => setDraft(e.target.value)} />}{draft !== value && <GuardedButton className="secondary" reason={disabled ? t("You can’t save right now.", "Impossible d’enregistrer pour l’instant.") : null} onClick={() => onSave(draft)}>{saveLabel}</GuardedButton>}</>; }
