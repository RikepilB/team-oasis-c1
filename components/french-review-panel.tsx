"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage, Loading, Message } from "@/components/shell";
import { markId } from "@/components/french-review";
import { runRecordAction, useLiveRecord } from "@/components/live-record";
import { SwitchNotice, usePerson } from "@/components/person-switcher";
import { canDo } from "@/lib/demo/people";
import { GuardedButton } from "@/components/ui";
import type { FrenchItem } from "@/lib/demo/types";

// Scrolls the French page to a flagged span and flashes it; false when that page is not on screen.
function showItem(id: string) {
  const el = document.getElementById(markId(id));
  if (!el) return false;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.classList.add("is-focus");
  setTimeout(() => el.classList.remove("is-focus"), 1600);
  return true;
}

// Editor-style review in the assistant: progress, then one card per flagged span with Approve or Decline.
export function FrenchReviewPanel({ id }: { id: string }) {
  const { t } = useLanguage();
  const person = usePerson();
  const router = useRouter();
  const { record, loading, error } = useLiveRecord(id);
  const [declining, setDeclining] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [failure, setFailure] = useState("");
  if (loading && !record) return <Loading />;
  if (!record) return <Message error={error} />;
  const frenchHref = "/runs/" + encodeURIComponent(id) + "?tab=french&funder=quebec";
  const fr = record.french;
  if (!fr) return <div className="review-panel"><div className="review-empty"><p>{t("There is no French draft yet. The preparer creates it on the French tab.", "Aucun brouillon français pour l’instant. Le préparateur le crée sur l’onglet Français.")}</p><button type="button" className="secondary" onClick={() => router.push(frenchHref)}>{t("Go to the French version", "Aller à la version française")} →</button></div></div>;
  const pending = fr.items.filter(i => !i.decision);
  const decided = fr.items.filter(i => i.decision);
  const can = canDo(person.role, "review");
  const quebec = record.templates.quebec;
  async function decide(item: FrenchItem, decision: "approve" | "decline", note?: string, value?: string) {
    setBusy(item.id); setFailure("");
    try {
      await runRecordAction(id, "french_item", { actor: person.name, key: item.id, decision, ...(note ? { note } : {}), ...(value ? { value } : {}) });
      setDeclining(null);
    } catch (e) { setFailure(e instanceof Error ? e.message : t("Request failed", "Échec de la requête")); }
    finally { setBusy(""); }
  }
  const locate = (item: FrenchItem) => { if (!showItem(item.id)) router.push(frenchHref); };
  return <div className="review-panel">
    <section className="review-score" aria-label={t("Review progress", "Progression de la révision")}>
      <div className="review-score-top"><span>{t("Flagged items decided", "Éléments signalés décidés")}</span><strong>{decided.length}<small> / {fr.items.length}</small></strong></div>
      <div className="review-bar" aria-hidden="true"><span style={{ width: (fr.items.length ? decided.length / fr.items.length * 100 : 100) + "%" }} /></div>
      <p>{fr.items.length === 0 ? t("Nothing flagged. A bilingual person still reads the final version.", "Rien de signalé. Une personne bilingue lit quand même la version finale.") : pending.length ? pending.length + " " + t("still need a bilingual decision.", "attendent une décision bilingue.") : t("Every flagged item is decided.", "Chaque élément signalé est décidé.")}</p>
    </section>
    <ul className="review-counts">
      <li><span>{t("Numbers preserved", "Chiffres conservés")}</span><b data-ok={fr.check === "green"}>{fr.check === "green" ? "✓" : "✕"}</b></li>
      <li><span>{t("AI not sure", "IA incertaine")}</span><b>{fr.items.filter(i => i.origin === "AI").length}</b></li>
      <li><span>{t("Meaning rules", "Règles de sens")}</span><b>{fr.items.filter(i => i.origin === "Rule").length}</b></li>
      <li><span>{t("Final French version", "Version française finale")}</span><b data-ok={!!quebec && quebec.review?.revision === quebec.revision}>{!quebec ? "—" : quebec.review?.revision === quebec.revision ? "✓ " + t("reviewed", "révisée") : t("pending", "en attente")}</b></li>
    </ul>
    {!can && pending.length > 0 && <SwitchNotice action="review" />}
    {failure && <p role="alert" className="message error">✕ {failure}</p>}
    {pending.length > 0 && <h3 className="review-group">{t("Needs a decision", "À décider")}</h3>}
    {pending.map(item => <ReviewCard key={item.id} item={item} can={can} busy={busy === item.id} declining={declining === item.id} onLocate={() => locate(item)} onDeclining={v => setDeclining(v ? item.id : null)} onDecide={(d, note, value) => decide(item, d, note, value)} />)}
    {decided.length > 0 && <h3 className="review-group">{t("Decided", "Décidés")}</h3>}
    {decided.map(item => <article key={item.id} className="review-card is-decided" data-state={item.decision!.decision}>
      <div className="review-card-head"><span className={"origin-chip " + item.origin}>{item.origin === "AI" ? t("AI not sure", "IA incertaine") : t("Meaning rule", "Règle de sens")}</span><button type="button" className="link-button" onClick={() => locate(item)}>{t("Show", "Voir")}</button></div>
      {item.decision!.decision === "declined"
        ? <p className="review-change" lang="fr"><del>{item.decision!.before}</del> → <strong>{item.decision!.after}</strong></p>
        : <p className="review-change" lang="fr"><strong>{item.word}</strong></p>}
      <p className="review-who">{item.decision!.decision === "declined" ? "✎ " + t("Declined and fixed by", "Refusé et corrigé par") : "✓ " + t("Approved by", "Approuvé par")} {item.decision!.actor}{item.decision!.note && <> · “{item.decision!.note}”</>}</p>
    </article>)}
    <p className="review-note">{t("A fix changes the translated programme report on the French page. It does not change the Fondation du Québec funder fields.", "Une correction modifie le rapport de programme traduit. Elle ne modifie pas les champs du rapport à la Fondation du Québec.")}</p>
  </div>;
}

