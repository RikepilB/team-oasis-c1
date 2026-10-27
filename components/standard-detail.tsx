"use client";
import Link from "next/link";
import { useLanguage, useRemote, Message, Loading } from "@/components/shell";
import { PRESETS, SOURCES } from "@/lib/demo/template-kit.mjs";
import type { loadStandard } from "@/lib/demo/standard";

// Read-only views of one funder template and one profile, so the standard can be clicked through and
// seen, not only listed. Changing either still means a reviewed change to the files under standard/.
type Standard = ReturnType<typeof loadStandard>;
type Health = { provider: string; model: string | null };

const KIND: Record<string, [string, string]> = { metric: ["Water-point data", "Données des points d’eau"], constant: ["Programme target", "Cible du programme"], fact: ["Fact from the report", "Fait tiré du rapport"] };

function NotFound({ en, fr }: { en: string; fr: string }) {
  const { t } = useLanguage();
  return <main id="main" className="page"><div className="page-heading"><h1>{t(en, fr)}</h1></div><Link className="secondary" href="/standard#templates">{t("Open workflow & rules", "Ouvrir parcours et règles")}</Link></main>;
}

export function TemplateDetail({ id }: { id: string }) {
  const { t, language } = useLanguage();
  const { data, error, loading } = useRemote<Standard>("/api/standard");
  if (loading || error || !data) return <main id="main" className="page"><Message error={error} />{loading && <Loading />}</main>;
  const tpl = data.templates.find(x => x.id === id);
  if (!tpl) return <NotFound en="Template not found" fr="Gabarit introuvable" />;
  const preset = PRESETS.find(p => p.standard === tpl.id);
  const profiles = data.profiles.filter(p => p.templates.includes(tpl.id));
  const sourceName = (sid: string) => { const s = SOURCES.find(x => x.id === sid); return s ? (language === "fr" ? s.fr : s.en) : sid; };
  const download = () => {
    const file = { id: tpl.id, language: tpl.language, label: tpl.label, disclosure: tpl.disclosure, numeric: tpl.numeric, narrative: tpl.narrative };
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2) + "\n"], { type: "application/json" })); a.download = tpl.id + ".json"; a.click(); URL.revokeObjectURL(a.href);
  };
  return <main id="main" className="page template-detail">
    <div className="page-heading"><p className="eyebrow">{t("FUNDER TEMPLATE · APPROVED STANDARD", "GABARIT DE BAILLEUR · RÉFÉRENTIEL APPROUVÉ")}</p><h1>{tpl.label} · {tpl.language.toUpperCase()}</h1>
      <p className="muted">{tpl.numeric.length} {t("numbers filled by code", "chiffres remplis par le code")} · {tpl.narrative.length} {t("sections written, cited and approved by a person", "sections rédigées, sourcées et approuvées par une personne")} · {t("version", "version")} <code>{tpl.version}</code></p></div>
    <div className="template-actions skill-actions">{preset && <Link className="primary" href={"/templates/new?preset=" + preset.id}>{t("Duplicate as draft", "Dupliquer en ébauche")}</Link>}<button type="button" className="secondary" onClick={download}>{t("Download JSON", "Télécharger le JSON")}</button></div>
    <div className="detail-grid">
      <section className="panel field-map"><h2>{t("Numbers · where each one comes from", "Chiffres · d’où vient chacun")}</h2>
        <p className="muted small">{t("Code fills every number from one source. The AI never writes a number, and a check blocks approval if a figure does not match.", "Le code remplit chaque chiffre à partir d’une source. L’IA n’écrit jamais de chiffre, et un contrôle bloque l’approbation si un chiffre ne correspond pas.")}</p>
        <ol className="map-rows">{tpl.numeric.map(f => <li key={f.key}>
          <span className="map-source"><span className="map-kind" data-kind={f.source.kind}>{t(...(KIND[f.source.kind] ?? [f.source.kind, f.source.kind]))}</span><strong>{sourceName(f.source.id)}</strong><code>{f.source.id}</code></span>
          <span className="map-arrow" aria-label={t("fills", "remplit")}>→</span>
          <span className="map-field"><strong>{f.label}</strong><code>{f.key}</code></span>
        </li>)}</ol>
      </section>
      <section className="panel"><h2>{t("Sections · written, cited, approved", "Sections · rédigées, sourcées, approuvées")}</h2>
        <ol className="section-flow">{tpl.narrative.map(f => <li key={f.key}><span><strong>{f.label}</strong> <code>{f.key}</code></span><span className="flow-tags"><span>{t("Drafted from the report", "Rédigée à partir du rapport")}</span><span>{t("Every number cited", "Chaque chiffre sourcé")}</span><span>{t("Approved by a person", "Approuvée par une personne")}</span></span></li>)}</ol>
      </section>
      <section className="panel"><h2>{t("Disclosure on every export", "Mention sur chaque export")}</h2>
        <p className="disclosure-text" lang={tpl.language}>{tpl.disclosure.split(/(\{approver\}|\{date\})/).map((part, i) => /^\{(approver|date)\}$/.test(part) ? <mark key={i} title={part}>{part === "{approver}" ? (tpl.language === "fr" ? "nom de l’approbateur" : "approver’s name") : (tpl.language === "fr" ? "date d’approbation" : "approval date")}</mark> : part)}</p>
      </section>
      <section className="panel"><h2>{t("Profiles that use it", "Profils qui l’utilisent")}</h2>
        {profiles.length ? <p className="wizard-tags">{profiles.map(p => <Link className="skill-step-chip" key={p.id} href={"/profiles/" + p.id}>{p.label}</Link>)}</p> : <p className="muted small">{t("No profile uses this template.", "Aucun profil n’utilise ce gabarit.")}</p>}
      </section>
      <section className="panel builder-preview template-preview" lang={tpl.language}><p className="eyebrow">{t("HOW THE REPORT READS", "APERÇU DU RAPPORT")}</p><h3>{tpl.label}</h3>
        {tpl.numeric.map(f => <div className="preview-number" key={f.key}><span>{f.label}</span><strong>[{f.source.id}]</strong></div>)}
        {tpl.narrative.map(f => <div className="preview-section" key={f.key}><h4>{f.label}</h4><p className="muted small">{t("Cited text from the report.", "Texte sourcé tiré du rapport.")}</p></div>)}
      </section>
    </div>
  </main>;
}

