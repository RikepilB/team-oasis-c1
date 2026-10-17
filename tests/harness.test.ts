import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { readAudit } from "@/lib/audit";
import { PERSONAL_DATA_PATTERNS, guardPersonalData } from "@/lib/harness/guard";
import { ExtractSchema, FillSchema, draftFrench, extractFacts, fillNarrative } from "@/lib/harness/jobs";
import { providers, runStep } from "@/lib/harness/run";
import { getSkill, isRegistered, loadSkills } from "@/lib/harness/skills";
import { getProfile, loadProfiles, loadWorkflow } from "@/lib/harness/standard";
import { getOrCreateRecord } from "@/lib/record/store";
import { Profile, WorkflowDef } from "@/lib/types";
import type { FactRecord } from "@/lib/types";

const ID = "kijana-q1-test";
const reportText = readFileSync("data/fixtures/inbox/kijana-q1-test.txt", "utf8");
const NNBSP = " "; // French narrow no-break space

let tmp: string;
const saved: Record<string, string | undefined> = {};
const ENV = ["DATA_DIR", "PACK_DIR", "AI_MODE", "ANTHROPIC_API_KEY"];

beforeEach(() => {
  tmp = mkdtempSync(path.join(tmpdir(), "harness-"));
  for (const k of ENV) saved[k] = process.env[k];
  process.env.DATA_DIR = path.join(tmp, "runtime");
  process.env.PACK_DIR = path.join(tmp, "pack");
  delete process.env.AI_MODE; // a dev shell with AI_MODE=live must not change the path under test
  delete process.env.ANTHROPIC_API_KEY;
  cpSync("data/fixtures/inbox", path.join(tmp, "pack", "inbox"), { recursive: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  rmSync(tmp, { recursive: true, force: true });
});

const aiCalls = () => readAudit().filter((e) => e.action === "ai_call");

// A fixture in the temp pack, the second place replay looks.
function packFixture(name: string, data: unknown) {
  const file = path.join(tmp, "pack", "ai", name);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, typeof data === "string" ? data : JSON.stringify(data));
}

// ---- Personal-data guard --------------------------------------------------------------------

describe("personal-data guard", () => {
  test("blocks email, phone and supporter ids", () => {
    expect(guardPersonalData("Contact jane@example.org")).toMatchObject({ ok: false });
    expect(guardPersonalData("Call 416-555-0199")).toMatchObject({ ok: false });
    expect(guardPersonalData("Call 416.555.0199 or 416 555 0199")).toMatchObject({ ok: false });
    expect(guardPersonalData("Major donor S-100317 asked")).toEqual({ ok: false, matches: ["S-100317"] });
    expect(guardPersonalData("email me: a@b.co")).toEqual({ ok: false, matches: ["a@b.co"] });
  });

  test("returns each matched text once, in order of appearance by pattern", () => {
    const r = guardPersonalData("S-100317 and S-100317 and jane@example.org");
    expect(r).toEqual({ ok: false, matches: ["jane@example.org", "S-100317"] });
  });

  test("does not flag figures, dates or fiscal labels", () => {
    for (const text of [
      "The sample includes 1,900 fictional people",
      `1${NNBSP}900 personnes et 85,3${NNBSP}%`,
      "Submitted 2026-07-29",
      "Q1 FY2026-27 and FY2026–27, 2026-2027",
      "70.3% of 320 water points, 225 working, 48 partly",
    ]) {
      expect(guardPersonalData(text)).toEqual({ ok: true });
    }
  });

  test("a repeated call gives the same answer (no shared regex state)", () => {
    expect(guardPersonalData("a@b.co")).toMatchObject({ ok: false });
    expect(guardPersonalData("a@b.co")).toMatchObject({ ok: false });
  });

  test("the patterns are one exported constant: email, phone, supporter id", () => {
    expect(PERSONAL_DATA_PATTERNS.map((p) => p.id)).toEqual(["email", "phone", "supporter_id"]);
  });
});

// ---- Skills ---------------------------------------------------------------------------------

describe("registered skills", () => {
  test("every AI skill in standard/skills is fully registered", () => {
    const skills = loadSkills();
    const ai = skills.filter((s) => s.kind === "ai");
    expect(ai.map((s) => s.name).sort()).toEqual(["draft_french", "extract_facts", "fill_template"]);
    expect(ai.every((s) => s.owner && s.data_classes.length && s.tier && s.approver)).toBe(true);
    expect(ai.every((s) => s.instruction.length > 100)).toBe(true);
    const code = skills.find((s) => s.name === "water_point_priorities");
    expect(code).toMatchObject({ kind: "code" });
    expect(code && isRegistered(code)).toBe(true);
    expect(getSkill("extract_facts")?.name).toBe("extract_facts");
    expect(getSkill("nope")).toBeNull();
  });

  test("version is the first 12 hex of the SKILL.md file hash", () => {
    const skill = getSkill("extract_facts")!;
    const bytes = readFileSync("standard/skills/extract_facts/SKILL.md");
    expect(skill.version).toBe(createHash("sha256").update(bytes).digest("hex").slice(0, 12));
    expect(skill.version).toMatch(/^[0-9a-f]{12}$/);
  });

  test("the frontmatter parser handles lists, numbers, quotes, comments, BOM and CRLF", () => {
    const dir = path.join(tmp, "skills", "demo");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, "SKILL.md"),
      [
        "﻿---",
        "name: demo",
        "kind: ai   # ai | code",
        "# a full-line comment",
        "owner: Grants & Compliance",
        "workflow: [I2, M1]",
        "data_classes: [Confidential]",
        "tier: 2",
        'approver: "Grants & Compliance Officer # not a comment"',
        "checks: []",
        "---",
        "Say hello.",
        "",
      ].join("\r\n"),
    );
    expect(loadSkills(path.join(tmp, "skills"))).toMatchObject([
      {
        name: "demo",
        kind: "ai",
        owner: "Grants & Compliance",
        workflow: ["I2", "M1"],
        data_classes: ["Confidential"],
        tier: 2,
        approver: "Grants & Compliance Officer # not a comment",
        checks: [],
        instruction: "Say hello.",
      },
    ]);
  });

  test("an incomplete skill refuses to run and is not audited as a call", async () => {
    const res = await runStep("extract_facts", "x", "text", ExtractSchema, {
      skillsDir: "data/fixtures/skills-incomplete",
      provider: "replay",
    });
    expect(res).toMatchObject({ ok: false, error: { kind: "unregistered_skill" } });
    expect(aiCalls()).toHaveLength(0);
    const incomplete = loadSkills("data/fixtures/skills-incomplete")[0];
    expect(incomplete.owner).toBe("");
    expect(isRegistered(incomplete)).toBe(false);
  });

  test("a job with no skill at all, or a code skill, refuses to run", async () => {
    const empty = path.join(tmp, "empty");
    mkdirSync(empty);
    expect(await runStep("extract_facts", "x", "t", ExtractSchema, { skillsDir: empty })).toMatchObject({
      ok: false,
      error: { kind: "unregistered_skill" },
    });
    const dir = path.join(tmp, "code-skills", "extract_facts");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, "SKILL.md"),
      "---\nname: extract_facts\nkind: code\nowner: MERL\ndata_classes: [Confidential]\ntier: 1\napprover: MERL lead\n---\nRule text.\n",
    );
    expect(
      await runStep("extract_facts", "x", "t", ExtractSchema, { skillsDir: path.join(tmp, "code-skills") }),
    ).toMatchObject({ ok: false, error: { kind: "unregistered_skill" } });
  });
});

