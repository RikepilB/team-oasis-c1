// The personal-data guard (rule `personal_data_guard`): runs on every input before any provider
// sees it. Patterns are kept as source strings in one constant so they can move into
// standard/rules/checks.json unchanged; flags are applied here, one fresh RegExp per scan, so no
// `lastIndex` state is shared between calls.
export const PERSONAL_DATA_PATTERNS = [
  { id: "email", pattern: String.raw`[\w.+-]+@[\w-]+(?:\.[\w-]+)+` },
  // North American phone numbers, including parentheses and compact forms. Figures like "1,900" and dates like 2026-07-29 do not fit 3-3-4.
  { id: "phone", pattern: String.raw`(?<!\w)(?:\+?1[\s.-]*)?(?:\(\d{3}\)|\d{3})[\s.-]*\d{3}[\s.-]*\d{4}(?!\w)` },
  { id: "supporter_id", pattern: String.raw`\bS-\d{6}\b` },
] as const;

export type GuardResult = { ok: true } | { ok: false; matches: string[] };

// `matches` holds each matched text once, grouped by pattern in the order above.
export function guardPersonalData(text: string): GuardResult {
  const matches: string[] = [];
  for (const { pattern } of PERSONAL_DATA_PATTERNS) {
    for (const m of text.matchAll(new RegExp(pattern, "g"))) {
      if (!matches.includes(m[0])) matches.push(m[0]);
    }
  }
  return matches.length === 0 ? { ok: true } : { ok: false, matches };
}
