"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { useLanguage, useRemote, Message, Loading } from "@/components/shell";
import { PRESETS, SOURCES, checkTemplate, slug, toStandardFile } from "@/lib/demo/template-kit.mjs";
import type { loadStandard } from "@/lib/demo/standard";
type Numeric = { key: string; label: string; source: { kind: string; id: string } };
type Narrative = { key: string; label: string; required: true; guidance?: string };
export type Draft = { id: string; label: string; language: "en" | "fr"; audience: string; description: string; numeric: Numeric[]; narrative: Narrative[]; updated_at?: string; from?: string };

// Drafts live in this browser until a reviewer adds the file to the standard (see the CLI steps on the page).
const KEY = "synapse.templateDrafts";
let cache: Draft[] | null = null;
const listeners = new Set<() => void>();
const EMPTY: Draft[] = [];
function readDrafts(): Draft[] { if (cache) return cache; try { cache = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { cache = []; } return cache!; }
function writeDrafts(next: Draft[]) { cache = next; try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private window */ } listeners.forEach(l => l()); }
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
function useDrafts() { return useSyncExternalStore(subscribe, readDrafts, () => EMPTY); }
function download(draft: Draft) {
  const blob = new Blob([JSON.stringify(toStandardFile(draft), null, 2) + "\n"], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = draft.id + ".json"; a.click(); URL.revokeObjectURL(a.href);
}
const fromPreset = (id: string | null): Draft => {
  const p = PRESETS.find(x => x.id === id);
  if (!p) return { id: "", label: "", language: "en", audience: "", description: "", numeric: [], narrative: [] };
  return { id: slug(p.id + "_copy"), label: p.label + " (copy)", language: p.language as "en" | "fr", audience: p.audience, description: p.description, numeric: p.numeric.map(f => ({ ...f, source: { ...f.source } })), narrative: p.narrative.map(f => ({ ...f, required: true as const })), from: p.id };
};

export function TemplateLibrary() {
  const { t } = useLanguage();
  const drafts = useDrafts();
  const standard = useRemote<ReturnType<typeof loadStandard>>("/api/standard");
  return <main id="main" className="page templates-page">
    <div className="page-heading templates-heading"><div><h1>{t("Templates", "Gabarits")}</h1><p className="muted">{t("A template says which numbers a funder report shows and where each one comes from, plus the sections a person writes and approves. Start from a preset, adjust, then send it for review.", "Un gabarit indique les chiffres d’un rapport, leur source et les sections qu’une personne rédige et approuve. Partez d’un modèle, ajustez, puis envoyez-le en révision.")}</p></div><Link className="primary" href="/templates/new">+ {t("New template", "Nouveau gabarit")}</Link></div>
    <h2 className="templates-section">{t("In use · approved standard", "En usage · référentiel approuvé")}</h2>
    <Message error={standard.error} />
    {standard.loading ? <Loading /> : <div className="template-grid">{standard.data?.templates.map(tpl => { const preset = PRESETS.find(p => p.standard === tpl.id); return <article className="template-card is-standard" key={tpl.id}>
      <div className="template-card-top"><span className="template-lang">{tpl.language.toUpperCase()}</span><span className="status-pill" data-status="completed">{t("Approved", "Approuvé")}</span></div>
      <h3>{tpl.label}</h3><p className="muted small">{tpl.numeric.length} {t("numbers from code", "chiffres calculés")} · {tpl.narrative.length} {t("cited sections", "sections sourcées")} · {t("version", "version")} <code>{tpl.version}</code></p>
      <ul className="template-fields">{tpl.numeric.slice(0, 4).map(f => <li key={f.key}>{f.label} <code>{f.source.id}</code></li>)}{tpl.numeric.length > 4 && <li className="muted">+ {tpl.numeric.length - 4}</li>}</ul>
      {preset && <Link className="secondary" href={"/templates/new?preset=" + preset.id}>{t("Duplicate as draft", "Dupliquer en ébauche")}</Link>}
    </article>; })}</div>}
    <h2 className="templates-section">{t("Presets", "Modèles prêts à l’emploi")}</h2>
    <div className="template-grid">{PRESETS.filter(p => !p.standard).map(p => <article className="template-card" key={p.id}>
      <div className="template-card-top"><span className="template-lang">{p.language.toUpperCase()}</span><span className="muted small">{p.audience}</span></div>
      <h3>{p.label}</h3><p className="small">{p.description}</p><p className="muted small">{p.numeric.length} {t("numbers", "chiffres")} · {p.narrative.length} {t("sections", "sections")}</p>
      <Link className="secondary" href={"/templates/new?preset=" + p.id}>{t("Use this preset", "Utiliser ce modèle")} →</Link>
    </article>)}</div>
    <h2 className="templates-section">{t("Your drafts", "Vos ébauches")}</h2>
    {drafts.length === 0 ? <p className="empty-note">{t("No drafts yet. Pick a preset or start a new template.", "Aucune ébauche. Choisissez un modèle ou créez un gabarit.")}</p> :
      <div className="template-grid">{drafts.map(d => { const problems = checkTemplate(toStandardFile(d)); return <article className="template-card" key={d.id}>
        <div className="template-card-top"><span className="template-lang">{d.language.toUpperCase()}</span>{problems.length ? <span className="status-pill" data-status="needs_review">{problems.length} {t("to fix", "à corriger")}</span> : <span className="status-pill" data-status="approved">{t("Ready for review", "Prêt pour révision")}</span>}</div>
        <h3>{d.label}</h3><p className="muted small"><code>{d.id}</code> · {d.numeric.length} {t("numbers", "chiffres")} · {d.narrative.length} {t("sections", "sections")}</p>
        <div className="template-actions"><Link className="secondary" href={"/templates/new?draft=" + encodeURIComponent(d.id)}>{t("Edit", "Modifier")}</Link><button type="button" className="secondary" onClick={() => download(d)}>{t("Download JSON", "Télécharger le JSON")}</button><button type="button" className="link-button" onClick={() => { if (confirm(t("Delete this draft?", "Supprimer cette ébauche ?"))) writeDrafts(readDrafts().filter(x => x.id !== d.id)); }}>{t("Delete", "Supprimer")}</button></div>
      </article>; })}</div>}
    <section className="panel template-howto"><h2>{t("From draft to standard", "De l’ébauche au référentiel")}</h2><ol>
      <li>{t("Build or adjust the template here, then download its JSON.", "Créez ou ajustez le gabarit ici, puis téléchargez son JSON.")}</li>
      <li>{t("Check it with the template CLI:", "Vérifiez-le avec l’outil en ligne de commande :")} <code>npm run template -- check standard/drafts/&lt;id&gt;.json</code></li>
      <li>{t("A reviewer moves it into standard/templates. Its version hash changes, and every report shows which version it used.", "Une personne le place dans standard/templates. Son empreinte de version change et chaque rapport indique la version utilisée.")}</li>
    </ol><p className="muted small">{t("Scaffold from the terminal:", "Depuis le terminal :")} <code>npm run template -- new my_report --preset donor-update</code> · <code>npm run template -- presets</code></p></section>
  </main>;
}

export function TemplateBuilder() {
  const { t, language } = useLanguage();
  const params = useSearchParams();
  const router = useRouter();
  const drafts = useDrafts();
  const editing = params.get("draft");
  const [draft, setDraft] = useState<Draft>(() => readDrafts().find(d => d.id === editing) ?? fromPreset(params.get("preset")));
  const [saved, setSaved] = useState("");
  const problems = checkTemplate(toStandardFile(draft));
  const update = (change: Partial<Draft>) => { setDraft(d => ({ ...d, ...change })); setSaved(""); };
  const setNumeric = (i: number, change: Partial<Numeric>) => update({ numeric: draft.numeric.map((f, j) => j === i ? { ...f, ...change } : f) });
  const setNarrative = (i: number, change: Partial<Narrative>) => update({ narrative: draft.narrative.map((f, j) => j === i ? { ...f, ...change } : f) });
  const move = <T,>(list: T[], i: number, by: number) => { const next = [...list]; const [x] = next.splice(i, 1); next.splice(Math.max(0, Math.min(next.length, i + by)), 0, x); return next; };
  const save = () => { const next = { ...draft, updated_at: new Date().toISOString() }; writeDrafts([...drafts.filter(d => d.id !== editing && d.id !== draft.id), next]); setSaved(t("Draft saved in this browser.", "Ébauche enregistrée dans ce navigateur.")); if (editing !== draft.id) router.replace("/templates/new?draft=" + encodeURIComponent(draft.id), { scroll: false }); };
  const sourceLabel = (id: string) => { const s = SOURCES.find(x => x.id === id); return s ? (language === "fr" ? s.fr : s.en) : id; };
  return <main id="main" className="page template-builder">
    <div className="breadcrumb"><Link href="/templates">{t("Templates", "Gabarits")}</Link><span>/</span><span>{editing ? t("Edit draft", "Modifier l’ébauche") : t("New template", "Nouveau gabarit")}</span></div>
    <div className="page-heading"><h1>{draft.label || t("New template", "Nouveau gabarit")}</h1><p className="muted">{t("Numbers are mapped to a source and filled by code. Sections are written from the report, cited and approved by a person.", "Chaque chiffre est relié à une source et rempli par le code. Les sections sont rédigées à partir du rapport, sourcées et approuvées.")}</p></div>
    {!editing && <div className="preset-picker"><span className="muted small">{t("Start from:", "Partir de :")}</span>{PRESETS.map(p => <button key={p.id} type="button" className={"assistant-chip" + (draft.from === p.id ? " is-active" : "")} onClick={() => { setDraft(fromPreset(p.id)); setSaved(""); }}>{p.label}</button>)}<button type="button" className={"assistant-chip" + (!draft.from ? " is-active" : "")} onClick={() => { setDraft(fromPreset(null)); setSaved(""); }}>{t("Blank", "Vierge")}</button></div>}
    <div className="builder-grid">
      <div className="builder-form">
        <section className="panel builder-section"><h2>{t("Basics", "Informations")}</h2><div className="settings-form">
          <label>{t("Name", "Nom")}<input value={draft.label} onChange={e => update({ label: e.target.value, id: editing ? draft.id : slug(e.target.value) })} placeholder={t("e.g. Donor update · one page", "p. ex. Mise à jour donateurs")} /></label>
          <label>{t("File id", "Identifiant")}<input value={draft.id} onChange={e => update({ id: slug(e.target.value) })} disabled={!!editing} /></label>
          <label>{t("Language", "Langue")}<select value={draft.language} onChange={e => update({ language: e.target.value as "en" | "fr" })}><option value="en">English</option><option value="fr">Français</option></select></label>
          <label>{t("Audience", "Public")}<input value={draft.audience} onChange={e => update({ audience: e.target.value })} placeholder={t("e.g. Board of directors", "p. ex. Conseil d’administration")} /></label>
          <label className="span-2">{t("Description", "Description")}<input value={draft.description} onChange={e => update({ description: e.target.value })} /></label>
        </div></section>
        <section className="panel builder-section"><div className="builder-section-head"><h2>{t("Numbers · filled by code", "Chiffres · remplis par le code")}</h2><button type="button" className="secondary" onClick={() => update({ numeric: [...draft.numeric, { key: "", label: "", source: { kind: "metric", id: "pct_full" } }] })}>+ {t("Add number", "Ajouter un chiffre")}</button></div>
          {draft.numeric.length === 0 && <p className="empty-note">{t("No numbers yet.", "Aucun chiffre.")}</p>}
          {draft.numeric.map((f, i) => <div className="builder-row" key={i}>
            <label>{t("Label", "Libellé")}<input value={f.label} onChange={e => setNumeric(i, { label: e.target.value, key: f.key || slug(e.target.value) })} /></label>
            <label>{t("Source", "Source")}<select value={f.source.id} onChange={e => { const s = SOURCES.find(x => x.id === e.target.value)!; setNumeric(i, { source: { kind: s.kind, id: s.id } }); }}>{["Water-point data", "Programme targets"].map(g => <optgroup key={g} label={g}>{SOURCES.filter(s => s.group === g).map(s => <option key={s.id} value={s.id}>{language === "fr" ? s.fr : s.en}</option>)}</optgroup>)}</select></label>
            <div className="builder-row-tools"><button type="button" className="link-button" onClick={() => update({ numeric: move(draft.numeric, i, -1) })} aria-label={t("Move up", "Monter")}>↑</button><button type="button" className="link-button" onClick={() => update({ numeric: move(draft.numeric, i, 1) })} aria-label={t("Move down", "Descendre")}>↓</button><button type="button" className="link-button" onClick={() => update({ numeric: draft.numeric.filter((_, j) => j !== i) })}>{t("Remove", "Retirer")}</button></div>
          </div>)}</section>
        <section className="panel builder-section"><div className="builder-section-head"><h2>{t("Sections · written, cited, approved", "Sections · rédigées, sourcées, approuvées")}</h2><button type="button" className="secondary" onClick={() => update({ narrative: [...draft.narrative, { key: "", label: "", required: true, guidance: "" }] })}>+ {t("Add section", "Ajouter une section")}</button></div>
          {draft.narrative.length === 0 && <p className="empty-note">{t("No sections yet.", "Aucune section.")}</p>}
          {draft.narrative.map((f, i) => <div className="builder-row" key={i}>
            <label>{t("Heading", "Titre")}<input value={f.label} onChange={e => setNarrative(i, { label: e.target.value, key: f.key || slug(e.target.value) })} /></label>
            <label>{t("Guidance for the writer", "Consigne de rédaction")}<input value={f.guidance ?? ""} onChange={e => setNarrative(i, { guidance: e.target.value })} /></label>
            <div className="builder-row-tools"><button type="button" className="link-button" onClick={() => update({ narrative: move(draft.narrative, i, -1) })} aria-label={t("Move up", "Monter")}>↑</button><button type="button" className="link-button" onClick={() => update({ narrative: move(draft.narrative, i, 1) })} aria-label={t("Move down", "Descendre")}>↓</button><button type="button" className="link-button" onClick={() => update({ narrative: draft.narrative.filter((_, j) => j !== i) })}>{t("Remove", "Retirer")}</button></div>
          </div>)}</section>
      </div>
      <aside className="builder-side">
        <section className="panel builder-preview" lang={draft.language}><p className="eyebrow">{t("PREVIEW", "APERÇU")}</p><h3>{draft.label || "—"}</h3>{draft.audience && <p className="muted small">{t("For", "Pour")} {draft.audience}</p>}
          {draft.numeric.map((f, i) => <div className="preview-number" key={i}><span>{f.label || "…"}</span><strong>[{f.source.id}]</strong><small>{sourceLabel(f.source.id)}</small></div>)}
          {draft.narrative.map((f, i) => <div className="preview-section" key={i}><h4>{f.label || "…"}</h4><p className="muted small">{f.guidance || t("Cited text from the report.", "Texte sourcé tiré du rapport.")}</p></div>)}
          <p className="preview-disclosure">{toStandardFile(draft).disclosure}</p></section>
        <section className="panel builder-checks"><h3>{t("Checks", "Contrôles")}</h3>{problems.length === 0 ? <p className="success-text">✓ {t("Ready for review", "Prêt pour révision")}</p> : <ul>{problems.map(p => <li key={p} className="warning-text">{p}</li>)}</ul>}
          <div className="template-actions"><button type="button" className="primary" disabled={!draft.id} onClick={save}>{t("Save draft", "Enregistrer l’ébauche")}</button><button type="button" className="secondary" disabled={!draft.id} onClick={() => download(draft)}>{t("Download JSON", "Télécharger le JSON")}</button></div>
          {saved && <p role="status" className="success-text small">✓ {saved} <Link href="/templates">{t("Back to templates", "Retour aux gabarits")}</Link></p>}
          <p className="muted small">{t("Then check it:", "Puis vérifiez :")} <code>npm run template -- check {draft.id || "<id>"}.json</code></p></section>
      </aside>
    </div>
  </main>;
}
