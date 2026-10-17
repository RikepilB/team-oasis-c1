"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePreferences, savePreferences, useLanguage } from "@/components/shell";
import { PEOPLE, ROLE_LABEL, whoCan, type Action, type Person } from "@/lib/demo/people";

// Switching person sets name and role together, so every report action follows the pick.
export function switchPerson(id: string) {
  const p = PEOPLE.find(x => x.id === id);
  savePreferences(p ? { personId: p.id, name: p.name, role: p.role } : { personId: "custom" });
}
export function usePerson(): Person {
  const prefs = usePreferences();
  return PEOPLE.find(p => p.id === prefs.personId) ?? { id: "custom", name: prefs.name, role: prefs.role, title_en: "Custom demo person", title_fr: "Personne de démonstration" };
}
const initial = (name: string) => (name.trim()[0] || "?").toUpperCase();

export function PersonMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useLanguage();
  const person = usePerson();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);
  const closeMenu = () => { setOpen(false); trigger.current?.focus(); };
  return <div className="person-menu" ref={root} onKeyDown={e => { if (e.key === "Escape" && open) closeMenu(); }}>
    {open && <div className="person-list" role="menu" aria-label={t("Act as", "Agir en tant que")}>
      <p className="person-list-label">{t("Act as", "Agir en tant que")}</p>
      {PEOPLE.map(p => <button key={p.id} type="button" role="menuitemradio" aria-checked={p.id === person.id} onClick={() => { switchPerson(p.id); closeMenu(); }}>
        <span className="sidebar-avatar" aria-hidden="true">{initial(p.name)}</span>
        <span className="person-text"><strong>{p.name}</strong><small>{t(...ROLE_LABEL[p.role])} · {t(p.title_en, p.title_fr)}</small></span>
        {p.id === person.id && <span className="person-check" aria-hidden="true">✓</span>}
      </button>)}
      <Link href="/settings" role="menuitem" className="person-list-link" onClick={() => { setOpen(false); onNavigate?.(); }}>{t("People and roles", "Personnes et rôles")} →</Link>
    </div>}
    <button ref={trigger} type="button" className="sidebar-user person-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
      <span className="sidebar-avatar" aria-hidden="true">{initial(person.name)}</span>
      <span className="person-text"><strong>{person.name.trim() || t("Pick a person", "Choisir une personne")}</strong><small>{t(...ROLE_LABEL[person.role])} · {t("Switch person", "Changer de personne")}</small></span>
      <span className="person-caret" aria-hidden="true">⌃</span>
    </button>
  </div>;
}

export function PersonSelect({ label }: { label: string }) {
  const { t } = useLanguage();
  const person = usePerson();
  return <label className="person-select">{label}<select value={person.id} onChange={e => switchPerson(e.target.value)}>
    {PEOPLE.map(p => <option key={p.id} value={p.id}>{p.name} · {t(...ROLE_LABEL[p.role])}</option>)}
    <option value="custom">{t("Custom name…", "Nom personnalisé…")}</option>
  </select></label>;
}

const VERB: Record<Action, [string, string]> = {
  prepare: ["prepare and edit drafts", "préparer et modifier les ébauches"],
  review: ["confirm the bilingual review", "confirmer la révision bilingue"],
  approve: ["approve content", "approuver le contenu"],
  export: ["confirm the export", "confirmer l’export"],
  settings: ["change app settings", "modifier les paramètres"],
};
// Names who can act and offers a one-click switch, so a solo demo never hits a dead button.
export function SwitchNotice({ action }: { action: Action }) {
  const { t, language } = useLanguage();
  const person = usePerson();
  const to = whoCan(action);
  const role = t(...ROLE_LABEL[to.role]).toLowerCase();
  return <p className="switch-notice" role="note">
    <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
    <span>{language === "fr" ? `Réservé au rôle ${role} : ${VERB[action][1]}.` : `Only the ${role} can ${VERB[action][0]}.`} {t("You are acting as", "Vous agissez en tant que")} {person.name.trim() || "—"}.</span>
    <button type="button" className="link-button" onClick={() => switchPerson(to.id)}>{t("Switch to", "Passer à")} {to.name} →</button>
  </p>;
}
