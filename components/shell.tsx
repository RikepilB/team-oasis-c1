"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import "./workspace-shell.css";
import { AssistantPanel } from "@/components/assistant-panel";
import { SearchBar } from "@/components/search-bar";
import { Guide } from "@/components/guide";
import { PersonMenu } from "@/components/person-switcher";
import type { Catalog } from "@/lib/demo/catalog";
import { getReportStatus } from "@/lib/demo/presentation";

// Per-browser user preferences. Demo only: nothing here is an account or a permission.
// personId picks a demo person (lib/demo/people.ts); "custom" keeps a typed name and role.
export type Preferences = { personId: string; name: string; role: "preparer" | "reviewer" | "approver" | "admin"; language: "en" | "fr"; defaultFunder: "fdf" | "quebec"; assistantOpen: boolean | null; sidebarCollapsed: boolean };
const DEFAULTS: Preferences = { personId: "daniel", name: "Daniel", role: "preparer", language: "en", defaultFunder: "fdf", assistantOpen: null, sidebarCollapsed: false };
const KEY = "synapse.preferences";
let cache: Preferences | null = null;
const listeners = new Set<() => void>();
function readPreferences(): Preferences {
  if (cache) return cache;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    // A name saved before people existed stays a custom person instead of turning into Daniel.
    cache = { ...DEFAULTS, ...(saved.name && !saved.personId ? { personId: "custom" } : {}), ...saved };
  } catch { cache = DEFAULTS; }
  return cache!;
}
export function savePreferences(change: Partial<Preferences>) {
  cache = { ...readPreferences(), ...change };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* private window: keep them for this visit only */ }
  listeners.forEach(l => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export function usePreferences() { return useSyncExternalStore(subscribe, readPreferences, () => DEFAULTS); }
const WIDE = "(min-width: 1200px)";
function useWide() { return useSyncExternalStore(l => { const m = matchMedia(WIDE); m.addEventListener("change", l); return () => m.removeEventListener("change", l); }, () => matchMedia(WIDE).matches, () => false); }
export function useAssistant() { const prefs = usePreferences(); const wide = useWide(); const open = prefs.assistantOpen ?? wide; return { open, setOpen: (v: boolean) => savePreferences({ assistantOpen: v }) }; }
export function useLanguage() { const { language } = usePreferences(); return { language, setLanguage: (l: "en" | "fr") => savePreferences({ language: l }), t: (en: string, fr: string) => language === "fr" ? fr : en }; }

const WORKSPACE: [string, string, string][] = [["/", "Inbox", "Boîte de réception"], ["/reports", "Reports", "Rapports"], ["/approvals", "Approvals", "Approbations"], ["/templates", "Templates", "Gabarits"]];
// Files & resources is one folder: sources first, then everything that explains a number.
const RESOURCES: [string, string, string][] = [["/evidence/water-points", "Evidence", "Données"], ["/standard#workflow", "Workflow & rules", "Parcours et règles"], ["/log", "Activity log", "Journal d’activité"], ["/standard#prompts", "Prompts", "Consignes"], ["/standard#skills", "Skills", "Compétences"]];
export function Shell({ children }: { children: React.ReactNode }) {
  const { t, language, setLanguage } = useLanguage();
  const prefs = usePreferences();
  const assistant = useAssistant();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const pathname = usePathname();
  const reports = useRemote<Catalog>("/api/reports");
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const close = () => setNavigationOpen(false);
  // Desktop: collapse the sidebar to the left (remembered). Phone: open it over the page.
  const toggleSidebar = () => { if (matchMedia("(max-width: 860px)").matches) setNavigationOpen(!navigationOpen); else savePreferences({ sidebarCollapsed: !prefs.sidebarCollapsed }); };
  const item = ([href, en, fr]: [string, string, string]) => <Link key={href} href={href} onClick={close} aria-current={pathname === href ? "page" : undefined}>{t(en, fr)}</Link>;
  return <div className={"synapse-shell" + (assistant.open ? " has-assistant" : "") + (prefs.sidebarCollapsed ? " sidebar-collapsed" : "")}>
    <a className="skip-link" href="#main">{t("Skip to content", "Aller au contenu")}</a>
    <header className="synapse-topbar">
      <div className="synapse-topbar-start">
        <button type="button" className="sidebar-toggle" aria-controls="synapse-sidebar" aria-expanded={!prefs.sidebarCollapsed || navigationOpen} onClick={toggleSidebar} title={t("Show or hide the sidebar", "Afficher ou masquer le menu")}><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="3.5" width="15" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M7.5 3.5v13" stroke="currentColor" strokeWidth="1.5" /></svg><span className="sr-only">{t("Toggle the sidebar", "Afficher ou masquer le menu")}</span></button>
        <Link href="/" className="synapse-brand" onClick={close} aria-label={t("Synapse home", "Accueil Synapse")}><svg viewBox="0 0 40 28" aria-hidden="true"><circle cx="7" cy="19" r="5" /><path d="M8 19C18 19 16 8 30 8" fill="none" stroke="currentColor" strokeWidth="3" /><circle cx="31" cy="8" r="5" /></svg><strong>Synapse</strong></Link>
      </div>
      <SearchBar reports={reports.data ?? []} />
      <div className="synapse-topbar-tools">
        <label className="sr-only" htmlFor="language">Language / Langue</label><select id="language" value={language} onChange={e => setLanguage(e.target.value as "en" | "fr")}><option value="en">EN</option><option value="fr">FR</option></select>
        <button type="button" className="guide-toggle" onClick={() => setGuideOpen(true)}><span aria-hidden="true">?</span> <span className="assistant-toggle-label">{t("Open guide", "Ouvrir le guide")}</span></button>
        <button type="button" className="assistant-toggle" aria-expanded={assistant.open} aria-controls="synapse-assistant" onClick={() => assistant.setOpen(!assistant.open)}><span aria-hidden="true">✦</span> <span className="assistant-toggle-label">{t("Assistant", "Assistant")}</span></button>
      </div>
    </header>
    <div className="synapse-body">
      <aside id="synapse-sidebar" className={"synapse-sidebar" + (navigationOpen ? " is-open" : "")} onKeyDown={e => { if (e.key === "Escape") close(); }}>
        <nav aria-label={t("Main navigation", "Navigation principale")}>
          <p className="sidebar-label">{t("Workspace", "Espace de travail")}</p>{WORKSPACE.map(item)}
          <details className="sidebar-group" open><summary>{t("Files & resources", "Fichiers et ressources")}</summary>{item(["/sources", "Files & sources", "Fichiers et sources"])}<div className="sidebar-tree">{RESOURCES.map(item)}</div></details>
          <p className="sidebar-label">{t("Demo reports", "Rapports de démonstration")}</p>
          {reports.data?.map(r => <Link key={r.record_id} href={"/runs/" + r.record_id} onClick={close} aria-current={pathname === "/runs/" + r.record_id ? "page" : undefined} className="sidebar-report"><span className="sidebar-dot" data-status={getReportStatus(r)} aria-hidden="true" />{r.title}</Link>)}
          {reports.error && <p className="sidebar-note">{t("Reports unavailable", "Rapports indisponibles")}</p>}
        </nav>
        <div className="sidebar-footer">{item(["/settings", "Settings", "Paramètres"])}<PersonMenu onNavigate={close} /><p className="sidebar-note">{t("A person reviews every report.", "Une personne révise chaque rapport.")}</p></div>
      </aside>
      <div className="synapse-main"><div className="synapse-content">{children}</div>
        <footer className="synapse-footer"><span>Synapse · Team Oasis</span><span>{t("Every result has a source. Every decision has a person.", "Chaque résultat a sa source. Chaque décision a sa personne.")}</span></footer></div>
      <Guide open={guideOpen} onClose={() => setGuideOpen(false)} />
      {assistant.open && <aside id="synapse-assistant" className="synapse-assistant" aria-label={t("Evidence assistant", "Assistant de données")}><Suspense fallback={null}><AssistantPanel reports={reports.data ?? []} onClose={() => assistant.setOpen(false)} /></Suspense></aside>}
    </div>
  </div>;
}
export function useCurrentRecordId() { const pathname = usePathname(); const params = useSearchParams(); return pathname.match(/^\/runs\/([^/]+)/)?.[1] ?? params.get("record"); }
const inFlight = new Map<string, Promise<unknown>>();
function sharedGet<T>(url: string): Promise<T> {
  const current = inFlight.get(url);
  if (current) return current as Promise<T>;
  const pending = api<T>(url).finally(() => { if (inFlight.get(url) === pending) inFlight.delete(url); });
  inFlight.set(url, pending);
  return pending;
}
export async function api<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Request failed");
  return data;
}
export function useRemote<T>(url: string) {
  const [result, setResult] = useState<{ url: string; data: T | null; error: string }>({ url: "", data: null, error: "" });
  useEffect(() => {
    let active = true; sharedGet<T>(url).then(data => { if (active) setResult({ url, data, error: "" }); }).catch(e => { if (active) setResult({ url, data: null, error: e.message }); });
    return () => { active = false; };
  }, [url]);
  return { data: result.url === url ? result.data : null, error: result.url === url ? result.error : "", loading: result.url !== url };
}
export function Message({ error }: { error: string }) { return error ? <div role="alert" className="message error">✕ {error}</div> : null; }
export function Loading() { const { t } = useLanguage(); return <p className="loading" role="status">{t("Loading your workspace…", "Chargement de votre espace…")}</p>; }
export function Badge({ ok, children }: { ok: boolean; children: React.ReactNode }) { return <span className={"badge " + (ok ? "ok" : "block")}>{ok ? "✓" : "✕"} {children}</span>; }
