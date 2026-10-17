// Template kit: presets, the number sources a template may use, and the checks a template file must pass.
// Plain ESM so the browser builder and the CLI (scripts/template.mjs) share one set of rules.

/** Number sources a template may map to. Numbers are always filled by code from these, never by the AI. */
export const SOURCES = [
  { kind: "metric", id: "pct_full", en: "Fully working (%)", fr: "Entièrement fonctionnels (%)", group: "Water-point data" },
  { kind: "metric", id: "pct_incl_partly", en: "Including partly working (%)", fr: "Partiellement fonctionnels inclus (%)", group: "Water-point data" },
  { kind: "metric", id: "count_total", en: "Registered water points", fr: "Points d’eau enregistrés", group: "Water-point data" },
  { kind: "metric", id: "count_full", en: "Fully working points", fr: "Points entièrement fonctionnels", group: "Water-point data" },
  { kind: "metric", id: "count_partly", en: "Partly working points", fr: "Points partiellement fonctionnels", group: "Water-point data" },
  { kind: "metric", id: "count_not", en: "Points not working", fr: "Points non fonctionnels", group: "Water-point data" },
  { kind: "constant", id: "baseline_pct", en: "Historical baseline (%)", fr: "Référence historique (%)", group: "Programme targets" },
  { kind: "constant", id: "milestone_pct", en: "Year-three milestone (%)", fr: "Jalon de la troisième année (%)", group: "Programme targets" },
  { kind: "constant", id: "target_pct", en: "Year-five target (%)", fr: "Cible de la cinquième année (%)", group: "Programme targets" },
];

const n = (key, id, label) => ({ key, label, source: { kind: SOURCES.find(s => s.id === id).kind, id } });
const t = (key, label, guidance) => ({ key, label, required: true, guidance });
/** Starter templates. The two "standard" ones mirror the approved FDF and Québec templates in standard/templates. */
export const PRESETS = [
  { id: "fdf-quarterly", standard: "fdf", label: "FDF · quarterly report", language: "en", audience: "FDF", description: "The approved FDF format: targets, both functionality definitions and two cited narrative sections.",
    numeric: [n("baseline_pct", "baseline_pct", "Historical baseline · definition unspecified"), n("milestone_pct", "milestone_pct", "Year-three milestone"), n("target_pct", "target_pct", "Year-five target"), n("pct_full", "pct_full", "Fully working"), n("pct_incl_partly", "pct_incl_partly", "Including partly working"), n("count_total", "count_total", "Registered water points")],
    narrative: [t("progress", "Progress", "What changed this period, with the facts that show it."), t("definition_note", "Definition and limitations", "Say which functionality definition each number uses.")] },
  { id: "quebec-trimestriel", standard: "quebec", label: "Fondation du Québec · rapport trimestriel", language: "fr", audience: "Fondation du Québec", description: "Le format approuvé en français : mêmes chiffres, texte révisé par une personne bilingue.",
    numeric: [n("baseline_pct", "baseline_pct", "Référence historique · définition non précisée"), n("milestone_pct", "milestone_pct", "Jalon de la troisième année"), n("target_pct", "target_pct", "Cible de la cinquième année"), n("pct_full", "pct_full", "Entièrement fonctionnels"), n("pct_incl_partly", "pct_incl_partly", "Partiellement fonctionnels inclus"), n("count_total", "count_total", "Points d’eau enregistrés")],
    narrative: [t("progress", "Progrès", "Ce qui a changé pendant la période, avec les faits à l’appui."), t("definition_note", "Définition et limites", "Précisez la définition utilisée pour chaque chiffre.")] },
  { id: "donor-update", label: "Donor update · one page", language: "en", audience: "Individual donors", description: "A short, plain-language update: one headline number, one story, one ask.",
    numeric: [n("pct_incl_partly", "pct_incl_partly", "Water points working"), n("count_total", "count_total", "Water points we track")],
    narrative: [t("headline", "Headline", "One sentence a donor remembers."), t("story", "What your support did", "A concrete change, cited to the report."), t("next", "What comes next", "The next milestone, no new numbers.")] },
  { id: "board-summary", label: "Board summary", language: "en", audience: "Board of directors", description: "Progress against targets, risks and the decisions the board is asked to make.",
    numeric: [n("pct_full", "pct_full", "Fully working"), n("milestone_pct", "milestone_pct", "Year-three milestone"), n("target_pct", "target_pct", "Year-five target"), n("count_not", "count_not", "Points not working")],
    narrative: [t("status", "Status against targets", "Ahead, on track or behind, and why."), t("risks", "Risks", "What could stop progress, with evidence."), t("decisions", "Decisions requested", "What the board must decide.")] },
  { id: "government-grant", label: "Government grant · results report", language: "en", audience: "Public funder", description: "Results-based format with every indicator, both definitions and a data-quality note.",
    numeric: [n("count_total", "count_total", "Registered water points"), n("count_full", "count_full", "Fully working points"), n("count_partly", "count_partly", "Partly working points"), n("count_not", "count_not", "Points not working"), n("pct_full", "pct_full", "Fully working (%)"), n("pct_incl_partly", "pct_incl_partly", "Including partly working (%)")],
    narrative: [t("results", "Results this period", "Indicator by indicator, cited."), t("data_quality", "Data quality and limitations", "Coverage, cleaning changes and definitions.")] },
];

