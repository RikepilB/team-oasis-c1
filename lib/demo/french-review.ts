import type { UncertainWord } from "@/lib/types";
import { DemoError, type FrenchItem } from "@/lib/demo/types";

// Quick picks: curly-quoted phrases in the model's reason, after the first (the English it translated).
export function alternatives(reason: string) {
  return [...reason.matchAll(/“([^”]+)”/g)].map(m => m[1]).slice(1);
}

// An unqualified "functional" hides whether partly working points count; the French must not pick a side.
const AMBIGUOUS_EN = /\b(?<!fully |partly |partially )functional\b/i;
const FUNCTIONAL_FR = /(?<!entièrement |partiellement )\bfonctionnel(?:le)?s?\b/i;

// The article in front of a flagged word is part of the span, so a fix can elide it ("de captage" → "d’aménagement").
const ARTICLE = /(?:^|[\s(])((?:[Dd]es|[Dd]u|[Ll]es|[Dd]e|[Ll]a|[Ll]e) |[DdLl]’)$/;
const elide = (lead: string, word: string) => /^(?:[Dd]e|[Ll]a|[Ll]e) $/.test(lead) && /^[aeiouhâàéèêîôû]/i.test(word) ? lead[0] + "’" + word : lead + word;

export function buildFrenchItems(en: string, fr: string, unsure: UncertainWord[]): FrenchItem[] {
  // Only spans that really sit at their stated offset; a wrong offset is dropped, never guessed.
  const items: FrenchItem[] = unsure
    .filter(u => u.word && fr.slice(u.position, u.position + u.word.length) === u.word)
    .map((u, i) => {
      const lead = ARTICLE.exec(fr.slice(Math.max(0, u.position - 6), u.position))?.[1] ?? "";
      return { id: "FR-" + String(i + 1).padStart(2, "0"), origin: "AI", word: lead + u.word, position: u.position - lead.length, reason: u.reason, alternatives: alternatives(u.reason).map(a => elide(lead, a)), decision: null };
    });
  const term = AMBIGUOUS_EN.test(en) ? FUNCTIONAL_FR.exec(fr) : null;
  if (term)
    items.push({ id: "FR-R1", origin: "Rule", word: term[0], position: term.index, reason: "The English says “functional” without saying whether partly working points count. Keep the same open meaning in French, or add the definition the programme confirms.", alternatives: [], decision: null });
  return items.sort((a, b) => a.position - b.position);
}

export type Decision = { id: string; decision: "approve" | "decline"; actor: string; at: string; note?: string; replacement?: string };

// Applies one decision. A decline must say why and give the fix, so every decline changes the text at once.
export function decideFrenchItem(text: string, items: FrenchItem[], d: Decision): { text: string; items: FrenchItem[] } {
  const item = items.find(i => i.id === d.id);
  if (!item)
    throw new DemoError("item_not_found", "That French review item does not exist.", 404);
  if (item.decision)
    throw new DemoError("already_decided", "This French item was already decided by " + item.decision.actor + ".");
  if (d.decision === "approve")
    return { text, items: items.map(i => i === item ? { ...i, decision: { decision: "approved", actor: d.actor, at: d.at, note: d.note?.trim() || "", before: i.word, after: i.word } } : i) };
  const note = d.note?.trim() || "";
  const replacement = d.replacement?.trim() || "";
  if (!note || !replacement)
    throw new DemoError("decline_incomplete", "Say what is wrong and type the corrected French before declining.");
  if (text.slice(item.position, item.position + item.word.length) !== item.word)
    throw new DemoError("span_moved", "The flagged words are no longer at their place in the French text. Recreate the French draft.", 409);
  const delta = replacement.length - item.word.length;
  const next = text.slice(0, item.position) + replacement + text.slice(item.position + item.word.length);
  return {
    text: next,
    items: items.map(i => i === item
      ? { ...i, word: replacement, decision: { decision: "declined", actor: d.actor, at: d.at, note, before: item.word, after: replacement } }
      : i.position > item.position ? { ...i, position: i.position + delta } : i),
  };
}
