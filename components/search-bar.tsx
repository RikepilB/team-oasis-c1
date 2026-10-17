"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/shell";
import type { Catalog } from "@/lib/demo/catalog";
type Result = { href: string; label: string; kind: string };
const PAGES: [string, string, string][] = [["/", "Inbox", "Boîte de réception"], ["/reports", "Reports", "Rapports"], ["/approvals", "Approvals", "Approbations"], ["/templates", "Templates", "Gabarits"], ["/templates/new", "New template", "Nouveau gabarit"], ["/sources", "Files & Sources", "Fichiers et sources"], ["/evidence/water-points", "Water points", "Points d’eau"], ["/standard", "Workflow & rules", "Parcours et règles"], ["/log", "Activity log", "Journal d’activité"], ["/settings", "Settings", "Paramètres"]];
// One box for reports, pages and templates; press "/" anywhere to focus it.
export function SearchBar({ reports }: { reports: Catalog }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { const tag = (e.target as HTMLElement)?.tagName; if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(tag)) { e.preventDefault(); input.current?.focus(); } };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);
  const q = query.trim().toLocaleLowerCase("en-CA");
  const results: Result[] = !q ? [] : [
    ...reports.filter(r => [r.title, r.record_id, r.project, r.funder, r.period, r.preparer].some(v => v?.toLocaleLowerCase("en-CA").includes(q))).map(r => ({ href: "/runs/" + r.record_id, label: r.title, kind: t("Report", "Rapport") })),
    ...PAGES.filter(([, en, fr]) => en.toLocaleLowerCase().includes(q) || fr.toLocaleLowerCase().includes(q)).map(([href, en, fr]) => ({ href, label: t(en, fr), kind: t("Page", "Page") })),
  ].slice(0, 8);
  const go = (r?: Result) => { if (!r) return; router.push(r.href); setQuery(""); setOpen(false); (document.activeElement as HTMLElement | null)?.blur(); };
  return <div className="synapse-search" role="search">
    <label className="sr-only" htmlFor="synapse-search">{t("Search reports and pages", "Rechercher rapports et pages")}</label>
    <span className="search-icon" aria-hidden="true">⌕</span>
    <input ref={input} id="synapse-search" type="search" autoComplete="off" role="combobox" aria-expanded={open && results.length > 0} aria-controls="synapse-search-results" aria-activedescendant={open && results[active] ? "search-result-" + active : undefined}
      placeholder={t("Search reports, projects, funders…", "Rechercher rapports, projets, bailleurs…")} value={query}
      onChange={e => { setQuery(e.target.value); setOpen(true); setActive(0); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
      onKeyDown={e => { if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); } else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); } else if (e.key === "Enter") { e.preventDefault(); go(results[active]); } else if (e.key === "Escape") { setOpen(false); input.current?.blur(); } }} />
    <kbd aria-hidden="true">/</kbd>
    {open && q && <ul id="synapse-search-results" role="listbox" className="search-results">
      {results.length === 0 ? <li className="search-empty">{t("No match. Try a project, funder or period.", "Aucun résultat. Essayez un projet, un bailleur ou une période.")}</li> :
        results.map((r, i) => <li key={r.href + r.label} id={"search-result-" + i} role="option" aria-selected={i === active} onMouseDown={e => { e.preventDefault(); go(r); }} onMouseEnter={() => setActive(i)}><span>{r.label}</span><small>{r.kind}</small></li>)}
    </ul>}
  </div>;
}
