"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useLanguage } from "@/components/shell";
// First-visit walkthrough. It highlights one part of the page per step; "Guide" in the top bar replays it.
const SEEN = "synapse.guideSeen";
const listeners = new Set<() => void>();
const seen = () => { try { return localStorage.getItem(SEEN) === "1"; } catch { return true; } };
const markSeen = () => { try { localStorage.setItem(SEEN, "1"); } catch { /* private window */ } listeners.forEach(l => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const STEPS: { target: string | null; en: [string, string]; fr: [string, string] }[] = [
  { target: null, en: ["Welcome to Synapse", "Synapse turns a programme report into a checked funder report, in English and French. The AI drafts; a person approves."], fr: ["Bienvenue dans Synapse", "Synapse transforme un rapport de programme en rapport vérifié, en anglais et en français. L’IA rédige; une personne approuve."] },
  { target: "#synapse-sidebar", en: ["Everything in one place", "Your work is at the top of the left menu. Library holds the sources and rules. Recent reports opens your latest reports."], fr: ["Tout au même endroit", "Votre travail est en haut du menu de gauche. La bibliothèque contient les sources et les règles. Rapports récents ouvre vos derniers rapports."] },
  { target: ".synapse-search", en: ["Search anything", "Find any report or page. Press / from anywhere."], fr: ["Tout rechercher", "Trouvez un rapport ou une page. Appuyez sur / n’importe où."] },
  { target: ".inbox-views", en: ["Saved views", "My reports shows the ones you own. Needs action shows what is waiting for someone. Each report shows when it is due."], fr: ["Vues enregistrées", "Mes rapports montre ceux qui vous appartiennent. Action requise montre ce qui attend quelqu’un. Chaque rapport indique son échéance."] },
  { target: ".assistant-toggle", en: ["The Assistant", "Ask where a number comes from, and review the French. Every answer quotes the report."], fr: ["L’Assistant", "Demandez d’où vient un chiffre et révisez le français. Chaque réponse cite le rapport."] },
  { target: ".person-menu", en: ["Switch person", "Pick who you are acting as. Daniel prepares, the bilingual coordinator checks the French, the director approves. Greyed-out buttons tell you who can do the step."], fr: ["Changer de personne", "Choisissez la personne. Daniel prépare, la coordination bilingue vérifie le français, la direction approuve. Les boutons grisés indiquent qui peut faire l’étape."] },
  { target: null, en: ["Open a report", "The tabs go from the Original to French and Approvals. The bar at the bottom approves, then exports a PDF or Word file."], fr: ["Ouvrez un rapport", "Les onglets vont de l’original au français et aux approbations. La barre du bas approuve, puis exporte un fichier PDF ou Word."] },
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