const DEFINITIONS: [string, string, string, "full_only" | "incl_partly"][] = [["Fully working", "Entièrement fonctionnels", "pct_full", "full_only"], ["Including partly working", "Partiellement fonctionnels inclus", "pct_incl_partly", "incl_partly"]];

export function ProfileDetail({ id }: { id: string }) {
  const { t } = useLanguage();
  const { data, error, loading } = useRemote<Standard>("/api/standard");
  const health = useRemote<Health>("/api/health");
  if (loading || error || !data) return <main id="main" className="page"><Message error={error} />{loading && <Loading />}</main>;
  const p = data.profiles.find(x => x.id === id);
  if (!p) return <NotFound en="Profile not found" fr="Profil introuvable" />;
  const pct = new Intl.NumberFormat(p.number_locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(0.853);
  const count = new Intl.NumberFormat(p.number_locale).format(1900);
  const date = new Intl.DateTimeFormat(p.number_locale, { dateStyle: "long" }).format(new Date(2026, 6, 31));
  const templates = p.templates.map(tid => data.templates.find(x => x.id === tid)).filter(x => !!x);
  const reported = (def: "full_only" | "incl_partly") => p.functionality_definition === "both" || p.functionality_definition === def;
  const live = health.data?.provider === "live";
  return <main id="main" className="page profile-detail">
    <div className="page-heading"><p className="eyebrow">{t("PROFILE", "PROFIL")}</p><h1>{p.label}</h1><p className="muted">{t("Where the workflow runs: the language, how numbers and dates are written, how working water points are counted, and which funder templates it fills.", "Où le parcours s’exécute : la langue, l’écriture des chiffres et des dates, le comptage des points d’eau et les gabarits remplis.")}</p></div>
    <div className="count-grid skills-counts">
      <div className="count-card"><span>{t("Language", "Langue")}</span><strong>{p.language.toUpperCase()}</strong><small>{p.language === "fr" ? "Français" : "English"}</small></div>
      <div className="count-card"><span>{t("A percentage reads", "Un pourcentage s’écrit")}</span><strong lang={p.language}>{pct}</strong><small><code>{p.number_locale}</code></small></div>
      <div className="count-card"><span>{t("Funder templates", "Gabarits de bailleurs")}</span><strong>{templates.length}</strong><small>{templates.map(x => x.label).join(" · ") || "—"}</small></div>
    </div>
    <div className="detail-grid">
      <section className="panel"><h2>{t("How numbers and dates look", "Écriture des chiffres et des dates")}</h2>
        <dl className="export-summary" lang={p.language}><div><dt>{t("Percentage", "Pourcentage")}</dt><dd>{pct}</dd></div><div><dt>{t("Count", "Nombre")}</dt><dd>{count}</dd></div><div><dt>{t("Date", "Date")}</dt><dd>{date}</dd></div><div><dt>{t("Locale", "Paramètres régionaux")}</dt><dd><code>{p.number_locale}</code></dd></div></dl>
      </section>
      <section className="panel"><h2>{t("Counting working water points", "Compter les points d’eau fonctionnels")}</h2>
        <div className="definition-cards">{DEFINITIONS.map(([en, fr, key, def]) => <div key={key} className="definition-card" data-on={reported(def) || undefined}><strong>{t(en, fr)}</strong><code>{key}</code><span className={reported(def) ? "success-text small" : "muted small"}>{reported(def) ? "✓ " + t("Reported", "Présenté") : t("Not reported", "Non présenté")}</span></div>)}</div>
        <p className="muted small">{p.functionality_definition === "both" ? t("Both are shown, so a reader sees the two ways of counting side by side.", "Les deux sont présentés, pour voir les deux façons de compter côte à côte.") : t("Only one way of counting is shown.", "Une seule façon de compter est présentée.")}</p>
      </section>
      <section className="panel"><h2>{t("Funder templates it fills", "Gabarits remplis")}</h2>
        {templates.length ? <div className="template-grid">{templates.map(x => <Link className="template-card template-link" key={x.id} href={"/templates/" + x.id}><span className="template-card-top"><span className="template-lang">{x.language.toUpperCase()}</span><code>{x.version}</code></span><strong>{x.label}</strong><span className="muted small">{x.numeric.length} {t("numbers", "chiffres")} · {x.narrative.length} {t("sections", "sections")} →</span></Link>)}</div> : <p className="muted small">{t("No funder template in the standard matches this profile.", "Aucun gabarit du référentiel ne correspond à ce profil.")}</p>}
      </section>
      <section className="panel"><h2>{t("AI on this server", "IA sur ce serveur")}</h2>
        <p>{health.loading ? "…" : live ? t("Live model", "Modèle en direct") + (health.data?.model ? " · " + health.data.model : "") : t("Recorded answers (replay): no key and no internet needed.", "Réponses enregistrées (rejeu) : ni clé ni Internet.")}</p>
        <p className="muted small">{t("Set by AI_MODE on the server, not by the profile. The same checks apply in both modes.", "Défini par AI_MODE sur le serveur, pas par le profil. Les mêmes contrôles s’appliquent dans les deux modes.")}</p>
      </section>
    </div>
  </main>;
}
