"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import "./workspace-shell.css";
import "./synapse-theme.css";
import { BackBar, Tip } from "@/components/ui";
import { Icon } from "@/components/icons";
import { SearchBar } from "@/components/search-bar";
import { Guide } from "@/components/guide";
import { PersonMenu } from "@/components/person-switcher";
import type { Catalog } from "@/lib/demo/catalog";
import { dueDate, priorityRank, getReportStatus } from "@/lib/demo/presentation";

// Per-browser user preferences. Demo only: nothing here is an account or a permission.
// personId picks a demo person (lib/demo/people.ts); "custom" keeps a typed name and role.
export type Preferences = { personId: string; name: string; role: "preparer" | "reviewer" | "approver" | "admin"; language: "en" | "fr"; defaultFunder: "fdf" | "quebec"; assistantOpen: boolean | null; sidebarCollapsed: boolean; textSize: TextSize };
export type TextSize = "100" | "115" | "130";
const DEFAULTS: Preferences = { personId: "daniel", name: "Daniel", role: "preparer", language: "en", defaultFunder: "fdf", assistantOpen: null, sidebarCollapsed: false, textSize: "100" };
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
// The Assistant (with the French review panel) loads only when someone opens it, not with every page. Until its
// code arrives the drawer says so, instead of opening empty.
const AssistantPanel = dynamic(() => import("@/components/assistant-panel").then(m => m.AssistantPanel), { ssr: false, loading: () => <AssistantLoading /> });
function AssistantLoading() { const { t } = useLanguage(); return <p className="loading assistant-loading" role="status">{t("Opening the Assistant…", "Ouverture de l’Assistant…")}</p>; }
// At phone width the sidebar is a drawer over the page, so its toggle reports the drawer, not the desktop rail.
const PHONE = "(max-width: 860px)";
const subscribePhone = (l: () => void) => { const m = matchMedia(PHONE); m.addEventListener("change", l); return () => m.removeEventListener("change", l); };
function usePhone() { return useSyncExternalStore(subscribePhone, () => matchMedia(PHONE).matches, () => false); }
// The Assistant starts closed so pages get the full width; it opens on request, or by itself for French review.
export function useAssistant() { const prefs = usePreferences(); const open = prefs.assistantOpen ?? false; return { open, setOpen: (v: boolean) => savePreferences({ assistantOpen: v }) }; }
export function useLanguage() { const { language } = usePreferences(); return { language, setLanguage: (l: "en" | "fr") => savePreferences({ language: l }), t: (en: string, fr: string) => language === "fr" ? fr : en }; }

