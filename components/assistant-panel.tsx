"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, useCurrentRecordId, useLanguage } from "@/components/shell";
import type { Catalog } from "@/lib/demo/catalog";
import type { EvidenceAnswer } from "@/lib/demo/questions";
type Turn = { id: number; record_id: string; question: string; answer?: EvidenceAnswer; error?: string };
// Answers come from the evidence API (verified facts, checks, snapshots); in replay no model is called, so it never invents a value.
export function AssistantPanel({ reports, onClose }: { reports: Catalog; onClose: () => void }) {
  const { t, language } = useLanguage();
  const current = useCurrentRecordId();
  const [picked, setPicked] = useState("");
  const recordId = current ?? (picked || reports[0]?.record_id || "");
  const report = reports.find(r => r.record_id === recordId);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [turns]);
  const suggestions: [string, string][] = [["What is missing?", "Que manque-t-il ?"], ["Where does the functionality rate come from?", "D’où vient le taux de fonctionnement ?"], ["How many committee members were trained?", "Combien de membres de comités ont été formés ?"]];
  async function ask(text: string) {
    const q = text.trim();
    if (q.length < 2 || !recordId) return;
    const turn: Turn = { id: Date.now(), record_id: recordId, question: q };
    setTurns(ts => [...ts, turn]); setQuestion(""); setBusy(true);
    try { const answer = await api<EvidenceAnswer>("/api/reports/" + encodeURIComponent(recordId) + "/questions", { question: q, language }); setTurns(ts => ts.map(x => x.id === turn.id ? { ...x, answer } : x)); }
    catch (e) { setTurns(ts => ts.map(x => x.id === turn.id ? { ...x, error: e instanceof Error ? e.message : t("Lookup failed.", "Recherche impossible.") } : x)); }
    finally { setBusy(false); }
  }
  const thread = turns.filter(x => x.record_id === recordId);
  return <div className="assistant-panel">
    <div className="assistant-head"><div><h2>{t("Evidence assistant", "Assistant de données")}</h2><p>{t("Ask where a number comes from or what is missing. Every answer cites the report.", "Demandez d’où vient un chiffre ou ce qui manque. Chaque réponse cite le rapport.")}</p></div><button type="button" className="assistant-close" onClick={onClose} aria-label={t("Close the assistant", "Fermer l’assistant")}>✕</button></div>
    {current ? <p className="assistant-context">{t("About", "À propos de")} <strong>{report?.title ?? current}</strong></p> :
      <label className="assistant-context">{t("Report", "Rapport")}<select value={recordId} onChange={e => setPicked(e.target.value)}>{reports.map(r => <option key={r.record_id} value={r.record_id}>{r.title}</option>)}</select></label>}
    <div className="assistant-thread" aria-live="polite">
      {thread.length === 0 && <div className="assistant-empty"><p>{t("Try a question:", "Essayez une question :")}</p>{suggestions.map(([en, fr]) => <button type="button" key={en} className="assistant-chip" disabled={busy || !recordId} onClick={() => void ask(t(en, fr))}>{t(en, fr)}</button>)}</div>}
      {thread.map(x => <div key={x.id} className="assistant-turn"><p className="assistant-question">{x.question}</p>
        {x.error ? <p className="assistant-answer error-text">✕ {x.error}</p> : !x.answer ? <p className="assistant-answer muted">{t("Looking in the sources…", "Recherche dans les sources…")}</p> :
          <div className="assistant-answer"><p>{x.answer.answer}</p>{x.answer.citations.map(c => <blockquote key={c.id}><strong>{c.id}</strong> {c.quote}<small>{c.file} · {c.location}</small></blockquote>)}{x.answer.links.map(l => <Link key={l.href} href={l.href}>{l.label} ↗</Link>)}</div>}</div>)}
      <div ref={end} />
    </div>
    <form className="assistant-form" onSubmit={e => { e.preventDefault(); void ask(question); }}>
      <label className="sr-only" htmlFor="assistant-question">{t("Ask about this report", "Question sur ce rapport")}</label>
      <textarea id="assistant-question" rows={2} maxLength={500} value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(question); } }} placeholder={t("Ask about this report…", "Posez une question sur ce rapport…")} disabled={!recordId} />
      <button className="primary" disabled={busy || question.trim().length < 2 || !recordId}>{busy ? "…" : t("Ask", "Demander")}</button>
    </form>
    <p className="assistant-note">{t("Verified lookup over this report’s facts and checks. Replay mode: no live model call.", "Recherche vérifiée dans les faits et contrôles du rapport. Mode rejeu : aucun modèle appelé.")}</p>
  </div>;
}
