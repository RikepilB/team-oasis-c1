"use client";
import { useAssistant, useLanguage } from "@/components/shell";
import type { DemoRecord, FrenchItem } from "@/lib/demo/types";

// The Assistant's review panel lives in french-review-panel.tsx, so it loads only with the Assistant.
export const markId = (id: string) => "fr-item-" + id;

function marked(text: string, items: FrenchItem[]) {
  const out: React.ReactNode[] = [];
  let at = 0;
  for (const i of [...items].sort((a, b) => a.position - b.position)) {
    if (i.position < at || text.slice(i.position, i.position + i.word.length) !== i.word) continue;
    out.push(text.slice(at, i.position));
    out.push(<mark key={i.id} id={markId(i.id)} data-state={i.decision?.decision ?? "open"} title={i.decision?.decision === "declined" ? "← " + i.decision.before : i.reason}>{i.word}</mark>);
    at = i.position + i.word.length;
  }
  out.push(text.slice(at));
  return out;
}

// The two reports as pages, side by side. Flagged French spans are highlighted and update as decisions land.
export function FrenchDocuments({ record }: { record: DemoRecord }) {
  const { t } = useLanguage();
  const assistant = useAssistant();
  const fr = record.french!;
  const open = fr.items.filter(i => !i.decision).length;
  return <div className="french-docs">
    <div className="french-docs-bar">
      <span className={"doc-chip " + (fr.check === "green" ? "ok" : "block")}>{fr.check === "green" ? "✓" : "✕"} {t("Numbers preserved", "Chiffres conservés")}</span>
      <span className={"doc-chip " + (open ? "open" : "ok")}>{fr.items.length - open} / {fr.items.length} {t("flagged items decided", "éléments signalés décidés")}</span>
      {!assistant.open && open > 0 && <button type="button" className="secondary" onClick={() => assistant.setOpen(true)}>{t("Open review", "Ouvrir la révision")} →</button>}
      <span className="doc-legend" role="note"><span className="doc-legend-label">{t("Highlighted words:", "Mots surlignés :")}</span><mark data-state="open">{t("Needs a decision", "À décider")}</mark><mark data-state="approved">✓ {t("Approved", "Approuvé")}</mark><mark data-state="declined">✎ {t("Changed by reviewer", "Modifié par la révision")}</mark></span>
    </div>
    <div className="doc-pages">
      <article className="doc-page" lang="en"><header><span>{t("Original · English", "Original · anglais")}</span><small>{record.source_file}</small></header><h4>{record.period}</h4><p>{record.original_text}</p></article>
      <article className="doc-page" lang="fr"><header><span>{t("Draft · French", "Brouillon · français")}</span><small>{t("Recorded draft_french response", "Réponse enregistrée draft_french")}</small></header><h4>{record.period}</h4><p>{marked(fr.text, fr.items)}</p></article>
    </div>
    {fr.problems.map(p => <p className="error-text" key={p}>{p}</p>)}
  </div>;
}
