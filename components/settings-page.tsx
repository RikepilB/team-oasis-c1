"use client";
import Link from "next/link";
import { useState } from "react";
import { useLanguage, useRemote, usePreferences, savePreferences, Message, type Preferences } from "@/components/shell";
import type { loadStandard } from "@/lib/demo/standard";
import { PersonSelect, switchPerson, usePerson } from "@/components/person-switcher";
import { PEOPLE, ROLE_LABEL, canDo, type Action, type Role } from "@/lib/demo/people";
type Health = { application: string; storage: string; provider: string; model: string | null; api_key: "set" | "missing" | null; identity: string; cache: string };
const ACTIONS: [Action, string, string][] = [["prepare", "Prepare & edit", "Préparer et modifier"], ["review", "French review", "Révision française"], ["approve", "Approve & export", "Approuver et exporter"], ["settings", "Owns settings*", "Paramètres*"]];
export function SettingsPage() {
  const { t } = useLanguage();
  const prefs = usePreferences();
  const person = usePerson();
  const [tab, setTab] = useState<"user" | "app">("user");
  const [saved, setSaved] = useState(false);
  const health = useRemote<Health>("/api/health");
  const standard = useRemote<ReturnType<typeof loadStandard>>("/api/standard");
  const set = (change: Partial<Preferences>) => { savePreferences(change); setSaved(true); };
  const row = (label: string, value: React.ReactNode, note?: string) => <div className="settings-row"><dt>{label}</dt><dd>{value}{note && <small>{note}</small>}</dd></div>;
  return <main id="main" className="page settings-page">
    <div className="page-heading"><h1>{t("Settings", "Paramètres")}</h1><p className="muted">{t("Your own preferences, and how this workspace is set up.", "Vos préférences, et la configuration de cet espace de travail.")}</p></div>
    <div className="settings-tabs" role="tablist" aria-label={t("Settings sections", "Sections des paramètres")}>
      {([["user", "Your profile", "Votre profil"], ["app", "App settings", "Paramètres de l’application"]] as const).map(([key, en, fr]) => <button key={key} type="button" role="tab" id={"settings-tab-" + key} aria-selected={tab === key} aria-controls={"settings-" + key} onClick={() => setTab(key)}>{t(en, fr)}</button>)}
    </div>
    {tab === "user" && <section id="settings-user" role="tabpanel" aria-labelledby="settings-tab-user" className="panel settings-panel">
      <h2>{t("Your profile", "Votre profil")}</h2>
      <p className="muted">{t("No sign-in in this demo: pick who you are acting as. Reports record that person, and each step shows which role can act. Saved in this browser only.", "Aucune connexion dans cette démo : choisissez la personne. Les rapports enregistrent cette personne et chaque étape indique le rôle qui peut agir. Enregistré dans ce navigateur seulement.")}</p>
      <div className="settings-form">
        <PersonSelect label={t("Acting as", "Agir en tant que")} />
        {prefs.personId === "custom" ? <>
          <label>{t("Custom name", "Nom personnalisé")}<input value={prefs.name} maxLength={60} placeholder={t("e.g. Casey", "p. ex. Casey")} onChange={e => set({ name: e.target.value })} /></label>
          <label>{t("Custom role", "Rôle personnalisé")}<select value={prefs.role} onChange={e => set({ role: e.target.value as Preferences["role"] })}>{(Object.keys(ROLE_LABEL) as Role[]).map(v => <option key={v} value={v}>{t(...ROLE_LABEL[v])}</option>)}</select></label>
        </> : <p className="settings-person-note">{t(person.title_en, person.title_fr)} · {t(...ROLE_LABEL[person.role])}</p>}
        <label>{t("Language", "Langue")}<select value={prefs.language} onChange={e => set({ language: e.target.value as "en" | "fr" })}><option value="en">English</option><option value="fr">Français</option></select></label>
        <label>{t("Default funder version", "Version de bailleur par défaut")}<select value={prefs.defaultFunder} onChange={e => set({ defaultFunder: e.target.value as "fdf" | "quebec" })}><option value="fdf">FDF · English</option><option value="quebec">Fondation du Québec · Français</option></select></label>
        <label className="settings-check"><input type="checkbox" checked={prefs.assistantOpen !== false} onChange={e => set({ assistantOpen: e.target.checked })} />{t("Show the evidence assistant on the right", "Afficher l’assistant de données à droite")}</label>
      </div>
      {saved && <p role="status" className="success-text">✓ {t("Saved on this browser.", "Enregistré dans ce navigateur.")}</p>}
      <h3>{t("People and roles", "Personnes et rôles")}</h3>
      <p className="muted small">{t("Fictional demo people. Switch from the sidebar at any time; the server still refuses self-approval and unreviewed French.", "Personnes fictives. Changez depuis le menu à tout moment; le serveur refuse toujours l’auto-approbation et le français non révisé.")}</p>
      <div className="table-scroll"><table className="people-table">
        <thead><tr><th scope="col">{t("Person", "Personne")}</th>{ACTIONS.map(([a, en, fr]) => <th scope="col" key={a}>{t(en, fr)}</th>)}<th scope="col"><span className="sr-only">{t("Switch", "Changer")}</span></th></tr></thead>
        <tbody>{PEOPLE.map(p => <tr key={p.id} aria-current={p.id === person.id ? "true" : undefined}>
          <th scope="row"><strong>{p.name}</strong><small>{t(...ROLE_LABEL[p.role])} · {t(p.title_en, p.title_fr)}</small></th>
          {ACTIONS.map(([a]) => <td key={a}>{canDo(p.role, a) ? <span className="people-yes">✓ <span className="sr-only">{t("Yes", "Oui")}</span></span> : <span className="people-no" aria-label={t("No", "Non")}>—</span>}</td>)}
          <td>{p.id === person.id ? <span className="people-current">{t("Acting", "Actif")}</span> : <button type="button" className="secondary" onClick={() => switchPerson(p.id)}>{t("Act as", "Agir")}</button>}</td>
        </tr>)}</tbody>
      </table></div>
      <p className="muted small">{t("* App settings are view-only for everyone in this demo. Notifications and sign-in are not connected.", "* Les paramètres sont en lecture seule pour tous dans cette démo. Notifications et connexion ne sont pas branchées.")}</p>
    </section>}
    {tab === "app" && <section id="settings-app" role="tabpanel" aria-labelledby="settings-tab-app" className="panel settings-panel">
      <h2>{t("App settings", "Paramètres de l’application")}</h2>
      <p className="muted">{t("Set by the team on the server. Read-only here, so a demo user cannot change how reports are checked.", "Définis par l’équipe sur le serveur. En lecture seule ici : un utilisateur ne peut pas modifier les contrôles.")}</p>
      <Message error={health.error} />
      <h3>{t("Runtime", "Exécution")}</h3>
      <dl className="settings-list">
        {row(t("Storage", "Stockage"), health.data?.storage ?? "…", t("Where records, approvals and the audit log are kept.", "Où sont conservés rapports, approbations et journal."))}
        {row(t("AI mode", "Mode IA"), !health.data ? "…" : health.data.provider === "live" ? t("Live", "Direct") + " · " + (health.data.model ?? "") + (health.data.api_key === "missing" ? " · " + t("no API key set", "aucune clé API") : "") : t("Replay (recorded answers)", "Rejeu (réponses enregistrées)"), t("Replay needs no key or internet. For live, set AI_MODE=live and ANTHROPIC_API_KEY in .env.local, then restart.", "Le rejeu ne demande ni clé ni internet. Pour le mode direct, ajoutez AI_MODE=live et ANTHROPIC_API_KEY dans .env.local, puis redémarrez."))}
        {row(t("Evidence cache", "Cache des données"), health.data?.cache ?? "…", t("Caches saved evidence views only; approvals always read storage.", "Met en cache les vues de données seulement; les approbations lisent toujours le stockage."))}
        {row(t("Identity", "Identité"), health.data?.identity ?? "…", t("Named demo people. No sign-in or tenant controls.", "Personnes fictives nommées. Aucune connexion ni contrôle de locataire."))}
      </dl>
      <h3>{t("Reporting standard", "Référentiel de rapport")}</h3>
      <dl className="settings-list">
        {row(t("Funder templates", "Gabarits de bailleurs"), standard.data ? standard.data.templates.map(x => x.label).join(" · ") : "…")}
        {row(t("Workflow, rules and skills", "Parcours, règles et compétences"), <Link href="/standard">{t("View the standard", "Voir le référentiel")} ↗</Link>)}
      </dl>
      <h3>{t("Controls", "Contrôles")}</h3>
      <ul className="settings-controls">
        <li>{t("Approver must differ from the preparer; approval binds to one revision.", "L’approbateur diffère du préparateur; l’approbation vise une révision.")}</li>
        <li>{t("Any edit clears the approval of that version.", "Toute modification annule l’approbation de cette version.")}</li>
        <li>{t("Hash-chained activity log; personal-data guard before every AI step.", "Journal chaîné par empreintes; garde des données personnelles avant chaque étape IA.")}</li>
        <li>{t("Controls aligned to SOC 2 criteria (not a certification).", "Contrôles alignés sur les critères SOC 2 (pas une certification).")}</li>
      </ul>
      <h3>{t("Integrations", "Intégrations")}</h3>
      <dl className="settings-list">
        {row(t("Evidence API", "API de données"), t("Available", "Disponible"))}
        {row(t("MCP adapter (read-only)", "Adaptateur MCP (lecture seule)"), t("Available, not installed", "Disponible, non installé"))}
        {row(t("Email, Drive, project tools, voice", "Courriel, Drive, outils de projet, voix"), t("Not connected", "Non branchés"))}
      </dl>
    </section>}
  </main>;
}