function ReviewCard({ item, can, busy, declining, onLocate, onDeclining, onDecide }: { item: FrenchItem; can: boolean; busy: boolean; declining: boolean; onLocate: () => void; onDeclining: (v: boolean) => void; onDecide: (d: "approve" | "decline", note?: string, value?: string) => void }) {
  const { t } = useLanguage();
  const [note, setNote] = useState("");
  const [value, setValue] = useState(item.alternatives[0] ?? item.word);
  return <article className="review-card" data-state="open">
    <div className="review-card-head"><span className={"origin-chip " + item.origin}>{item.origin === "AI" ? t("AI not sure", "IA incertaine") : t("Meaning rule", "Règle de sens")}</span><code>{item.id}</code></div>
    <button type="button" className="review-span" lang="fr" onClick={onLocate} title={t("Show it in the French draft", "Voir dans le brouillon français")}>« {item.word} »</button>
    <p className="review-reason">{item.reason}</p>
    {declining ? <form className="review-decline" onSubmit={e => { e.preventDefault(); onDecide("decline", note, value); }}>
      <label>{t("What is wrong?", "Qu’est-ce qui ne va pas ?")}<textarea rows={2} maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder={t("e.g. The funder’s wording is “aménagement”.", "p. ex. Le bailleur emploie « aménagement ».")} autoFocus /></label>
      <label>{t("Corrected French", "Français corrigé")}<input lang="fr" value={value} maxLength={200} onChange={e => setValue(e.target.value)} /></label>
      {item.alternatives.length > 0 && <div className="alt-chips" aria-label={t("Suggestions", "Suggestions")}>{item.alternatives.map(a => <button type="button" key={a} lang="fr" aria-pressed={value === a} onClick={() => setValue(a)}>{a}</button>)}</div>}
      <div className="review-actions"><button type="button" className="secondary" onClick={() => onDeclining(false)}>{t("Cancel", "Annuler")}</button><GuardedButton type="submit" className="primary" busy={busy} reason={!note.trim() ? t("Say why you’re declining first.", "Indiquez d’abord pourquoi vous refusez.") : !value.trim() ? t("Enter the corrected French first.", "Saisissez d’abord le français corrigé.") : null}>{busy ? "…" : t("Decline and apply fix", "Refuser et corriger")}</GuardedButton></div>
    </form> : <div className="review-actions">
      <GuardedButton className="primary review-approve" busy={busy} reason={!can ? t("Only the bilingual reviewer can decide. Switch to the Bilingual Content Coordinator under “Acting as”.", "Seul le réviseur bilingue peut décider. Choisissez la coordonnatrice bilingue sous « Agir en tant que ».") : null} onClick={() => onDecide("approve")}>{busy ? "…" : "✓ " + t("Approve", "Approuver")}</GuardedButton>
      <GuardedButton className="secondary review-decline-btn" busy={busy} reason={!can ? t("Only the bilingual reviewer can decide. Switch to the Bilingual Content Coordinator under “Acting as”.", "Seul le réviseur bilingue peut décider. Choisissez la coordonnatrice bilingue sous « Agir en tant que ».") : null} onClick={() => onDeclining(true)}>✕ {t("Decline", "Refuser")}</GuardedButton>
    </div>}
  </article>;
}
