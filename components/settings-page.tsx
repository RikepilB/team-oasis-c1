"use client";
import Link from "next/link";
import { useState } from "react";
import { useLanguage, useRemote, usePreferences, savePreferences, Message, type Preferences } from "@/components/shell";
import type { loadStandard } from "@/lib/demo/standard";
type Health = { application: string; storage: string; provider: string; identity: string; cache: string };
const ROLES: [Preferences["role"], string, string][] = [["preparer", "Preparer", "Préparateur"], ["reviewer", "Bilingual reviewer", "Réviseur bilingue"], ["approver", "Approver", "Approbateur"], ["admin", "Administrator", "Administrateur"]];
export function SettingsPage() {
  const { t } = useLanguage();
  const prefs = usePreferences();
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
      <p className="muted">{t("Saved in this browser only. Your name fills in Preparer and Acting person on reports. A role here is a demo label, not a permission.", "Enregistré dans ce navigateur seulement. Votre nom remplit Préparateur et Personne responsable. Le rôle est une étiquette de démonstration, pas un droit.")}</p>
      <div className="settings-form">
        <label>{t("Display name", "Nom affiché")}<input value={prefs.name} maxLength={60} placeholder={t("e.g. Casey", "p. ex. Casey")} onChange={e => set({ name: e.target.value })} /></label>
        <label>{t("Role in this demo", "Rôle dans la démo")}<select value={prefs.role} onChange={e => set({ role: e.target.value as Preferences["role"] })}>{ROLES.map(([v, en, fr]) => <option key={v} value={v}>{t(en, fr)}</option>)}</select></label>
        <label>{t("Language", "Langue")}<select value={prefs.language} onChange={e => set({ language: e.target.value as "en" | "fr" })}><option value="en">English</option><option value="fr">Français</option></select></label>
        <label>{t("Default funder version", "Version de bailleur par défaut")}<select value={prefs.defaultFunder} onChange={e => set({ defaultFunder: e.target.value as "fdf" | "quebec" })}><option value="fdf">FDF · English</option><option value="quebec">Fondation du Québec · Français</option></select></label>
        <label className="settings-check"><input type="checkbox" checked={prefs.assistantOpen !== false} onChange={e => set({ assistantOpen: e.target.checked })} />{t("Show the evidence assistant on the right", "Afficher l’assistant de données à droite")}</label>
      </div>
      {saved && <p role="status" className="success-text">✓ {t("Saved on this browser.", "Enregistré dans ce navigateur.")}</p>}
      <p className="muted small">{t("Notifications and sign-in are not connected in this demo.", "Notifications et connexion ne sont pas branchées dans cette démo.")}</p>
    </section>}
    {tab === "app" && <section id="settings-app" role="tabpanel" aria-labelledby="settings-tab-app" className="panel settings-panel">
      <h2>{t("App settings", "Paramètres de l’application")}</h2>
      <p className="muted">{t("Set by the team on the server. Read-only here, so a demo user cannot change how reports are checked.", "Définis par l’équipe sur le serveur. En lecture seule ici : un utilisateur ne peut pas modifier les contrôles.")}</p>
      <Message error={health.error} />
      <h3>{t("Runtime", "Exécution")}</h3>
      <dl className="settings-list">
        {row(t("Storage", "Stockage"), health.data?.storage ?? "…", t("Where records, approvals and the audit log are kept.", "Où sont conservés rapports, approbations et journal."))}
        {row(t("AI provider", "Fournisseur IA"), health.data?.provider ?? "…", t("Replay uses recorded responses; live needs a server key.", "Le rejeu utilise des réponses enregistrées; le mode direct exige une clé serveur."))}
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
