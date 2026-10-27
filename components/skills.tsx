"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { useLanguage, useRemote, Message, Loading } from "@/components/shell";
import { GuardedButton, downloadFile } from "@/components/ui";
import { DATA_CLASS_SUGGESTIONS, OUTPUT_SCHEMAS, SCAFFOLD, blankDraft, checkSkill, draftFrom, registerMarkdown, slug, summary, toSkillMarkdown, type SkillDraft, type SkillKind, type WizardStep } from "@/lib/demo/skill-kit";
import type { loadStandard } from "@/lib/demo/standard";

type Standard = ReturnType<typeof loadStandard>;
type Step = Standard["workflow"]["steps"][number];

// Drafts live in this browser until a reviewer adds the file to standard/skills (as template drafts do).
const KEY = "synapse.skillDrafts";
let cache: SkillDraft[] | null = null;
const listeners = new Set<() => void>();
const EMPTY: SkillDraft[] = [];
function readDrafts(): SkillDraft[] { if (cache) return cache; try { cache = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { cache = []; } return cache!; }
function writeDrafts(next: SkillDraft[]) { cache = next; try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private window */ } listeners.forEach(l => l()); }
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
function useDrafts() { return useSyncExternalStore(subscribe, readDrafts, () => EMPTY); }

function saveFile(name: string, text: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
const knownFrom = (data: Standard | null) => ({ names: data?.skills.map(s => s.name) ?? [], rules: data?.rules.map(r => r.id) ?? [] });
const usedBy = (steps: Step[], name: string) => steps.filter(s => s.skill === name);

function TierMeter({ tier }: { tier: number | null }) {
  const { t } = useLanguage();
  const label = tier ? t(`Risk tier ${tier} of 3`, `Niveau de risque ${tier} sur 3`) : t("No risk tier set", "Aucun niveau de risque");
  return <span className="tier-meter" role="img" aria-label={label} title={label}>{[1, 2, 3].map(n => <span key={n} data-on={tier !== null && n <= tier || undefined} />)}<small>{tier ?? "—"}</small></span>;
}

function KindChip({ kind }: { kind: SkillKind }) {
  const { t } = useLanguage();
  return <span className="template-lang">{kind === "ai" ? t("AI", "IA") : t("Code", "Code")}</span>;
}

function UsedIn({ steps }: { steps: Step[] }) {
  const { t } = useLanguage();
  return steps.length
    ? <p className="skill-used small">{t("Used in", "Utilisée à")} {steps.map(s => <Link key={s.id} className="skill-step-chip" href="/standard#workflow">{s.n}. {t(s.label_en, s.label_fr)}</Link>)}</p>
    : <p className="skill-used small muted">{t("No workflow step uses it yet, so it never runs.", "Aucune étape ne l’utilise encore : elle ne s’exécute jamais.")}</p>;
}

export function SkillsRegister() {
  const { t } = useLanguage();
  const drafts = useDrafts();
  const { data, error, loading } = useRemote<Standard>("/api/standard");
  const known = knownFrom(data);
  const steps = data?.workflow.steps ?? [];
  return <main id="main" className="page skills-page">
    <div className="page-heading templates-heading"><div><h1>{t("Skills", "Compétences")}</h1><p className="muted">{t("Every job the AI or the code does for a report, with who owns it, the data it may see, its risk tier and who approves its output. A skill only runs when a workflow step uses it.", "Chaque tâche confiée à l’IA ou au code, avec son responsable, les données permises, son niveau de risque et la personne qui approuve le résultat. Une compétence ne s’exécute que si une étape du parcours l’utilise.")}</p></div>
      <div className="template-actions">
        <GuardedButton className="secondary" reason={data ? null : t("Wait for the register to load.", "Attendez le chargement du registre.")} onClick={() => data && saveFile("synapse-skills-register.md", registerMarkdown(data.skills, data.workflow.steps, new Date().toISOString().slice(0, 10)))}>{t("Download register (.md)", "Télécharger le registre (.md)")}</GuardedButton>
        <Link className="primary" href="/skills/new">+ {t("New skill", "Nouvelle compétence")}</Link>
      </div>
    </div>
    <Message error={error} />
    {loading ? <Loading /> : data && <>
      <div className="count-grid skills-counts">
        <a className="count-card" href="#registered"><span>{t("Registered skills", "Compétences enregistrées")}</span><strong>{data.skills.filter(s => s.registered).length}</strong><small>{t("Owner, data, tier and approver set", "Responsable, données, niveau et approbateur")}</small></a>
        <a className="count-card" href="#registered"><span>{t("Used in the workflow", "Utilisées dans le parcours")}</span><strong>{data.skills.filter(s => usedBy(steps, s.name).length).length}</strong><small>{t("Run at a report step", "Exécutées à une étape")}</small></a>
        <a className="count-card" href="#drafts"><span>{t("Your drafts", "Vos ébauches")}</span><strong>{drafts.length}</strong><small>{t("Saved in this browser", "Enregistrées dans ce navigateur")}</small></a>
      </div>
      <h2 className="templates-section" id="registered">{t("Registered · in the standard", "Enregistrées · dans le référentiel")}</h2>
      <div className="template-grid">{data.skills.map(s => <article className="template-card is-standard skill-card" key={s.name}>
        <div className="template-card-top"><KindChip kind={s.kind} />{s.registered ? <span className="status-pill" data-status="completed">✓ {t("Registered", "Enregistrée")}</span> : <span className="status-pill" data-status="needs_review">{t("Incomplete", "Incomplète")}</span>}</div>
        <h3><Link href={"/skills/" + s.name}>{s.name}</Link></h3>
        <p className="small">{summary(s.instruction)}</p>
        <dl className="skill-meta"><div><dt>{t("Owner", "Responsable")}</dt><dd>{s.owner || "—"}</dd></div><div><dt>{t("Approver", "Approbateur")}</dt><dd>{s.approver || "—"}</dd></div><div><dt>{t("Risk", "Risque")}</dt><dd><TierMeter tier={s.tier} /></dd></div><div><dt>{t("Data", "Données")}</dt><dd>{s.data_classes.join(", ") || "—"}</dd></div></dl>
        <UsedIn steps={usedBy(steps, s.name)} />
        <div className="template-actions"><Link className="secondary" href={"/skills/" + s.name}>{t("View", "Voir")}</Link><button type="button" className="secondary" onClick={() => downloadFile("/api/skills/" + encodeURIComponent(s.name))}>{t("Download SKILL.md", "Télécharger SKILL.md")}</button></div>
      </article>)}</div>
      <h2 className="templates-section" id="drafts">{t("Your drafts", "Vos ébauches")}</h2>
      {drafts.length === 0 ? <p className="empty-note">{t("No drafts yet. Start a new skill, or duplicate a registered one.", "Aucune ébauche. Créez une compétence ou dupliquez-en une.")}</p> :
        <div className="template-grid">{drafts.map(d => { const problems = checkSkill(d, known); return <article className="template-card skill-card" key={d.name}>
          <div className="template-card-top"><KindChip kind={d.kind} />{problems.length ? <span className="status-pill" data-status="needs_review">{problems.length} {t("to fix", "à corriger")}</span> : <span className="status-pill" data-status="approved">{t("Ready for review", "Prêt pour révision")}</span>}</div>
          <h3>{d.name || t("Untitled skill", "Compétence sans nom")}</h3>
          <p className="small">{summary(d.instruction)}</p>
          {d.from && <p className="muted small">{t("Copied from", "Copiée de")} <code>{d.from}</code></p>}
          <div className="template-actions"><Link className="secondary" href={"/skills/new?draft=" + encodeURIComponent(d.name)}>{t("Edit", "Modifier")}</Link><button type="button" className="secondary" onClick={() => saveFile(d.name + ".SKILL.md", toSkillMarkdown(d))}>{t("Download SKILL.md", "Télécharger SKILL.md")}</button><button type="button" className="link-button" onClick={() => { if (confirm(t("Delete this draft?", "Supprimer cette ébauche ?"))) writeDrafts(drafts.filter(x => x.name !== d.name)); }}>{t("Delete", "Supprimer")}</button></div>
        </article>; })}</div>}
      <section className="panel template-howto"><h2>{t("From draft to running skill", "De l’ébauche à la compétence active")}</h2><ol>
        <li>{t("Create or adjust a skill with the wizard, then download its SKILL.md.", "Créez ou ajustez une compétence avec l’assistant, puis téléchargez son SKILL.md.")}</li>
        <li>{t("A reviewer places it at", "Une personne le place dans")} <code>standard/skills/&lt;name&gt;/SKILL.md</code>. {t("It shows here as registered, and its version hash changes with every edit.", "Elle apparaît ici comme enregistrée, et son empreinte change à chaque modification.")}</li>
        <li>{t("A developer connects it: a workflow step must name it, and an AI skill needs its output schema in", "Un développeur la connecte : une étape du parcours doit la nommer, et une compétence IA a besoin de son schéma dans")} <code>lib/harness/jobs.ts</code>. {t("Listed checks document intent; the step’s rules enforce them.", "Les contrôles listés documentent l’intention; les règles de l’étape les appliquent.")}</li>
      </ol></section>
    </>}
  </main>;
}

export function SkillDetail({ name }: { name: string }) {
  const { t } = useLanguage();
  const { data, error, loading } = useRemote<Standard>("/api/standard");
  const s = data?.skills.find(x => x.name === name);
  if (loading || error || !data) return <main id="main" className="page"><Message error={error} />{loading && <Loading />}</main>;
  if (!s) return <main id="main" className="page"><div className="page-heading"><h1>{t("Skill not found", "Compétence introuvable")}</h1><p className="muted">{t("No registered skill has this name. It may still be a draft in your browser.", "Aucune compétence enregistrée ne porte ce nom. C’est peut-être une ébauche dans votre navigateur.")}</p></div><Link className="secondary" href="/skills">{t("Open the skills register", "Ouvrir le registre")}</Link></main>;
  const steps = data.workflow.steps;
  const used = usedBy(steps, s.name);
  const rule = (id: string) => data.rules.find(r => r.id === id);
  const enforced = [...new Set(used.flatMap(st => st.rules))];
  return <main id="main" className="page skill-detail">
    <div className="page-heading"><p className="eyebrow">{s.kind === "ai" ? t("AI SKILL", "COMPÉTENCE IA") : t("CODE SKILL · NO MODEL CALL", "COMPÉTENCE CODE · SANS MODÈLE")}</p><h1>{s.name}</h1><p className="muted">{summary(s.instruction)}</p>
      <p className="skill-badges">{s.registered ? <span className="status-pill" data-status="completed">✓ {t("Registered", "Enregistrée")}</span> : <span className="status-pill" data-status="needs_review">{t("Incomplete: it cannot run", "Incomplète : elle ne peut pas s’exécuter")}</span>}<span className="muted small">{t("Version", "Version")} <code>{s.version}</code></span></p></div>
    <div className="template-actions skill-actions"><button type="button" className="primary" onClick={() => downloadFile("/api/skills/" + encodeURIComponent(s.name))}>{t("Download SKILL.md", "Télécharger SKILL.md")}</button><Link className="secondary" href={"/skills/new?from=" + encodeURIComponent(s.name)}>{t("Duplicate as draft", "Dupliquer en ébauche")}</Link></div>
    <div className="detail-grid">
      <section className="panel"><h2>{t("Who is responsible", "Qui est responsable")}</h2>
        <dl className="export-summary"><div><dt>{t("Owner", "Responsable")}</dt><dd>{s.owner || "—"}</dd></div><div><dt>{t("Approves its output", "Approuve le résultat")}</dt><dd>{s.approver || "—"}</dd></div><div><dt>{t("Risk tier", "Niveau de risque")}</dt><dd><TierMeter tier={s.tier} /></dd></div><div><dt>{t("Data it may see", "Données permises")}</dt><dd>{s.data_classes.map(c => <span className="skill-tag" key={c}>{c}</span>)}</dd></div><div><dt>{t("Workload ids", "Charges de travail")}</dt><dd>{s.workflow.map(w => <code key={w} className="skill-tag">{w}</code>)}</dd></div>{s.output && <div><dt>{t("Output shape", "Forme du résultat")}</dt><dd><code>{s.output}</code></dd></div>}</dl>
      </section>
      <section className="panel"><h2>{t("Where it runs", "Où elle s’exécute")}</h2>
        <p className="muted small">{used.length ? t("Highlighted steps hand their work to this skill. Every report runs these steps in order.", "Les étapes en surbrillance confient leur travail à cette compétence. Chaque rapport suit ces étapes dans l’ordre.") : t("No workflow step uses this skill yet, so it never runs. A developer connects it in standard/workflows/funder-report.json.", "Aucune étape ne l’utilise encore : elle ne s’exécute jamais. Un développeur la connecte dans standard/workflows/funder-report.json.")}</p>
        <ol className="goal-steps skill-flow">{steps.map(st => <li key={st.id} data-state={st.skill === s.name ? "next" : "open"}><Link href="/standard#workflow"><span className="goal-dot" aria-hidden="true">{st.n}</span><span>{t(st.label_en, st.label_fr)}</span>{st.skill === s.name && <em>{t("This skill", "Cette compétence")}</em>}</Link></li>)}</ol>
      </section>
      <section className="panel"><h2>{t("Checks", "Contrôles")}</h2>
        {s.checks.length === 0 && enforced.length === 0 ? <p className="muted small">{t("No checks listed.", "Aucun contrôle listé.")}</p> : <ul className="skill-checks">
          {[...new Set([...enforced, ...s.checks])].map(id => { const r = rule(id); return <li key={id}><span className="skill-check-head"><code>{id}</code>{enforced.includes(id) ? <span className="status-pill" data-status="completed">{t("Enforced at its step", "Appliqué à l’étape")}</span> : <span className="status-pill">{t("Listed by the skill", "Listé par la compétence")}</span>}{r?.severity === "block" && <span className="muted small">{t("Blocks approval", "Bloque l’approbation")}</span>}</span>{r && <span className="small">{t(r.message_en, r.message_fr)}</span>}</li>; })}
        </ul>}
      </section>
      <section className="panel skill-instruction"><h2>{s.kind === "ai" ? t("Instruction sent to the model", "Consigne envoyée au modèle") : t("Rule the code applies", "Règle appliquée par le code")}</h2><pre>{s.instruction}</pre></section>
    </div>
  </main>;
}

const STEPS: [WizardStep | "review", string, string][] = [
  ["basics", "Basics", "Informations"],
  ["governance", "Ownership and risk", "Responsabilité et risque"],
  ["runs", "Where it runs", "Où elle s’exécute"],
  ["instruction", "Instruction", "Consigne"],
  ["review", "Review and download", "Vérifier et télécharger"],
];

export function SkillWizard() {
  const { t } = useLanguage();
  const params = useSearchParams();
  const router = useRouter();
  const drafts = useDrafts();
  const { data, error, loading } = useRemote<Standard>("/api/standard");
  const editing = params.get("draft");
  const from = params.get("from");
  const [edited, setEdited] = useState<SkillDraft | null>(null);
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState("");
  const [workload, setWorkload] = useState("");
  const source = from ? data?.skills.find(s => s.name === from) : undefined;
  const initial = editing ? readDrafts().find(d => d.name === editing) ?? blankDraft() : from ? (source ? draftFrom(source) : null) : blankDraft();
  const draft = edited ?? initial;
  if (!draft || (from && loading)) return <main id="main" className="page"><Message error={error} /><Loading /></main>;
  const known = knownFrom(data);
  const problems = checkSkill(draft, known);
  const problemsAt = (id: string) => problems.filter(p => p.step === id);
  const update = (change: Partial<SkillDraft>) => { setEdited({ ...draft, ...change }); setSaved(""); };
  const setKind = (kind: SkillKind) => update({ kind, instruction: draft.instruction === SCAFFOLD[draft.kind] ? SCAFFOLD[kind] : draft.instruction, output: kind === "code" ? "" : draft.output });
  const toggle = (list: string[], value: string) => list.includes(value) ? list.filter(x => x !== value) : [...list, value];
  const addWorkload = () => { const ids = workload.split(/[,\s]+/).map(x => x.trim().toUpperCase()).filter(Boolean); if (ids.length) update({ workflow: [...new Set([...draft.workflow, ...ids])] }); setWorkload(""); };
  const save = () => { writeDrafts([...drafts.filter(d => d.name !== editing && d.name !== draft.name), { ...draft, updated_at: new Date().toISOString() }]); setSaved(t("Draft saved in this browser.", "Ébauche enregistrée dans ce navigateur.")); if (editing !== draft.name) router.replace("/skills/new?draft=" + encodeURIComponent(draft.name), { scroll: false }); };
  const nameReason = /^[a-z][a-z0-9_]{1,39}$/.test(draft.name) ? null : t("Give the skill a name first, under Basics.", "Donnez d’abord un nom, dans Informations.");
  const owners = [...new Set(data?.skills.map(s => s.owner).filter(Boolean))];
  const approvers = [...new Set(data?.skills.map(s => s.approver).filter(Boolean))];
  const classes = [...new Set([...DATA_CLASS_SUGGESTIONS, ...(data?.skills.flatMap(s => s.data_classes) ?? []), ...draft.data_classes])];
  const current = STEPS[step][0];
  // Each step starts at the top with its heading focused, so keyboard and screen-reader users land on it.
  const goTo = (i: number) => { setStep(i); requestAnimationFrame(() => { document.getElementById("wizard-step-title")?.focus({ preventScroll: true }); document.querySelector(".wizard-steps")?.scrollIntoView({ block: "start" }); }); };
  return <main id="main" className="page skill-wizard">
    <div className="page-heading"><p className="eyebrow">{editing ? t("EDIT DRAFT", "MODIFIER L’ÉBAUCHE") : t("NEW SKILL", "NOUVELLE COMPÉTENCE")}</p><h1>{draft.name || t("New skill", "Nouvelle compétence")}</h1><p className="muted">{t("Five short steps. Nothing is installed: you save a draft and download a SKILL.md for a reviewer.", "Cinq étapes courtes. Rien n’est installé : vous enregistrez une ébauche et téléchargez un SKILL.md pour révision.")}</p></div>
    <Message error={error} />
    <ol className="wizard-steps">{STEPS.map(([id, en, fr], i) => { const open = id === "review" ? problems.length : problemsAt(id).length; return <li key={id} data-state={i === step ? "current" : open ? "todo" : "ok"}>
      <button type="button" aria-current={i === step ? "step" : undefined} onClick={() => goTo(i)}><span className="goal-dot" aria-hidden="true">{i !== step && !open ? "✓" : i + 1}</span><span>{t(en, fr)}</span>{i !== step && open > 0 && <small>{open} {t("to fix", "à corriger")}</small>}</button>
    </li>; })}</ol>
    <div className="builder-grid">
      <div className="builder-form">
        <section className="panel builder-section wizard-panel" aria-labelledby="wizard-step-title"><h2 id="wizard-step-title" tabIndex={-1}>{step + 1}. {t(STEPS[step][1], STEPS[step][2])}</h2>
          {current === "basics" && <>
            {!editing && <div className="preset-picker"><span className="muted small">{t("Start from:", "Partir de :")}</span>
              <button type="button" className={"assistant-chip" + (!draft.from && draft.kind === "ai" ? " is-active" : "")} onClick={() => { setEdited(blankDraft("ai")); setSaved(""); }}>{t("Blank AI skill", "Compétence IA vierge")}</button>
              <button type="button" className={"assistant-chip" + (!draft.from && draft.kind === "code" ? " is-active" : "")} onClick={() => { setEdited(blankDraft("code")); setSaved(""); }}>{t("Blank code skill", "Compétence code vierge")}</button>
              {data?.skills.map(s => <button key={s.name} type="button" className={"assistant-chip" + (draft.from === s.name ? " is-active" : "")} onClick={() => { setEdited(draftFrom(s)); setSaved(""); }}>{t("Copy", "Copier")} {s.name}</button>)}
            </div>}
            <div className="settings-form">
              <label className="span-2">{t("Name", "Nom")}<input value={draft.name} onChange={e => update({ name: slug(e.target.value) })} disabled={!!editing} placeholder="summarise_visits" aria-describedby="name-hint" /><small id="name-hint" className="muted">{t("Lowercase with _, like summarise_visits. It becomes the folder standard/skills/<name>/.", "Minuscules avec _, comme summarise_visits. C’est le dossier standard/skills/<nom>/.")}</small></label>
            </div>
            <fieldset className="format-options wizard-options"><legend>{t("What does the work?", "Qui fait le travail ?")}</legend>
              {([["ai", "AI", "IA", "The approved model drafts; checks and a named person review the result.", "Le modèle approuvé rédige; des contrôles et une personne vérifient le résultat."], ["code", "Code", "Code", "Plain code, no model call. Registered so staff find every job in one list.", "Du code, sans modèle. Enregistrée pour que tout figure dans une seule liste."]] as const).map(([value, en, fr, hEn, hFr]) => <label key={value} className="format-option" data-checked={draft.kind === value || undefined}>
                <input type="radio" name="skill-kind" value={value} checked={draft.kind === value} onChange={() => setKind(value)} /><span className="format-icon" aria-hidden="true">{value === "ai" ? "AI" : "{ }"}</span><span><strong>{t(en, fr)}</strong><small>{t(hEn, hFr)}</small></span>
              </label>)}
            </fieldset>
          </>}
          {current === "governance" && <>
            <div className="settings-form">
              <label>{t("Owner (team)", "Responsable (équipe)")}<input list="skill-owners" value={draft.owner} onChange={e => update({ owner: e.target.value })} placeholder={t("e.g. Grants & Compliance", "p. ex. Subventions et conformité")} /></label>
              <label>{t("Approves its output (role)", "Approuve le résultat (rôle)")}<input list="skill-approvers" value={draft.approver} onChange={e => update({ approver: e.target.value })} placeholder={t("e.g. Grants & Compliance Officer", "p. ex. Agent·e de conformité")} /></label>
              <datalist id="skill-owners">{owners.map(o => <option key={o} value={o} />)}</datalist><datalist id="skill-approvers">{approvers.map(o => <option key={o} value={o} />)}</datalist>
            </div>
            <fieldset className="wizard-checks"><legend>{t("Data it may see", "Données permises")}</legend>
              {classes.map(c => <label key={c} className="settings-check"><input type="checkbox" checked={draft.data_classes.includes(c)} onChange={() => update({ data_classes: toggle(draft.data_classes, c) })} />{c}</label>)}
              <p className="muted small">{t("Personal data never reaches a model: the guard blocks email addresses, phone numbers and supporter IDs first.", "Les données personnelles n’atteignent jamais le modèle : le filtre bloque d’abord courriels, téléphones et numéros de donateurs.")}</p>
            </fieldset>
            <fieldset className="format-options wizard-options tier-options"><legend>{t("Risk tier (from the AI risk score)", "Niveau de risque (selon l’évaluation des risques IA)")}</legend>
              {([[1, "Low", "Faible", "Internal use, little room for harm.", "Usage interne, peu de risque."], [2, "Medium", "Moyen", "Drafts that a named person checks before use.", "Brouillons vérifiés par une personne avant usage."], [3, "High", "Élevé", "Could reach funders or affect people; needs the most review.", "Peut atteindre les bailleurs ou toucher des personnes; exige le plus de révision."]] as const).map(([n, en, fr, hEn, hFr]) => <label key={n} className="format-option" data-checked={draft.tier === n || undefined}>
                <input type="radio" name="skill-tier" value={n} checked={draft.tier === n} onChange={() => update({ tier: n })} /><span className="format-icon" aria-hidden="true">{n}</span><span><strong>{t(en, fr)}</strong><small>{t(hEn, hFr)}</small></span>
              </label>)}
            </fieldset>
          </>}
          {current === "runs" && <>
            <div className="settings-form"><label className="span-2">{t("Workload ids", "Charges de travail")}<span className="wizard-inline"><input value={workload} onChange={e => setWorkload(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addWorkload(); } }} placeholder="I2, C4" /><button type="button" className="secondary" onClick={addWorkload}>{t("Add", "Ajouter")}</button></span><small className="muted">{t("Codes from the workload inventory (1.2), such as I2 for donor reporting.", "Codes de l’inventaire des charges (1.2), comme I2 pour les rapports aux bailleurs.")}</small></label></div>
            {draft.workflow.length > 0 && <p className="wizard-tags">{draft.workflow.map(w => <span className="skill-tag" key={w}><code>{w}</code><button type="button" className="link-button" aria-label={t("Remove " + w, "Retirer " + w)} onClick={() => update({ workflow: draft.workflow.filter(x => x !== w) })}>✕</button></span>)}</p>}
            {draft.kind === "ai" && <fieldset className="wizard-checks"><legend>{t("Output shape the answer must match", "Forme attendue de la réponse")}</legend>
              {OUTPUT_SCHEMAS.map(o => <label key={o.id} className="settings-check"><input type="radio" name="skill-output" checked={draft.output === o.id} onChange={() => update({ output: o.id })} /><span><code>{o.id}</code> · {t(o.en, o.fr)}</span></label>)}
              <label className="settings-check"><input type="radio" name="skill-output" checked={!!draft.output && !OUTPUT_SCHEMAS.some(o => o.id === draft.output)} onChange={() => update({ output: "NewSchema" })} /><span>{t("A new shape, named", "Une nouvelle forme, nommée")} <input aria-label={t("New schema name", "Nom du nouveau schéma")} className="wizard-schema" value={OUTPUT_SCHEMAS.some(o => o.id === draft.output) ? "" : draft.output} onChange={e => update({ output: e.target.value.replace(/[^A-Za-z0-9_]/g, "") })} placeholder="SummarySchema" /></span></label>
              <p className="muted small">{t("A new shape needs a developer to add it to lib/harness/jobs.ts before the skill can run.", "Une nouvelle forme doit être ajoutée par un développeur dans lib/harness/jobs.ts.")}</p>
            </fieldset>}
            <fieldset className="wizard-checks"><legend>{t("Checks this skill relies on", "Contrôles sur lesquels elle s’appuie")}</legend>
              {data?.rules.map(r => <label key={r.id} className="settings-check"><input type="checkbox" checked={draft.checks.includes(r.id)} onChange={() => update({ checks: toggle(draft.checks, r.id) })} /><span>{t(r.message_en, r.message_fr)} <code>{r.id}</code></span></label>)}
            </fieldset>
            <p className="wizard-note small">{t("A new skill is listed but never runs until a developer names it in a workflow step. Listing a check documents intent; the step’s rules enforce it.", "Une nouvelle compétence est listée mais ne s’exécute pas tant qu’un développeur ne l’a pas ajoutée à une étape. Lister un contrôle documente l’intention; les règles de l’étape l’appliquent.")}</p>
          </>}
          {current === "instruction" && <>
            <label className="wizard-instruction">{draft.kind === "ai" ? t("Instruction sent to the model", "Consigne envoyée au modèle") : t("What the code decides", "Ce que le code décide")}<textarea rows={16} value={draft.instruction} onChange={e => update({ instruction: e.target.value })} /></label>
            <p className="muted small">{draft.instruction.trim().length} {t("characters", "caractères")} · <button type="button" className="link-button" onClick={() => update({ instruction: SCAFFOLD[draft.kind] })}>{t("Reset to the starting text", "Revenir au texte de départ")}</button></p>
            <ul className="muted small wizard-tips">{draft.kind === "ai" ? <><li>{t("Say what goes in and the exact shape that comes out.", "Dites ce qui entre et la forme exacte du résultat.")}</li><li>{t("Numbers come from code: the model may only repeat numbers it is given.", "Les chiffres viennent du code : le modèle ne fait que répéter ceux qu’on lui donne.")}</li><li>{t("Never put names, emails or phone numbers in the instruction.", "Jamais de noms, courriels ou téléphones dans la consigne.")}</li></> : <li>{t("Name the file and function that hold the rule, then list the decisions in order.", "Nommez le fichier et la fonction de la règle, puis listez les décisions dans l’ordre.")}</li>}</ul>
          </>}
          {current === "review" && <>
            <dl className="export-summary"><div><dt>{t("Name", "Nom")}</dt><dd><code>{draft.name || "—"}</code></dd></div><div><dt>{t("Kind", "Type")}</dt><dd>{draft.kind === "ai" ? t("AI", "IA") : t("Code", "Code")}</dd></div><div><dt>{t("Owner", "Responsable")}</dt><dd>{draft.owner || "—"}</dd></div><div><dt>{t("Approver", "Approbateur")}</dt><dd>{draft.approver || "—"}</dd></div><div><dt>{t("Risk tier", "Niveau de risque")}</dt><dd><TierMeter tier={draft.tier} /></dd></div><div><dt>{t("Data", "Données")}</dt><dd>{draft.data_classes.join(", ") || "—"}</dd></div></dl>
            {problems.length === 0 ? <p className="success-text">✓ {t("Ready for review. Save it, then download the SKILL.md for a reviewer.", "Prête pour révision. Enregistrez-la, puis téléchargez le SKILL.md.")}</p> : <div className="wizard-fix"><p className="warning-text">{problems.length} {t("things to fix before review:", "points à corriger avant révision :")}</p><ul>{problems.map(p => <li key={p.en}><button type="button" className="link-button" onClick={() => goTo(STEPS.findIndex(s => s[0] === p.step))}>{t(p.en, p.fr)}</button></li>)}</ul></div>}
          </>}
          {current !== "review" && problemsAt(current).length > 0 && <ul className="wizard-problems">{problemsAt(current).map(p => <li key={p.en} className="warning-text small">{t(p.en, p.fr)}</li>)}</ul>}
          <div className="wizard-nav">
            <button type="button" className="secondary" onClick={() => goTo(Math.max(0, step - 1))} hidden={step === 0}>← {t("Back", "Retour")}</button>
            {current === "review"
              ? <span className="template-actions"><GuardedButton className="secondary" reason={nameReason} onClick={() => saveFile(draft.name + ".SKILL.md", toSkillMarkdown(draft))}>{t("Download SKILL.md", "Télécharger SKILL.md")}</GuardedButton><GuardedButton className="primary" reason={nameReason} onClick={save}>{t("Save draft", "Enregistrer l’ébauche")}</GuardedButton></span>
              : <button type="button" className="primary" onClick={() => goTo(step + 1)}>{t("Next", "Suivant")} →</button>}
          </div>
          {saved && <p role="status" className="success-text small">✓ {saved} <Link href="/skills#drafts">{t("Back to skills", "Retour aux compétences")}</Link></p>}
        </section>
      </div>
      <aside className="builder-side">
        <section className="panel builder-preview skill-preview"><p className="eyebrow">{t("SKILL.MD PREVIEW", "APERÇU DU SKILL.MD")}</p><p className="muted small"><code>standard/skills/{draft.name || "<name>"}/SKILL.md</code></p><pre>{toSkillMarkdown(draft)}</pre></section>
        <section className="panel builder-checks"><h3>{t("Checks", "Contrôles")}</h3>{problems.length === 0 ? <p className="success-text">✓ {t("Ready for review", "Prête pour révision")}</p> : <p className="warning-text small">{problems.length} {t("to fix", "à corriger")}</p>}</section>
      </aside>
    </div>
  </main>;
}