// ---- runStep: guard, replay, manual ---------------------------------------------------------

describe("runStep guard", () => {
  test("personal data is blocked before any provider, and the block is audited", async () => {
    const spy = vi.spyOn(providers, "replay");
    const res = await runStep("extract_facts", "x", "email me: a@b.co", ExtractSchema, { provider: "replay", record_id: "rec-1" });
    expect(res).toMatchObject({ ok: false, error: { kind: "guard_blocked" } });
    expect(spy).not.toHaveBeenCalled();
    const log = readAudit();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      actor: "system",
      action: "blocked",
      record_id: "rec-1",
      detail: { job: "extract_facts", matches: ["a@b.co"] },
    });
  });

  test("the retry input is guarded too: a failure message carrying personal data stops the retry", async () => {
    const spy = vi.spyOn(providers, "replay");
    const res = await runStep("extract_facts", "kijana-q1-test", reportText, ExtractSchema, {
      provider: "replay",
      validate: () => ["reach bob@example.org"],
    });
    expect(res).toMatchObject({ ok: true, attempt: 1, failures: ["reach bob@example.org"] });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(readAudit().map((e) => e.action)).toEqual(["ai_call", "blocked"]);
  });
});

describe("replay provider", () => {
  test("returns the recorded fixture without a key and audits the call", async () => {
    const res = await runStep("extract_facts", ID, reportText, ExtractSchema);
    expect(res.ok && res.data.facts.length).toBeGreaterThan(3);
    expect(res).toMatchObject({ ok: true, attempt: 1, failures: [] });
    const calls = aiCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ actor: "system", record_id: ID });
    expect(calls[0].detail).toMatchObject({ job: "extract_facts", key: ID, provider: "replay", attempt: 1 });
    expect(calls[0].detail.skill_version).toBe(getSkill("extract_facts")!.version);
    expect("model" in calls[0].detail).toBe(false); // undefined keys stay out of the log
  });

  test("record_id option sets the audit record, defaulting to the key", async () => {
    await runStep("fill_template", `${ID}-fdf`, "x", FillSchema, { record_id: ID });
    expect(aiCalls()[0].record_id).toBe(ID);
    expect(aiCalls()[0].detail.key).toBe(`${ID}-fdf`);
  });

  test("a missing fixture is replay_missing", async () => {
    expect(await runStep("extract_facts", "nope", "text", ExtractSchema)).toMatchObject({
      ok: false,
      error: { kind: "replay_missing" },
    });
  });

  test("a key that could climb out of the fixtures folder is replay_missing", async () => {
    expect(await runStep("extract_facts", "../../etc/passwd", "text", ExtractSchema)).toMatchObject({
      ok: false,
      error: { kind: "replay_missing" },
    });
  });

  test("falls back to PACK_DIR/ai, and tracked fixtures win over the pack", async () => {
    packFixture("extract_facts-pack-only-a1.json", { facts: [] });
    expect(await runStep("extract_facts", "pack-only", "text", ExtractSchema)).toMatchObject({
      ok: true,
      data: { facts: [] },
    });
    packFixture(`extract_facts-${ID}-a1.json`, { facts: [] });
    const res = await runStep("extract_facts", ID, reportText, ExtractSchema);
    expect(res.ok && res.data.facts.length).toBeGreaterThan(3);
  });

  test("a fixture that does not match the schema, or is not JSON, is a parse error", async () => {
    packFixture("extract_facts-bad-a1.json", { nope: 1 });
    packFixture("extract_facts-notjson-a1.json", "{ not json");
    expect(await runStep("extract_facts", "bad", "text", ExtractSchema)).toMatchObject({ ok: false, error: { kind: "parse" } });
    expect(await runStep("extract_facts", "notjson", "text", ExtractSchema)).toMatchObject({ ok: false, error: { kind: "parse" } });
  });

  test("provider defaults to AI_MODE, then to replay", async () => {
    process.env.AI_MODE = "manual";
    const res = await runStep("extract_facts", "x", "text", ExtractSchema, { manualOutput: '{"facts":[]}' });
    expect(res).toMatchObject({ ok: true, data: { facts: [] } });
    expect(aiCalls()[0].detail.provider).toBe("manual");
    delete process.env.AI_MODE;
    await runStep("extract_facts", ID, reportText, ExtractSchema);
    expect(aiCalls()[1].detail.provider).toBe("replay");
  });
});

