"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useLanguage } from "@/components/shell";
// First-visit walkthrough. It highlights one part of the page per step; "Open guide" in the top bar replays it.
const SEEN = "synapse.guideSeen";
const listeners = new Set<() => void>();
const seen = () => { try { return localStorage.getItem(SEEN) === "1"; } catch { return true; } };
const markSeen = () => { try { localStorage.setItem(SEEN, "1"); } catch { /* private window */ } listeners.forEach(l => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const STEPS: { target: string | null; en: [string, string]; fr: [string, string] }[] = [
  { target: null, en: ["Welcome to Synapse", "Synapse turns a programme report into a checked, bilingual funder report. Numbers come from code and sources; a person approves every report."], fr: ["Bienvenue dans Synapse", "Synapse transforme un rapport de programme en rapport vérifié et bilingue. Les chiffres viennent du code et des sources; une personne approuve chaque rapport."] },
  { target: "#synapse-sidebar", en: ["Everything in one place", "Inbox, Reports, Approvals and Templates, then Files & resources: evidence, workflow and rules, activity, prompts and skills. The panel button hides the sidebar."], fr: ["Tout au même endroit", "Boîte de réception, rapports, approbations et gabarits, puis fichiers et ressources : données, parcours, activité, consignes et compétences. Le bouton de panneau masque le menu."] },
  { target: ".synapse-search", en: ["Search anything", "Find a report by project, funder, period or person, or jump to a page. Press / from anywhere."], fr: ["Tout rechercher", "Trouvez un rapport par projet, bailleur, période ou personne, ou ouvrez une page. Appuyez sur / n’importe où."] },
  { target: ".inbox-views", en: ["Saved views", "Needs action shows reports ready for review or export. Completed means both funder versions are exported at their current revision."], fr: ["Vues enregistrées", "Action requise montre les rapports prêts à réviser ou exporter. Terminé signifie que les deux versions sont exportées à leur révision actuelle."] },
  { target: ".assistant-toggle", en: ["Ask the evidence assistant", "Ask where a number comes from or what is missing. Every answer quotes the report; nothing is invented."], fr: ["Demandez à l’assistant", "Demandez d’où vient un chiffre ou ce qui manque. Chaque réponse cite le rapport; rien n’est inventé."] },
  { target: ".person-menu", en: ["Switch person", "No sign-in: pick who you are acting as. Daniel prepares, the bilingual coordinator reviews French, the director approves. Each step offers a switch to the right person."], fr: ["Changer de personne", "Pas de connexion : choisissez la personne. Daniel prépare, la coordination bilingue révise le français, la direction approuve. Chaque étape propose de passer à la bonne personne."] },
  { target: null, en: ["Open a report", "Tabs take you from the Original to the French version and Approvals. The bar at the bottom approves, then exports to Markdown, PDF, Word or Excel."], fr: ["Ouvrez un rapport", "Les onglets vont de l’original à la version française et aux approbations. La barre du bas approuve, puis exporte en Markdown, PDF, Word ou Excel."] },
];
export function Guide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, language } = useLanguage();
  const firstVisit = !useSyncExternalStore(subscribe, seen, () => true);
  const [step, setStep] = useState(0);
  const visible = open || firstVisit;
  // Skip steps whose part of the page is not on this screen.
  const steps = STEPS.filter(s => !s.target || (typeof document !== "undefined" && document.querySelector(s.target)));
  const current = steps[Math.min(step, steps.length - 1)];
  useEffect(() => {
    if (!visible || !current?.target) return;
    const el = document.querySelector(current.target);
    el?.classList.add("guide-target"); el?.scrollIntoView({ block: "nearest" });
    return () => el?.classList.remove("guide-target");
  }, [visible, current]);
  if (!visible || !current) return null;
  const [title, body] = language === "fr" ? current.fr : current.en;
  const finish = () => { markSeen(); setStep(0); onClose(); };
  const last = step >= steps.length - 1;
  return <div className="guide-layer" role="dialog" aria-modal="false" aria-labelledby="guide-title" onKeyDown={e => { if (e.key === "Escape") finish(); }}>
    <div className="guide-card">
      <p className="guide-count">{t("Guide", "Guide")} · {Math.min(step, steps.length - 1) + 1} / {steps.length}</p>
      <h2 id="guide-title">{title}</h2><p>{body}</p>
      <div className="guide-actions"><button type="button" className="link-button" onClick={finish}>{t("Skip", "Passer")}</button><span>{step > 0 && <button type="button" className="secondary" onClick={() => setStep(step - 1)}>{t("Back", "Retour")}</button>}<button type="button" className="primary" autoFocus onClick={() => last ? finish() : setStep(step + 1)}>{last ? t("Start", "Commencer") : t("Next", "Suivant")}</button></span></div>
    </div>
  </div>;
}