const WORKSPACE: [string, string, string, string][] = [["/", "Inbox", "Boîte de réception", "inbox"], ["/reports", "Reports", "Rapports", "reports"], ["/approvals", "Approvals", "Approbations", "approvals"], ["/templates", "Templates", "Gabarits", "templates"]];
// Small line icons for the main sections only, so the rail stays readable when collapsed.
// Icons: Lucide line set, one size (20px), see components/icons.tsx.
// Files & resources is one folder: sources first, then everything that explains a number.
const RESOURCES: [string, string, string][] = [["/evidence/water-points", "Evidence", "Données"], ["/standard#workflow", "Workflow & rules", "Parcours et règles"], ["/log", "Activity log", "Journal d’activité"], ["/standard#prompts", "Prompts", "Consignes"], ["/skills", "Skills", "Compétences"]];
// Text size, right in the top bar: three "A"s from small to large. It scales the whole interface, like browser
// zoom, so layouts stay intact, and it is remembered on this device.
const TEXT_SIZES: [TextSize, string, string, string][] = [["100", "Standard text size", "Taille de texte standard", "sm"], ["115", "Larger text", "Texte plus grand", "md"], ["130", "Largest text", "Texte le plus grand", "lg"]];
export function TextSizeControl({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  const { textSize } = usePreferences();
  return <div className={"text-size " + className} role="group" aria-label={t("Text size", "Taille du texte")}>
    {TEXT_SIZES.map(([size, en, fr, cls]) => <Tip key={size} text={t(en, fr)}><button type="button" className={"text-size-btn " + cls} aria-pressed={textSize === size} aria-label={t(en, fr)} onClick={() => savePreferences({ textSize: size })}>A</button></Tip>)}
  </div>;
}
export function Shell({ children }: { children: React.ReactNode }) {
  const { t, language, setLanguage } = useLanguage();
  const prefs = usePreferences();
  const assistant = useAssistant();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const phone = usePhone();
  const [guideOpen, setGuideOpen] = useState(false);
  const pathname = usePathname();
  const reports = useRemote<Catalog>("/api/reports");
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  useEffect(() => { document.documentElement.dataset.textSize = prefs.textSize; }, [prefs.textSize]);
  const close = () => setNavigationOpen(false);
  // Desktop: collapse the sidebar to the left (remembered). Phone: open it over the page.
  const toggleSidebar = () => { if (matchMedia("(max-width: 860px)").matches) setNavigationOpen(!navigationOpen); else if (collapsed) { savePreferences({ sidebarCollapsed: false }); setRailOverride(true); } else { savePreferences({ sidebarCollapsed: true }); setRailOverride(false); } };
  const item = ([href, en, fr]: [string, string, string]) => <Link key={href} href={href} onClick={close} aria-current={pathname === href ? "page" : undefined}>{t(en, fr)}</Link>;
  // Main sections: icon + label. Collapsed, the label becomes a tooltip.
  const mainItem = ([href, en, fr, icon]: [string, string, string, string]) => <Link key={href} href={href} onClick={close} className="nav-main" data-label={t(en, fr)} aria-current={pathname === href || (href !== "/" && pathname.startsWith(href + "/")) ? "page" : undefined}><Icon name={icon} /><span className="nav-text">{t(en, fr)}</span></Link>;
  // Most urgent first, then the earliest due date, so a sooner deadline is never cut by the limit of four.
  const recent = [...(reports.data ?? [])].sort((a, b) => priorityRank(a) - priorityRank(b) || (dueDate(a)?.date ?? "9999").localeCompare(dueDate(b)?.date ?? "9999")).slice(0, 4);
  // Focus mode: on a report with the Assistant open, the sidebar shrinks to its icon rail so the report and
  // the side-by-side French pages get the room. It isn't saved; closing the Assistant brings the sidebar back.
  // Clicking a folded group in the icon rail opens the sidebar too, so its menu is reachable in one click.
  const [railOverride, setRailOverride] = useState(false);
  useEffect(() => { setRailOverride(false); }, [pathname, assistant.open]);
  const focus = assistant.open && pathname.startsWith("/runs/") && !railOverride;
  const collapsed = (prefs.sidebarCollapsed && !railOverride) || focus;
  const openGroup = (e: React.MouseEvent<HTMLElement>) => {
    if (!collapsed) return;
    e.preventDefault();
    const group = e.currentTarget.parentElement as HTMLDetailsElement | null;
    if (group) group.open = true;
    if (prefs.sidebarCollapsed) savePreferences({ sidebarCollapsed: false });
    setRailOverride(true);
  };
  return <div className={"synapse-shell" + (assistant.open ? " has-assistant" : "") + (collapsed ? " sidebar-collapsed" : "")}>
    <a className="skip-link" href="#main">{t("Skip to content", "Aller au contenu")}</a>
    <header className="synapse-topbar">
      <div className="synapse-topbar-start">
        <button type="button" className="sidebar-toggle" aria-controls="synapse-sidebar" aria-expanded={phone ? navigationOpen : !collapsed} onClick={toggleSidebar} title={t("Show or hide the sidebar", "Afficher ou masquer le menu")}><Icon name="sidebar" /><span className="sr-only">{t("Toggle the sidebar", "Afficher ou masquer le menu")}</span></button>
        <Link href="/" className="synapse-brand" onClick={close} aria-label={t("Synapse home", "Accueil Synapse")}><svg viewBox="0 0 40 28" aria-hidden="true"><circle cx="7" cy="19" r="5" /><path d="M8 19C18 19 16 8 30 8" fill="none" stroke="currentColor" strokeWidth="3" /><circle cx="31" cy="8" r="5" /></svg><strong>Synapse</strong></Link>
      </div>
      <SearchBar reports={reports.data ?? []} />
      <div className="synapse-topbar-tools">
        <TextSizeControl className="in-topbar" />
        <label className="sr-only" htmlFor="language">Language / Langue</label><select id="language" value={language} onChange={e => setLanguage(e.target.value as "en" | "fr")}><option value="en">EN</option><option value="fr">FR</option></select>
        <Tip text={t("A 1-minute tour of how Synapse works. The Assistant answers questions about a report.", "Une visite d’une minute de Synapse. L’Assistant répond aux questions sur un rapport.")}><button type="button" className="guide-toggle" onClick={() => setGuideOpen(true)}><span className="assistant-toggle-label">{t("Guide", "Guide")}</span><Icon name="help" className="guide-q" /></button></Tip>
        <Tip text={t("Ask questions about the report you’re looking at, and review the French draft.", "Posez des questions sur le rapport affiché et révisez le brouillon français.")}><button type="button" className="assistant-toggle" aria-expanded={assistant.open} aria-controls="synapse-assistant" onClick={() => assistant.setOpen(!assistant.open)}><Icon name="sparkles" className="tool-icon" /><span className="assistant-toggle-label">{t("Assistant", "Assistant")}</span></button></Tip>
      </div>
    </header>
    <div className="synapse-body">
      <aside id="synapse-sidebar" className={"synapse-sidebar" + (navigationOpen ? " is-open" : "")} onKeyDown={e => { if (e.key === "Escape") close(); }}>
        <TextSizeControl className="in-drawer" />
        <nav aria-label={t("Main navigation", "Navigation principale")}>
          <div className="nav-section">{WORKSPACE.map(mainItem)}</div>
          <details className="nav-group" open>
            <summary data-label={t("Library", "Bibliothèque")} onClick={openGroup} aria-label={collapsed ? t("Library: open the sidebar", "Bibliothèque : ouvrir le menu") : undefined}><Icon name="library" /><span className="nav-text">{t("Library", "Bibliothèque")}</span><svg className="nav-chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg></summary>
            <div className="nav-sub">{item(["/sources", "Files & sources", "Fichiers et sources"])}{RESOURCES.map(item)}</div>
          </details>
          {/* Recent reports fold away so the sidebar stays short; it opens by itself while you're on a report. */}
          <details className="nav-group nav-recent-group" open={pathname.startsWith("/runs/") || undefined} key={pathname.startsWith("/runs/") ? "on-report" : "elsewhere"}>
            <summary data-label={t("Recent reports", "Rapports récents")} onClick={openGroup} aria-label={collapsed ? t("Recent reports: open the sidebar", "Rapports récents : ouvrir le menu") : undefined}><Icon name="recent" /><span className="nav-text">{t("Recent reports", "Rapports récents")}</span><svg className="nav-chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg></summary>
            <div className="nav-sub nav-recent">
              {recent.map(r => <Link key={r.record_id} href={"/runs/" + r.record_id} onClick={close} aria-current={pathname === "/runs/" + r.record_id ? "page" : undefined} className="sidebar-report" title={r.title}>{r.priority ? <span className="sidebar-priority" data-level={r.priority.level}>{r.priority.level}</span> : <span className="sidebar-dot" data-status={getReportStatus(r)} aria-hidden="true" />}<span className="nav-text">{r.title}</span></Link>)}
              {(reports.data?.length ?? 0) > recent.length && <Link href="/reports" onClick={close} className="nav-more">{t("All reports", "Tous les rapports")} <span aria-hidden="true">→</span></Link>}
              {reports.error && <p className="sidebar-note">{t("Reports unavailable. Reload the page to try again.", "Rapports indisponibles. Rechargez la page pour réessayer.")}</p>}
            </div>
          </details>
        </nav>
        <div className="sidebar-footer"><PersonMenu onNavigate={close} /><Tip text={t("Settings", "Paramètres")}><Link href="/settings" onClick={close} className="nav-icon-link" aria-current={pathname === "/settings" ? "page" : undefined} aria-label={t("Settings", "Paramètres")}><Icon name="settings" /></Link></Tip></div>
      </aside>
      <div className="synapse-main"><div className="synapse-content"><BackBar />{children}</div>
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
