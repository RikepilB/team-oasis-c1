import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileVersion } from "@/lib/harness/standard";

// A skill is standard/skills/<name>/SKILL.md: a small frontmatter block (who owns it, what data it
// may see, its risk tier, who approves its output), then the written instruction that the engine
// sends as the system prompt (constitution Article 8). `water_point_priorities` is a code skill:
// registered so staff find one list, but it has no model call and runStep never runs it.
export type SkillDef = {
  name: string;
  kind: "ai" | "code";
  owner: string; // "" when the frontmatter has none
  workflow: string[];
  data_classes: string[];
  tier: 1 | 2 | 3 | null; // null when missing or not 1-3
  approver: string; // "" when missing
  output?: string; // Zod schema name in lib/harness/jobs.ts
  checks: string[];
  instruction: string;
  version: string; // first 12 hex of sha256 of the SKILL.md file
};

type Value = string | number | string[];

const unquote = (s: string): string => s.replace(/^(["'])(.*)\1$/, "$2");

// Drops a trailing ` # comment`, but not a # inside quotes.
function stripComment(s: string): string {
  let quote: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === "#" && (i === 0 || /\s/.test(s[i - 1]))) {
      return s.slice(0, i);
    }
  }
  return s;
}

function parseValue(raw: string): Value {
  const v = raw.trim();
  if (v.startsWith("[") && v.endsWith("]")) {
    const inner = v.slice(1, -1).trim();
    return inner === "" ? [] : inner.split(",").map((x) => unquote(x.trim()));
  }
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return unquote(v);
}

// The YAML subset skills use: `key: value`, `key: [a, b]`, numbers, quotes and # comments. Anything
// richer is a reason to add a real parser, not to stretch this one.
export function parseSkillFile(text: string): { front: Record<string, Value>; body: string } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines[0]?.trim() !== "---") throw new Error("no frontmatter (the file must start with ---)");
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (end < 0) throw new Error("frontmatter is not closed with ---");
  const front: Record<string, Value> = {};
  for (const line of lines.slice(1, end)) {
    const clean = stripComment(line).trimEnd();
    if (clean.trim() === "") continue;
    const colon = clean.indexOf(":");
    if (colon < 1) throw new Error(`cannot read frontmatter line "${line.trim()}"`);
    front[clean.slice(0, colon).trim()] = parseValue(clean.slice(colon + 1));
  }
  return { front, body: lines.slice(end + 1).join("\n").trim() };
}

const str = (v: Value | undefined): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const list = (v: Value | undefined): string[] => (Array.isArray(v) ? v : typeof v === "string" && v ? [v] : []);

function readSkill(file: string, dirName: string): SkillDef {
  let parsed;
  try {
    parsed = parseSkillFile(readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`${file}: ${e instanceof Error ? e.message : String(e)}`);
  }
  const { front, body } = parsed;
  if (front.kind !== "ai" && front.kind !== "code") throw new Error(`${file}: kind must be ai or code`);
  const tier = front.tier === 1 || front.tier === 2 || front.tier === 3 ? front.tier : null;
  return {
    name: str(front.name) || dirName,
    kind: front.kind,
    owner: str(front.owner),
    workflow: list(front.workflow),
    data_classes: list(front.data_classes),
    tier,
    approver: str(front.approver),
    output: str(front.output) || undefined,
    checks: list(front.checks),
    instruction: body,
    version: fileVersion(file),
  };
}

// Every skill under `dir`, sorted by name. Incomplete skills are returned, not hidden: the register
// screen should show them, and runStep refuses to run them.
export function loadSkills(dir: string = path.join("standard", "skills")): SkillDef[] {
  // Operator-selected skill folders are runtime inputs, not deployment bundle contents.
  if (!existsSync(/* turbopackIgnore: true */ dir)) return [];
  return readdirSync(/* turbopackIgnore: true */ dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(path.join(dir, e.name, "SKILL.md")))
    .map((e) => readSkill(path.join(dir, e.name, "SKILL.md"), e.name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getSkill(name: string, dir?: string): SkillDef | null {
  return loadSkills(dir).find((s) => s.name === name) ?? null;
}

// Registered = owner, at least one data class, a tier and an approver (constitution Article 8).
export function isRegistered(s: SkillDef): boolean {
  return Boolean(s.owner && s.data_classes.length > 0 && s.tier && s.approver);
}