describe("manual provider", () => {
  const out = JSON.stringify({ facts: [{ label: "a", value: 1, unit: null, period: null, quote: "q" }] });

  test("valid pasted JSON is ok at attempt 1", async () => {
    const res = await runStep("extract_facts", "x", "text", ExtractSchema, { provider: "manual", manualOutput: out });
    expect(res).toMatchObject({ ok: true, attempt: 1, failures: [], data: { facts: [{ label: "a" }] } });
    expect(aiCalls()[0].detail).toMatchObject({ provider: "manual", attempt: 1 });
  });

  test("JSON wrapped in a code fence is accepted", async () => {
    const res = await runStep("extract_facts", "x", "text", ExtractSchema, {
      provider: "manual",
      manualOutput: "```json\n" + out + "\n```",
    });
    expect(res.ok).toBe(true);
  });

  test("bad JSON, a schema miss and nothing pasted are parse errors", async () => {
    for (const manualOutput of ["{ nope", '{"facts":"x"}', undefined]) {
      expect(await runStep("extract_facts", "x", "text", ExtractSchema, { provider: "manual", manualOutput })).toMatchObject({
        ok: false,
        error: { kind: "parse" },
      });
    }
  });

  test("a failing check is reported but never retried", async () => {
    const spy = vi.spyOn(providers, "manual");
    const res = await runStep("extract_facts", "x", "text", ExtractSchema, {
      provider: "manual",
      manualOutput: out,
      validate: () => ["a check failed"],
    });
    expect(res).toMatchObject({ ok: true, attempt: 1, failures: ["a check failed"] });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(aiCalls()).toHaveLength(1);
  });
});

