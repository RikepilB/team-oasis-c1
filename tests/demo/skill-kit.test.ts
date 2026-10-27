import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { GET } from "@/app/api/skills/[name]/route";
import { blankDraft, checkSkill, draftFrom, registerMarkdown, toSkillMarkdown, type SkillDraft } from "@/lib/demo/skill-kit";
import { loadStandard, skillMarkdown } from "@/lib/demo/standard";
import { isRegistered, loadSkills } from "@/lib/harness/skills";

const standard = loadStandard();
const known = { names: standard.skills.map(s => s.name), rules: standard.rules.map(r => r.id) };
let tmp: string;
beforeEach(() => { tmp = mkdtempSync(path.join(tmpdir(), "skill-kit-")); });
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

// What a reviewer does with a downloaded draft: drop it in standard/skills/<name>/SKILL.md and load it.
function placeAndLoad(d: SkillDraft) {
  mkdirSync(path.join(tmp, d.name), { recursive: true });
  writeFileSync(path.join(tmp, d.name, "SKILL.md"), toSkillMarkdown(d));
  return loadSkills(tmp).find(s => s.name === d.name)!;
}

const tricky: SkillDraft = {
  name: "summarise_visits",
  kind: "ai",
  owner: "Grants & Compliance # Québec team: 2026",
  approver: "2026",
  data_classes: ["Confidential", "Internal"],
  tier: 2,
  workflow: ["I2", "M1"],
  output: "FillSchema",
  checks: ["personal_data_guard", "narrative_numbers_cited"],
  instruction: "You summarise monitoring visits for the programme team.\n\n---\n# Rules\n- Don't compute numbers: l’équipe vérifie.\n",
};

describe("skill drafts", () => {
  test("a downloaded SKILL.md loads back with the same values and counts as registered", () => {
    expect(checkSkill(tricky, known)).toEqual([]);
    const loaded = placeAndLoad(tricky);
    expect(loaded).toMatchObject({ name: tricky.name, kind: "ai", owner: tricky.owner, approver: "2026", data_classes: tricky.data_classes, tier: 2, workflow: tricky.workflow, output: "FillSchema", checks: tricky.checks, instruction: tricky.instruction.trim() });
    expect(isRegistered(loaded)).toBe(true);
  });

  test("values the file format cannot hold are flagged, and the file still loads", () => {
    const bad = { ...tricky, owner: 'MERL "lead"', data_classes: ["Confidential, Internal"] };
    expect(checkSkill(bad, known).map(p => p.step)).toEqual(["governance", "governance"]);
    expect(placeAndLoad(bad)).toMatchObject({ owner: "MERL 'lead'", data_classes: ["Confidential  Internal"] });
  });

  test("a blank draft lists what is missing, step by step", () => {
    const steps = checkSkill(blankDraft("ai"), known).map(p => p.step);
    expect(steps).toEqual(expect.arrayContaining(["basics", "governance", "runs", "instruction"]));
    expect(checkSkill(blankDraft("code"), known).map(p => p.step)).not.toContain("runs");
  });

  test("names, rules and personal data are checked", () => {
    expect(checkSkill({ ...tricky, name: "extract_facts" }, known)[0].en).toMatch(/already a registered skill/);
    expect(checkSkill({ ...tricky, name: "new" }, known)[0].step).toBe("basics");
    expect(checkSkill({ ...tricky, checks: ["made_up"] }, known)[0].en).toMatch(/unknown rule made_up/);
    const personal = checkSkill({ ...tricky, instruction: tricky.instruction + "\nWrite to amara@example.org for help." }, known)[0].en;
    expect(personal).toMatch(/personal data \(1 email/);
    expect(personal).not.toContain("amara@");
  });

  test("every registered skill can be duplicated as a valid draft", () => {
    for (const s of standard.skills) {
      const d = draftFrom(s);
      expect(checkSkill(d, known)).toEqual([]);
      expect(placeAndLoad(d)).toMatchObject({ kind: s.kind, owner: s.owner, approver: s.approver, data_classes: s.data_classes, tier: s.tier, workflow: s.workflow, checks: s.checks, instruction: s.instruction });
    }
  });

  test("the register document lists every skill and where it is used", () => {
    const md = registerMarkdown(standard.skills, standard.workflow.steps, "2026-10-26");
    expect(md).toMatch(/^# Synapse skills register/);
    for (const s of standard.skills) expect(md).toContain(`## ${s.name}`);
    expect(md).toContain("2. Facts");
    expect(md).toMatch(/\| water_point_priorities \|.*Not used by a workflow step yet/);
  });
});

describe("SKILL.md download", () => {
  test("returns the exact file for a registered skill", async () => {
    expect(skillMarkdown("extract_facts")).toBe(readFileSync("standard/skills/extract_facts/SKILL.md", "utf8"));
    const res = await GET(new Request("http://localhost/api/skills/extract_facts"), { params: Promise.resolve({ name: "extract_facts" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/markdown/);
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="extract_facts.SKILL.md"');
    expect(await res.text()).toBe(skillMarkdown("extract_facts"));
  });

  test("unknown names and paths find nothing", async () => {
    for (const name of ["nope", "../package.json", "..", "extract_facts/SKILL.md", ""]) {
      expect(skillMarkdown(name)).toBeNull();
      const res = await GET(new Request("http://localhost/api/skills/x"), { params: Promise.resolve({ name }) });
      expect(res.status).toBe(404);
    }
  });
});
