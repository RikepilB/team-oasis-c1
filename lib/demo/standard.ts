import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { loadWorkflow, loadProfiles } from "@/lib/harness/standard";
import { loadSkills, isRegistered, parseSkillFile } from "@/lib/harness/skills";
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
// The exact SKILL.md of a registered skill, for download. Found by matching names across the folder,
// never by building a path from the request, so "../" or an unknown name simply finds nothing.
export function skillMarkdown(name: string, dir = path.join("standard", "skills")): string | null {
  if (!existsSync(/* turbopackIgnore: true */ dir)) return null;
  for (const e of readdirSync(/* turbopackIgnore: true */ dir, { withFileTypes: true })) {
    const file = path.join(dir, e.name, "SKILL.md");
    if (!e.isDirectory() || !existsSync(/* turbopackIgnore: true */ file)) continue;
    const text = readFileSync(/* turbopackIgnore: true */ file, "utf8");
    const front = parseSkillFile(text).front;
    if ((typeof front.name === "string" && front.name ? front.name : e.name) === name) return text;
  }
  return null;
}
export function getTemplate(id: string) {
  const t = loadStandard().templates.find(t => t.id === id);
  if (!t)
    throw new Error("Unknown funder template");
  return t;
}
