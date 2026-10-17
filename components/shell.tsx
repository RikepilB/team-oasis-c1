"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
const Language = createContext<{
  language: "en" | "fr";
  setLanguage: (l: "en" | "fr") => void;
}>({ language: "en", setLanguage: () => { } });
export function useLanguage() { const { language, setLanguage } = useContext(Language); return { language, setLanguage, t: (en: string, fr: string) => language === "fr" ? fr : en }; }
export function Shell({ children }: {
  children: React.ReactNode;
}) {
  const [language, setLanguage] = useState<"en" | "fr">("en");
  const pathname = usePathname();
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const t = (en: string, fr: string) => language === "fr" ? fr : en;
  return <Language.Provider value={{ language, setLanguage }}><a className="skip-link" href="#main">{t("Skip to content", "Aller au contenu")}</a><header className="topbar"><Link href="/" className="brand" aria-label="Aquifer home"><Image src="/aquifer-wordmark.svg" alt="Aquifer" width="170" height="62" /><span>{t("TEAM OASIS · REPORTING WORKSPACE", "ÉQUIPE OASIS · ESPACE DE RAPPORTS")}</span></Link><nav aria-label={t("Main navigation", "Navigation principale")}>{[["/", "Reports", "Rapports"], ["/evidence/water-points", "Evidence", "Données"], ["/standard", "Standard", "Référentiel"], ["/log", "Activity", "Activité"]].map(([url, en, fr]) => <Link key={url} href={url} aria-current={pathname === url ? "page" : undefined}>{t(en, fr)}</Link>)}</nav><div className="header-tools"><span className="replay-label"><span />REPLAY</span><label className="sr-only" htmlFor="language">Language / Langue</label><select id="language" value={language} onChange={e => setLanguage(e.target.value as "en" | "fr")}><option value="en">EN</option><option value="fr">FR</option></select></div></header><div className="demo-strip">{t("Fictional data. Recorded responses. Every report needs a person’s approval.", "Données fictives. Réponses enregistrées. Chaque rapport exige une approbation humaine.")}</div>{children}<footer className="site-footer"><span>AQUIFER / TEAM OASIS</span><span>{t("Knowledge runs deep. Decisions stay human.", "Le savoir en profondeur. Les décisions restent humaines.")}</span></footer></Language.Provider>;
}
export async function api<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.error?.message || "Request failed");
  return data;
}
export function useRemote<T>(url: string) {
  const [result, setResult] = useState<{
    url: string;
    data: T | null;
    error: string;
  }>({ url: "", data: null, error: "" });
  useEffect(() => {
    let active = true; api<T>(url).then(data => {
      if (active)
        setResult({ url, data, error: "" });
    }).catch(e => {
      if (active)
        setResult({ url, data: null, error: e.message });
    }); return () => { active = false; };
  }, [url]);
  return { data: result.url === url ? result.data : null, error: result.url === url ? result.error : "", loading: result.url !== url };
}
export function Message({ error }: {
  error: string;
}) { return error ? <div role="alert" className="message error">✕ {error}</div> : null; }
export function Loading() { const { t } = useLanguage(); return <p className="loading" role="status">{t("Loading your workspace…", "Chargement de votre espace…")}</p>; }
export function Badge({ ok, children }: {
  ok: boolean;
  children: React.ReactNode;
}) { return <span className={"badge " + (ok ? "ok" : "block")}>{ok ? "✓" : "✕"} {children}</span>; }
