// Skill kit: what a new skill draft must pass and the SKILL.md it becomes. No node: imports, so the
// browser wizard, the register and the tests share one serializer. The file it writes is read back by
// parseSkillFile in lib/harness/skills.ts, so every value is written in the small YAML subset that
// parser understands: strings quoted (a # or digits stay text), list items quoted, no commas inside.
import { guardPersonalData } from "@/lib/harness/guard";

export type SkillKind = "ai" | "code";
export type SkillDraft = {
  name: string;
  kind: SkillKind;
  owner: string;
  approver: string;
  data_classes: string[];
  tier: 1 | 2 | 3 | null;
  workflow: string[]; // workload inventory ids from the pack (1.2), such as I2 or M1
  output: string; // Zod schema name in lib/harness/jobs.ts; a developer adds new ones
  checks: string[]; // rule ids from standard/rules/checks.json
  instruction: string;
  from?: string;
  updated_at?: string;
};
// Each problem names the wizard step that fixes it, in both languages.
export type Problem = { step: WizardStep; en: string; fr: string };
export type WizardStep = "basics" | "governance" | "runs" | "instruction";

export const DATA_CLASS_SUGGESTIONS = ["Confidential", "Internal", "Public"];
export const OUTPUT_SCHEMAS: { id: string; en: string; fr: string }[] = [
  { id: "ExtractSchema", en: "Facts with verbatim quotes", fr: "Faits avec citations exactes" },
  { id: "FrenchSchema", en: "French text with flagged words", fr: "Texte français avec mots signalés" },
  { id: "FillSchema", en: "Template narrative sections", fr: "Sections narratives du gabarit" },
];

export const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);

export const SCAFFOLD: Record<SkillKind, string> = {
  ai: [
    "You … (one sentence: what this skill does and for whom).",
    "",
    "Input: …",
    "",
    "Output: JSON with …",
    "",
    "Rules:",
    "- Do not compute or change any number. Numbers come from code.",
    "- Copy quotes verbatim from the report.",
    "- Leave out names and contact details of people.",
  ].join("\n"),
  code: [
    "Documents the rule in `lib/…`. Nothing here is sent to a model.",
    "",
    "What the code decides, step by step:",
    "1. …",
  ].join("\n"),
};

export const blankDraft = (kind: SkillKind = "ai"): SkillDraft => ({
  name: "", kind, owner: "", approver: "", data_classes: ["Confidential"], tier: null, workflow: [], output: "", checks: kind === "ai" ? ["personal_data_guard"] : [], instruction: SCAFFOLD[kind],
});

// A registered skill (as /api/standard returns it) turned into a draft to adjust under a new name.
export function draftFrom(s: { name: string; kind: SkillKind; owner: string; approver: string; data_classes: string[]; tier: 1 | 2 | 3 | null; workflow: string[]; output?: string; checks: string[]; instruction: string }): SkillDraft {
  return { name: slug(s.name + "_copy"), kind: s.kind, owner: s.owner, approver: s.approver, data_classes: [...s.data_classes], tier: s.tier, workflow: [...s.workflow], output: s.output ?? "", checks: [...s.checks], instruction: s.instruction, from: s.name };
}