export const slug = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);

/** Checks a template object (builder draft or file). Returns a list of problems; empty means it can go to review. */
export function checkTemplate(tpl) {
  const problems = [];
  if (!tpl || typeof tpl !== "object") return ["The template is not an object."];
  if (!/^[a-z][a-z0-9_-]{1,39}$/.test(tpl.id ?? "")) problems.push("id: use 2–40 lowercase letters, digits, - or _.");
  if (!["en", "fr"].includes(tpl.language)) problems.push("language: must be en or fr.");
  if (!String(tpl.label ?? "").trim()) problems.push("label: give the template a name.");
  if (!/\{approver\}/.test(tpl.disclosure ?? "") || !/\{date\}/.test(tpl.disclosure ?? "")) problems.push("disclosure: must include {approver} and {date}, so every export names the person who approved it.");
  const numeric = Array.isArray(tpl.numeric) ? tpl.numeric : [];
  const narrative = Array.isArray(tpl.narrative) ? tpl.narrative : [];
  if (!numeric.length && !narrative.length) problems.push("Add at least one number or one narrative section.");
  const keys = new Set();
  for (const [i, f] of numeric.entries()) {
    if (!f.key || !/^[a-z][a-z0-9_]*$/.test(f.key)) problems.push(`numeric[${i}].key: lowercase letters, digits and _ only.`);
    if (!String(f.label ?? "").trim()) problems.push(`numeric[${i}].label: missing.`);
    if (!f.source || !SOURCES.some(s => s.kind === f.source.kind && s.id === f.source.id)) problems.push(`numeric[${i}].source: "${f.source?.kind}:${f.source?.id}" is not a known source. Numbers must come from code.`);
    if (keys.has(f.key)) problems.push(`Duplicate field key "${f.key}".`); keys.add(f.key);
  }
  for (const [i, f] of narrative.entries()) {
    if (!f.key || !/^[a-z][a-z0-9_]*$/.test(f.key)) problems.push(`narrative[${i}].key: lowercase letters, digits and _ only.`);
    if (!String(f.label ?? "").trim()) problems.push(`narrative[${i}].label: missing.`);
    if (f.required !== true) problems.push(`narrative[${i}].required: must be true; every section is cited and checked.`);
    if (keys.has(f.key)) problems.push(`Duplicate field key "${f.key}".`); keys.add(f.key);
  }
  return problems;
}

/** The file a reviewer adds to standard/templates once approved (same shape as fdf.json and quebec.json). */
export function toStandardFile(draft) {
  const disclosure = draft.language === "fr"
    ? "Rédaction assistée par des réponses enregistrées. Révisé et approuvé par {approver} le {date}. Données fictives."
    : "Drafting assisted by replay of recorded responses. Reviewed and approved by {approver} on {date}. Fictional data.";
  return {
    id: draft.id, language: draft.language, label: draft.label, disclosure: draft.disclosure || disclosure,
    numeric: draft.numeric.map(({ key, label, source }) => ({ key, label, source })),
    narrative: draft.narrative.map(({ key, label }) => ({ key, label, required: true })),
  };
}