// ---- Self-correction ------------------------------------------------------------------------

describe("self-correction", () => {
  const no72 = (d: z.infer<typeof FillSchema>) =>
    d.fields.filter((f) => f.value.includes("72")).map((f) => `${f.key} contains 72`);

  test("a failing first draft is retried once with the failed checks, and the fix is returned", async () => {
    const real = providers.replay;
    const spy = vi.spyOn(providers, "replay").mockImplementation((a) => real(a));
    const input = "Write the narrative.";
    const res = await runStep("fill_template", `${ID}-fdf`, input, FillSchema, { validate: no72 });
    expect(res).toMatchObject({ ok: true, attempt: 2, failures: [] });
    const note = res.ok ? res.data.fields.find((f) => f.key === "definition_note") : undefined;
    expect(note?.value).toContain("70.3% were fully working");
    expect(note?.value).not.toContain("72");

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[0][0]).toMatchObject({ attempt: 1, input, system: getSkill("fill_template")!.instruction });
    expect(spy.mock.calls[1][0]).toMatchObject({
      attempt: 2,
      input: input + "\n\nThese checks failed: definition_note contains 72. Fix only these; keep every number as given.",
    });

    const calls = aiCalls();
    expect(calls).toHaveLength(2);
    expect(calls.map((c) => c.detail.attempt)).toEqual([1, 2]);
  });

  test("a clean first draft is not retried", async () => {
    const spy = vi.spyOn(providers, "replay");
    const res = await runStep("fill_template", `${ID}-quebec`, "x", FillSchema, { validate: no72 });
    expect(res).toMatchObject({ ok: true, attempt: 1, failures: [] });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test("a missing a2 fixture returns attempt 1 with its failures, not an error", async () => {
    packFixture("extract_facts-only-a1-a1.json", { facts: [] });
    const res = await runStep("extract_facts", "only-a1", "text", ExtractSchema, { validate: () => ["red"] });
    expect(res).toMatchObject({ ok: true, attempt: 1, failures: ["red"] });
    expect(aiCalls()).toHaveLength(1); // the a2 lookup found nothing, so nothing ran
  });

  test("when attempt 2 still fails, attempt 2 is returned with its own failures", async () => {
    packFixture("extract_facts-both-a1.json", { facts: [] });
    packFixture("extract_facts-both-a2.json", {
      facts: [{ label: "x", value: 1, unit: null, period: null, quote: "q" }],
    });
    const res = await runStep("extract_facts", "both", "text", ExtractSchema, {
      validate: (d) => [`still red (${d.facts.length} facts)`],
    });
    expect(res).toMatchObject({ ok: true, attempt: 2, failures: ["still red (1 facts)"] });
    expect(aiCalls()).toHaveLength(2);
  });

  test("an unreadable a2 falls back to attempt 1 rather than losing the draft", async () => {
    packFixture("extract_facts-badtwo-a1.json", { facts: [] });
    packFixture("extract_facts-badtwo-a2.json", "{ not json");
    const res = await runStep("extract_facts", "badtwo", "text", ExtractSchema, { validate: () => ["red"] });
    expect(res).toMatchObject({ ok: true, attempt: 1, failures: ["red"] });
  });
});

// ---- Jobs and their replay fixtures ---------------------------------------------------------

describe("jobs on the synthetic Q1 report", () => {
  let r: FactRecord;
  beforeEach(() => {
    r = getOrCreateRecord(ID);
  });

  // The multiset of digit tokens, close to what the Task 5 verifier will use: period text is not a
  // figure; thousands separators and the French decimal comma are normalised.
  const digits = (text: string) =>
    text
      .replace(/\bQ\d|\bT\d|\b(?:FY)?20\d{2}\s?[–-]\s?(?:20)?\d{2}\b|\b20\d{2}\b/g, " ")
      .replace(/(?<=\d)[,   ](?=\d{3}\b)/g, "")
      .replace(/(?<=\d),(?=\d)/g, ".")
      .match(/\d+(?:\.\d+)?/g)!
      .sort();

  test("extractFacts: quotes are verbatim and each numeric value is in its quote", async () => {
    const spy = vi.spyOn(providers, "replay");
    const res = await extractFacts(r);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(spy.mock.calls[0][0].input).toBe(r.original_text);
    expect(res.data.facts.length).toBeGreaterThanOrEqual(7);
    const flat = (s: string) => s.replace(/\s+/g, " ");
    for (const f of res.data.facts) {
      expect(flat(reportText)).toContain(flat(f.quote));
      if (typeof f.value === "number") expect(f.quote.replace(/,(?=\d{3})/g, "")).toContain(String(f.value));
    }
    expect(aiCalls()[0]).toMatchObject({ record_id: ID });
    expect(aiCalls()[0].detail).toMatchObject({ job: "extract_facts", key: ID });
  });

  test("extractFacts: word-number facts keep the word as a string value", async () => {
    const res = await extractFacts(r);
    const words = res.ok ? res.data.facts.filter((f) => typeof f.value === "string") : [];
    expect(words.length).toBeGreaterThan(0);
    for (const f of words) expect(f.value).toMatch(/^[a-z]+$/);
  });

  test("draftFrench: every English number kept, French formatting, one unsure word at its position", async () => {
    const spy = vi.spyOn(providers, "replay");
    const res = await draftFrench(r);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(spy.mock.calls[0][0].input).toBe(r.original_text);
    expect(digits(res.data.text)).toEqual(digits(reportText));
    expect(res.data.text).toContain(`85${NNBSP}%`);
    expect(res.data.text).toContain(`1${NNBSP}900`);
    expect(res.data.uncertain_words).toHaveLength(1);
    const [u] = res.data.uncertain_words;
    expect(u.reason.length).toBeGreaterThan(10);
    expect(res.data.text.slice(u.position, u.position + u.word.length)).toBe(u.word);
  });

  test("fillNarrative: the FDF first draft is deliberately wrong, the second is fixed", async () => {
    const fields = [
      { key: "progress", label: "Progress" },
      { key: "challenges", label: "Challenges" },
      { key: "definition_note", label: "Definition note" },
    ];
    const a1 = await fillNarrative(r, "fdf", fields);
    expect(a1).toMatchObject({ ok: true, attempt: 1 });
    const note1 = a1.ok ? a1.data.fields.find((f) => f.key === "definition_note") : undefined;
    expect(note1).toMatchObject({ value: expect.stringContaining("72% were fully working"), cites: ["pct_full"] });

    const check = (d: z.infer<typeof FillSchema>) => d.fields.filter((f) => f.value.includes("72")).map((f) => f.key);
    const a2 = await fillNarrative(r, "fdf", fields, { validate: check });
    expect(a2).toMatchObject({ ok: true, attempt: 2, failures: [] });
    const note2 = a2.ok ? a2.data.fields.find((f) => f.key === "definition_note") : undefined;
    expect(note2?.value).toContain("70.3% were fully working; 85.3% including partly working");
    expect(note2?.cites).toEqual(["pct_full", "pct_incl_partly"]);
    expect(a2.ok && a2.data.fields.map((f) => f.key)).toEqual(["progress", "challenges", "definition_note"]);
    expect(aiCalls().some((c) => c.detail.key === `${ID}-fdf`)).toBe(true);
    expect(aiCalls().every((c) => c.record_id === ID)).toBe(true);
  });

  test("fillNarrative: Québec fields are French with the correct figures", async () => {
    const res = await fillNarrative(r, "quebec", [
      { key: "progres", label: "Progrès" },
      { key: "defis", label: "Défis" },
      { key: "note_definition", label: "Note sur la définition" },
    ]);
    expect(res).toMatchObject({ ok: true, attempt: 1 });
    if (!res.ok) return;
    expect(res.data.fields.map((f) => f.key)).toEqual(["progres", "defis", "note_definition"]);
    const note = res.data.fields.find((f) => f.key === "note_definition")!;
    expect(note.value).toContain(`70,3${NNBSP}%`);
    expect(note.value).toContain(`85,3${NNBSP}%`);
    expect(note.cites).toEqual(["pct_full", "pct_incl_partly"]);
    expect(res.data.fields.some((f) => f.value.includes("72"))).toBe(false);
  });

  test("fillNarrative sends the funder, the fields, the facts with ids and the metrics with ids", async () => {
    const spy = vi.spyOn(providers, "replay");
    const withData: FactRecord = {
      ...r,
      facts: [
        { fact_id: "F-01", label: "functionality_reported", value: 85, unit: "%", period: "Q1 FY2026-27", quote: "The synthetic status sample records 85%", check: "green", check_reason: null },
      ],
      metrics: [{ metric_id: "pct_full", cutoff: "2026-06-30", value: 70.3 }],
    };
    await fillNarrative(withData, "quebec", [{ key: "progres", label: "Progrès" }]);
    const sent = spy.mock.calls[0][0].input;
    for (const needle of ["quebec", "French", "progres", "Progrès", "F-01", "85", "pct_full", "70.3", "2026-06-30"]) {
      expect(sent).toContain(needle);
    }
  });

  test("every F-id cited by a fill fixture points at a fact in the extract fixture order", () => {
    const facts = JSON.parse(readFileSync(`data/fixtures/ai/extract_facts-${ID}-a1.json`, "utf8")).facts as unknown[];
    const cited = new Set<string>();
    for (const f of readdirSync("data/fixtures/ai").filter((n) => n.startsWith("fill_template-"))) {
      const data = JSON.parse(readFileSync(path.join("data/fixtures/ai", f), "utf8")) as z.infer<typeof FillSchema>;
      for (const field of data.fields) for (const c of field.cites) if (/^F-\d+$/.test(c)) cited.add(c);
    }
    expect(cited.size).toBeGreaterThan(0);
    for (const c of cited) expect(Number(c.slice(2))).toBeLessThanOrEqual(facts.length);
  });

  test("the FDF a2 and Québec fixtures contain no 72 anywhere", () => {
    for (const f of [`fill_template-${ID}-fdf-a2.json`, `fill_template-${ID}-quebec-a1.json`]) {
      expect(readFileSync(path.join("data/fixtures/ai", f), "utf8")).not.toContain("72");
    }
  });
});

// ---- Workflow and profiles ------------------------------------------------------------------

describe("the standard: workflow and profiles", () => {
  test("the funder-report workflow has the 9 steps of the design", () => {
    const w = loadWorkflow();
    expect(WorkflowDef.safeParse(w).success).toBe(true);
    expect(w).toMatchObject({ id: "funder-report", hours_today: 1260, source: "1.2 Workload Inventory, I2" });
    expect(w.steps.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(w.steps.map((s) => s.done_by)).toEqual(["code", "ai", "code", "code", "ai", "ai", "person", "person", "person"]);
    expect(w.steps.map((s) => s.id)).toEqual([
      "record", "extract", "clean", "validate", "french", "template", "review", "approve", "export",
    ]);
    expect(w.steps[1]).toMatchObject({ skill: "extract_facts", rules: ["verbatim_quote", "value_in_quote"] });
    expect(w.steps[2].rules).toEqual(["status_map", "date_order", "orphan_visits"]);
    expect(w.steps[3].rules).toEqual(["functionality_cross_check"]);
    expect(w.steps[4]).toMatchObject({ skill: "draft_french", rules: ["numbers_preserved"] });
    expect(w.steps[5]).toMatchObject({
      skill: "fill_template",
      rules: ["narrative_numbers_cited", "numeric_field_matches_source"],
    });
    expect(w.steps[7].rules).toEqual(["preparer_not_approver"]);
    expect(w.steps.every((s) => s.label_en && s.label_fr && s.decides && s.output)).toBe(true);
  });

  test("every skill a step names is a registered AI skill", () => {
    const skills = loadSkills();
    for (const s of loadWorkflow().steps.filter((x) => x.skill)) {
      const skill = skills.find((k) => k.name === s.skill);
      expect(skill, s.skill).toBeDefined();
      expect(skill && isRegistered(skill) && skill.kind === "ai").toBe(true);
    }
    expect(loadWorkflow().steps.filter((s) => s.done_by === "ai").every((s) => s.skill)).toBe(true);
  });

  test("both profiles load and validate", () => {
    const profiles = loadProfiles();
    expect(profiles.map((p) => p.id).sort()).toEqual(["ca-en", "ca-fr"]);
    expect(profiles.every((p) => Profile.safeParse(p).success)).toBe(true);
    expect(getProfile("ca-fr")).toEqual({
      id: "ca-fr",
      label: "Québec · français",
      language: "fr",
      number_locale: "fr-CA",
      functionality_definition: "both",
      templates: ["quebec"],
      provider: "replay",
      offline: true,
    });
    expect(getProfile("ca-en")).toMatchObject({ language: "en", templates: ["fdf", "cedar_stone"], functionality_definition: "both" });
    expect(getProfile("nope")).toBeNull();
  });

  test("the schemas refuse a bad step owner or an unknown provider", () => {
    const w = loadWorkflow();
    expect(WorkflowDef.safeParse({ ...w, steps: [{ ...w.steps[0], done_by: "robot" }] }).success).toBe(false);
    expect(Profile.safeParse({ ...getProfile("ca-en"), provider: "magic" }).success).toBe(false);
    expect(Profile.safeParse({ ...getProfile("ca-en"), templates: ["nope"] }).success).toBe(false);
  });
});

// ---- Only the live provider may import the SDK ----------------------------------------------

test("only lib/harness/providers/live.ts imports @anthropic-ai/sdk", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx|mts|js|mjs)$/.test(e.name)) files.push(p);
    }
  };
  walk("lib");
  walk("app");
  const importers = files
    .filter((f) => readFileSync(f, "utf8").includes("@anthropic-ai/sdk"))
    .map((f) => f.split(path.sep).join("/"));
  expect(importers).toEqual(["lib/harness/providers/live.ts"]);
});