const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();
const badText = (s: string) => /["\r\n]/.test(s);
const badItem = (s: string) => /["\r\n,[\]]/.test(s);

/** Problems that stop the draft from loading as a registered skill. Empty means it can go to review. */
export function checkSkill(d: SkillDraft, known: { names: string[]; rules: string[] }): Problem[] {
  const p: Problem[] = [];
  const add = (step: WizardStep, en: string, fr: string) => p.push({ step, en, fr });
  if (!/^[a-z][a-z0-9_]{1,39}$/.test(d.name) || d.name === "new") add("basics", "Name: 2–40 lowercase letters, digits or _, starting with a letter.", "Nom : 2 à 40 lettres minuscules, chiffres ou _, commençant par une lettre.");
  else if (known.names.includes(d.name)) add("basics", `Name: “${d.name}” is already a registered skill. Pick another name.`, `Nom : « ${d.name} » est déjà une compétence enregistrée. Choisissez un autre nom.`);
  if (!d.owner.trim()) add("governance", "Owner: name the team that owns this skill.", "Responsable : indiquez l’équipe responsable.");
  if (!d.approver.trim()) add("governance", "Approver: name the role that approves its output.", "Approbateur : indiquez le rôle qui approuve le résultat.");
  if ([d.owner, d.approver].some(badText)) add("governance", "Owner and approver: no quotation marks or line breaks.", "Responsable et approbateur : sans guillemets ni retour à la ligne.");
  if (d.data_classes.length === 0) add("governance", "Data: choose at least one data class this skill may see.", "Données : choisissez au moins une classe de données.");
  if (d.tier === null) add("governance", "Risk tier: choose 1, 2 or 3.", "Niveau de risque : choisissez 1, 2 ou 3.");
  if ([...d.data_classes, ...d.workflow].some(badItem)) add("governance", "Lists: no commas, brackets or quotation marks inside an item.", "Listes : pas de virgule, de crochet ni de guillemet dans un élément.");
  if (d.workflow.some(w => !/^[A-Za-z][A-Za-z0-9.-]{0,9}$/.test(w))) add("runs", "Workload ids: short codes from the inventory, such as I2 or M1.", "Identifiants : codes courts de l’inventaire, comme I2 ou M1.");
  if (d.kind === "ai" && !/^[A-Z][A-Za-z0-9_]{1,59}$/.test(d.output)) add("runs", "Output: choose the schema the answer must match (a developer adds new ones to lib/harness/jobs.ts).", "Résultat : choisissez le schéma attendu (un développeur ajoute les nouveaux dans lib/harness/jobs.ts).");
  const unknown = d.checks.filter(c => !known.rules.includes(c));
  if (unknown.length) add("runs", `Checks: unknown rule ${unknown.join(", ")}.`, `Contrôles : règle inconnue ${unknown.join(", ")}.`);
  if (d.instruction.trim().length < 40) add("instruction", d.kind === "ai" ? "Instruction: write what the model must do (at least a few sentences)." : "Description: say what the code decides (at least a few sentences).", d.kind === "ai" ? "Consigne : décrivez ce que le modèle doit faire (quelques phrases)." : "Description : expliquez ce que le code décide (quelques phrases).");
  else if (d.instruction.includes("…")) add("instruction", "Instruction: replace every … in the starting text.", "Consigne : remplacez chaque … du texte de départ.");
  const guard = guardPersonalData(d.instruction);
  // The message never repeats the match, so the personal data is not copied onto the screen.
  if (!guard.ok) add("instruction", `Instruction: remove what looks like personal data (${guard.matches.length} email, phone or supporter ID).`, `Consigne : retirez ce qui ressemble à des données personnelles (${guard.matches.length} courriel, téléphone ou numéro de donateur).`);
  return p;
}

const q = (s: string) => `"${oneLine(s).replace(/"/g, "'")}"`;
const qList = (xs: string[]) => `[${xs.map(x => q(x.replace(/[,[\]]/g, " "))).join(", ")}]`;

/** The SKILL.md a reviewer places at standard/skills/<name>/SKILL.md. */
export function toSkillMarkdown(d: SkillDraft): string {
  const front = [
    `name: ${d.name}`,
    `kind: ${d.kind}`,
    `owner: ${q(d.owner)}`,
    `workflow: ${qList(d.workflow)}`,
    `data_classes: ${qList(d.data_classes)}`,
    ...(d.tier ? [`tier: ${d.tier}`] : []),
    `approver: ${q(d.approver)}`,
    ...(d.output.trim() ? [`output: ${oneLine(d.output)}`] : []),
    `checks: ${qList(d.checks)}`,
  ];
  return ["---", ...front, "---", "", d.instruction.trim(), ""].join("\n");
}

// The first sentence of an instruction, for one-line summaries in lists.
export const summary = (instruction: string) => (instruction.replace(/`/g, "").split(/(?<=[.!?])\s|\n/)[0] ?? "").trim();

type RegisterSkill = { name: string; kind: SkillKind; registered: boolean; owner: string; approver: string; tier: number | null; data_classes: string[]; checks: string[]; version: string; instruction: string };
const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

/** The skills register as one Markdown document, for sharing outside Synapse. */
export function registerMarkdown(skills: RegisterSkill[], steps: { n: number; id: string; label_en: string; skill?: string }[], generated: string): string {
  const used = (name: string) => steps.filter(s => s.skill === name).map(s => `${s.n}. ${s.label_en}`).join(", ") || "Not used by a workflow step yet";
  const lines = [
    "# Synapse skills register",
    "",
    `Generated ${generated} from standard/skills. A skill is registered when it has an owner, at least one data class, a risk tier and a named approver. It only runs when a workflow step uses it.`,
    "",
    "| Skill | Kind | Registered | Owner | Approver | Tier | Data classes | Used in | Version |",
    "|---|---|---|---|---|---|---|---|---|",
    ...skills.map(s => `| ${cell(s.name)} | ${s.kind === "ai" ? "AI" : "Code"} | ${s.registered ? "Yes" : "No"} | ${cell(s.owner || "—")} | ${cell(s.approver || "—")} | ${s.tier ?? "—"} | ${cell(s.data_classes.join(", ") || "—")} | ${cell(used(s.name))} | \`${s.version}\` |`),
  ];
  for (const s of skills) {
    lines.push("", `## ${s.name}`, "", `- Checks: ${s.checks.join(", ") || "none"}`, `- Used in: ${used(s.name)}`, "", s.kind === "ai" ? "Instruction sent to the model:" : "Rule the code applies (no model call):", "", "~~~text", s.instruction.replace(/~~~/g, "~ ~ ~"), "~~~");
  }
  return lines.join("\n") + "\n";
}
