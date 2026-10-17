import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { loadWorkflow, loadProfiles } from "@/lib/harness/standard";
import { loadSkills, isRegistered } from "@/lib/harness/skills";
export const SourceRef = z.object({ kind: z.enum(["fact", "metric", "constant"]), id: z.string().min(1) });
export const TemplateDefinition = z.object({
  id: z.enum(["fdf", "quebec"]), language: z.enum(["en", "fr"]), label: z.string(),
  disclosure: z.string(), numeric: z.array(z.object({ key: z.string(), label: z.string(), source: SourceRef })),
  narrative: z.array(z.object({ key: z.string(), label: z.string(), required: z.literal(true) }))
});
export type TemplateDefinition = z.infer<typeof TemplateDefinition>;
const Rule = z.object({ id: z.string(), label: z.string(), severity: z.enum(["block", "warn"]), message_en: z.string(), message_fr: z.string(), params: z.record(z.string(), z.unknown()).default({}) });
export function loadStandard() {
  const templates = readdirSync("standard/templates").filter(f => f.endsWith(".json")).sort().map(f => {
    const text = readFileSync(path.join("standard/templates", f), "utf8");
    return { ...TemplateDefinition.parse(JSON.parse(text)), version: createHash("sha256").update(text).digest("hex").slice(0, 12) };
  });
  const rules = z.array(Rule).parse(JSON.parse(readFileSync("standard/rules/checks.json", "utf8")));
  const skills = loadSkills().map(s => ({ ...s, registered: isRegistered(s) }));
  return { workflow: loadWorkflow(), profiles: loadProfiles().map(p => ({ ...p, templates: p.templates.filter(t => t !== "cedar_stone"), provider: "replay" as const, offline: true })), rules, skills, templates };
}
export function getTemplate(id: string) {
  const t = loadStandard().templates.find(t => t.id === id);
  if (!t)
    throw new Error("Unknown funder template");
  return t;
}
