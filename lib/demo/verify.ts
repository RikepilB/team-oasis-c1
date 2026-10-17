export type NumberToken = {
  value: number;
  unit: "percent" | "count" | "currency";
};
export type Citable = {
  id: string;
  value: number | string;
  unit: string | null;
  valid: boolean;
};
type Result = {
  check: "green" | "red";
  check_reason: string | null;
  problems: string[];
};
const result = (problems: string[]): Result => ({ check: problems.length ? "red" : "green", check_reason: problems.join("; ") || null, problems });
const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
export function tokens(text: string): NumberToken[] {
  const masked = text.replace(/\byear[- ]\d+\b/gi, " ").replace(/\b(?:FY|AF)\s*\d{4}\s*[–-]\s*\d{2,4}\b/gi, " ")
    .replace(/\b[QT][1-4]\b/gi, " ")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
    .replace(/\b\d{1,2}\/(?:\d{1,2})\/\d{4}\b/g, " ");
  const out: NumberToken[] = [];
  const pattern = /([€$£])?\s*(-?\d+(?:[\u00a0\u202f ]\d{3})*(?:[.,]\d+)*)(\s*%)?/g;
  for (const m of masked.matchAll(pattern)) {
    let n = m[2].replace(/[\u00a0\u202f ]/g, "");
    if (/^[-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(n))
      n = n.replace(/,/g, "");
    else if (n.includes(",") && !n.includes("."))
      n = n.replace(",", ".");
    const value = Number(n);
    out.push({ value, unit: m[3] ? "percent" : m[1] ? "currency" : "count" });
  }
  return out;
}
const same = (a: NumberToken, b: NumberToken) => Number.isFinite(a.value) && Number.isFinite(b.value) && Math.abs(a.value - b.value) < 1e-9 && a.unit === b.unit;
const unit = (s: string | null): NumberToken["unit"] => s === "%" ? "percent" : s && /CAD|USD|dollar|\$/i.test(s) ? "currency" : "count";
export function checkFact(f: {
  value: number | string;
  unit: string | null;
  quote: string;
}, original: string): Result {
  const problems: string[] = [];
  if (!f.quote.trim() || !normalize(original).includes(normalize(f.quote)))
    problems.push("Quote is not present in the original.");
  if (typeof f.value === "number") {
    if (!tokens(f.quote).some(t => same(t, { value: f.value as number, unit: unit(f.unit) })))
      problems.push("Value or unit does not match the quote.");
  }
  else if (!f.value.trim() || !normalize(f.quote).toLowerCase().includes(normalize(f.value).toLowerCase()))
    problems.push("Value is absent from the quote.");
  return result(problems);
}
export function checkFrench(en: string, fr: string): Result {
  const remaining = tokens(fr);
  const problems: string[] = [];
  for (const t of tokens(en)) {
    const i = remaining.findIndex(x => same(t, x));
    if (i < 0)
      problems.push("A source number or unit changed.");
    else
      remaining.splice(i, 1);
  }
  if (remaining.length)
    problems.push("French includes additional or malformed numbers.");
  if (!fr.trim())
    problems.push("French text is required.");
  return result(problems);
}
export function checkNarrative(text: string, cites: string[], sources: Citable[]): Result {
  const problems: string[] = [];
  if (!text.trim())
    problems.push("Required text is empty.");
  if (new Set(cites).size !== cites.length)
    problems.push("Duplicate citations.");
  const resolved = cites.map(id => sources.find(s => s.id === id));
  if (resolved.some(s => !s || !s.valid))
    problems.push("Citation is missing or unverified.");
  for (const t of tokens(text)) {
    if (!resolved.some(s => s && s.valid && typeof s.value === "number" && same(t, { value: s.value, unit: unit(s.unit) })))
      problems.push("A number or unit is not supported by its citations.");
  }
  return result([...new Set(problems)]);
}
export function checkNumericField(value: string, source: Citable | undefined): Result {
  const ts = tokens(value);
  return result(source && source.valid && typeof source.value === "number" && ts.length === 1 && same(ts[0], { value: source.value, unit: unit(source.unit) }) ? [] : ["Numeric field does not equal its verified source."]);
}
