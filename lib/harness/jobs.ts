import { z } from "zod";
import { runStep } from "@/lib/harness/run";
import type { StepOpts, StepResult } from "@/lib/harness/run";
import { UncertainWord } from "@/lib/types";
import type { FactRecord, FunderId } from "@/lib/types";

// The three AI jobs. Each is a thin call to runStep with its output schema; the instruction lives in
// standard/skills/<job>/SKILL.md. The AI writes words and points at ids; every number comes from code.

export const ExtractSchema = z.object({
  facts: z.array(
    z.object({
      label: z.string(),
      value: z.union([z.number(), z.string()]), // a number, or the word when the report spells it ("four")
      unit: z.string().nullable(),
      period: z.string().nullable(),
      quote: z.string(), // verbatim from the report
    }),
  ),
});
export type ExtractOut = z.infer<typeof ExtractSchema>;

export const FrenchSchema = z.object({
  text: z.string(),
  uncertain_words: z.array(UncertainWord), // position = character offset of `word` in `text`
});
export type FrenchOut = z.infer<typeof FrenchSchema>;

export const FillSchema = z.object({
  fields: z.array(z.object({ key: z.string(), value: z.string(), cites: z.array(z.string()) })),
});
export type FillOut = z.infer<typeof FillSchema>;

// What a caller may pass through to runStep. The record id and the key come from the Fact Record.
type JobOpts<T> = Omit<StepOpts<T>, "record_id">;

export function extractFacts(r: FactRecord, opts: JobOpts<ExtractOut> = {}): Promise<StepResult<ExtractOut>> {
  return runStep("extract_facts", r.record_id, r.original_text, ExtractSchema, { ...opts, record_id: r.record_id });
}

// The English source is the report text, so a number check can compare the French against the very
// text the model was given.
export function draftFrench(r: FactRecord, opts: JobOpts<FrenchOut> = {}): Promise<StepResult<FrenchOut>> {
  return runStep("draft_french", r.record_id, r.original_text, FrenchSchema, { ...opts, record_id: r.record_id });
}

// A funder template's language. Task 6 reads templates from standard/templates/; until then the
// prompt needs only this to say which language to write in.
const FUNDER_LANGUAGE: Record<FunderId, "English" | "French"> = {
  fdf: "English",
  quebec: "French",
  cedar_stone: "English",
};

function fillInput(r: FactRecord, funder_id: FunderId, fields: { key: string; label: string }[]): string {
  const facts = r.facts.map(
    (f) => `- ${f.fact_id} | ${f.label} | ${f.value}${f.unit ? ` ${f.unit}` : ""} | ${f.period ?? "no period"} | "${f.quote}"`,
  );
  const metrics = r.metrics.map((m) => `- ${m.metric_id} | ${m.value} | cutoff ${m.cutoff}`);
  return [
    `Funder: ${funder_id}`,
    `Write in: ${FUNDER_LANGUAGE[funder_id]}`,
    "",
    "Fields to write (key: label):",
    ...fields.map((f) => `- ${f.key}: ${f.label}`),
    "",
    "Facts (cite by fact_id):",
    ...(facts.length ? facts : ["(none)"]),
    "",
    "Metrics computed by code (cite by metric_id):",
    ...(metrics.length ? metrics : ["(none)"]),
  ].join("\n");
}

export function fillNarrative(
  r: FactRecord,
  funder_id: FunderId,
  fields: { key: string; label: string }[],
  opts: JobOpts<FillOut> = {},
): Promise<StepResult<FillOut>> {
  return runStep("fill_template", `${r.record_id}-${funder_id}`, fillInput(r, funder_id, fields), FillSchema, {
    ...opts,
    record_id: r.record_id,
  });
}
