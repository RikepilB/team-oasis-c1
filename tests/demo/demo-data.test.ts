import { beforeEach, afterEach, describe, test, expect, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getRecord, runAction, getExport, getLog, listInbox } from "@/lib/demo/workflow";
import { checkFact, checkFrench } from "@/lib/demo/verify";
import { guardPersonalData } from "@/lib/harness/guard";
import { Sidecar } from "@/lib/demo/types";

// The four synthetic reports added to the inbox beside fixture-q1/q4. Every one is replayed end to end
// through the real workflow module; the expectations below are the behaviour each report is built to show.
const DATA = "data/fixtures/demo";
const ENV = ["AQUIFER_DATA_DIR", "SYNAPSE_DATA_DIR", "AQUIFER_RUNTIME_DIR", "SYNAPSE_RUNTIME_DIR"] as const;
const prior = Object.fromEntries(ENV.map(k => [k, process.env[k]]));
let temp: string;
beforeEach(() => {
  temp = mkdtempSync(path.join(tmpdir(), "demo-data-test-"));
  process.env.AQUIFER_DATA_DIR = process.env.SYNAPSE_DATA_DIR = DATA;
  process.env.AQUIFER_RUNTIME_DIR = process.env.SYNAPSE_RUNTIME_DIR = temp;
});
afterEach(() => {
  for (const k of ENV) { if (prior[k] === undefined) delete process.env[k]; else process.env[k] = prior[k]; }
  rmSync(temp, { recursive: true, force: true });
  vi.restoreAllMocks();
});

type Funder = "fdf" | "quebec";
type Case = {
  id: string; project: string; period: string; period_end: string;
  reported: number; full: number; incl: number;
  // Which definition the reported figure agrees with, or null when it agrees with neither.
  matches: "pct_full" | "pct_incl_partly" | null;
  // First-attempt failure of the recorded template response (null = right first time).
  firstFailure: Record<Funder, RegExp | null>;
  uncertainWords: number;
};
const clean: Case[] = [
  { id: "demo-school-jun", project: "School hygiene", period: "June 2026 visit round", period_end: "2026-06-15", reported: 80, full: 60, incl: 80, matches: "pct_incl_partly", firstFailure: { fdf: /not supported by its citations/, quebec: null }, uncertainWords: 0 },
  { id: "demo-spring-q4", project: "Spring protection", period: "Q4 FY2025-26", period_end: "2026-03-31", reported: 40, full: 40, incl: 60, matches: "pct_full", firstFailure: { fdf: null, quebec: /not supported by its citations/ }, uncertainWords: 2 },
  { id: "demo-river-may", project: "River programme", period: "May 2026 progress note", period_end: "2026-05-31", reported: 60, full: 40, incl: 60, matches: "pct_incl_partly", firstFailure: { fdf: /missing or unverified/, quebec: null }, uncertainWords: 0 },
];
const mismatch: Case = { id: "demo-spring-q1", project: "Spring protection", period: "Q1 FY2026-27", period_end: "2026-06-30", reported: 70, full: 60, incl: 80, matches: null, firstFailure: { fdf: null, quebec: null }, uncertainWords: 0 };
const all = [...clean, mismatch];
const NEW_IDS = all.map(c => c.id).sort();

const preparer = { actor: "Preparer Pat", preparer: "Preparer Pat" };
const reviewer = "Bilingual Bea";
const approver = "Approver Ari";
const read = (rel: string) => readFileSync(path.join(DATA, rel), "utf8");
const replayOf = (id: string) => JSON.parse(read(`replay/${id}.json`));

async function prepare(id: string) {
  for (const a of ["extract", "clean", "validate", "french"]) await runAction(id, a, preparer);
}
async function build(id: string, funder: Funder) {
  const current = await getRecord(id);
  return runAction(id, "template", { ...preparer, funder_id: funder, ...(current.templates[funder] ? { expected_revision: current.templates[funder]!.revision } : {}) });
}
// The replay/verify audit events for one fill_template run: attempt number and whether its checks passed.
async function fillAttempts(id: string, skip = 0) {
  const entries = (await getLog()).entries.filter(e => e.record_id === id && e.detail.job === "fill_template");
  const verified = entries.filter(e => e.action === "verify").slice(skip);
  const replayed = entries.filter(e => e.action === "replay").slice(skip);
  return { replayed: replayed.map(e => e.detail.attempt as number), verified: verified.map(e => ({ attempt: e.detail.attempt as number, passed: e.detail.passed as boolean, failures: e.detail.failures as string[] })) };
}
const crossCheck = (t: { checks: { rule_id: string; passed: boolean; severity: string; message: string }[] }) => t.checks.find(c => c.rule_id === "functionality_cross_check")!;

describe("recorded sources and replays", () => {
  test("the inbox lists the originals plus the new demo reports, across at least three projects", async () => {
    const rows = await listInbox();
    expect(rows.map(r => r.record_id).sort()).toEqual([...NEW_IDS, "fixture-q1", "fixture-q4"].sort());
    expect(rows.every(r => r.status === "new")).toBe(true);
    const projects = new Set(all.map(c => Sidecar.parse(JSON.parse(read(`inbox/${c.id}.json`))).project));
    expect(projects.size).toBeGreaterThanOrEqual(3);
  });

  test.each(all)("$id: sidecar, text and replay are consistent and synthetic", c => {
    const side = Sidecar.parse(JSON.parse(read(`inbox/${c.id}.json`)));
    const text = read(`inbox/${c.id}.txt`);
    const replay = replayOf(c.id);
    expect(side).toMatchObject({ record_id: c.id, project: c.project, period: c.period, period_end: c.period_end, source_file: `inbox/${c.id}.txt` });
    expect(side.received_date > side.period_end && side.received_date <= "2026-10-17").toBe(true);
    expect(text).toContain("synthetic");
    expect(guardPersonalData(text + JSON.stringify(replay)).ok).toBe(true);
    for (const f of replay.facts) expect(checkFact(f, text).check).toBe("green");
    expect(replay.facts[0]).toMatchObject({ label: "functionality_reported", value: c.reported, unit: "%" });
    expect(checkFrench(text, replay.french.text).check).toBe("green");
    expect(replay.french.uncertain_words).toHaveLength(c.uncertainWords);
    // The highlight needs the offset of the word in the French text.
    for (const u of replay.french.uncertain_words) expect(replay.french.text.indexOf(u.word)).toBe(u.position);
    expect(Object.keys(replay.templates).sort()).toEqual(["fdf", "quebec"]);
  });

  test("at least one report shows the self-correction path in each funder template", () => {
    for (const funder of ["fdf", "quebec"] as const) {
      expect(clean.some(c => c.firstFailure[funder] !== null)).toBe(true);
      expect(clean.some(c => replayOf(c.id).templates[funder].attempts.length === 2)).toBe(true);
    }
    for (const c of all)
      for (const funder of ["fdf", "quebec"] as const)
        expect(replayOf(c.id).templates[funder].attempts.length === 2).toBe(c.firstFailure[funder] !== null);
  });
});

describe.each(clean)("clean report $id", c => {
  test("replays extract, clean, validate, French, both templates, review, approval and export", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network forbidden"));
    const text = (await getRecord(c.id)).original_text;
    expect(text).toBe(read(`inbox/${c.id}.txt`));

    let r = await runAction(c.id, "extract", preparer);
    expect(r.status).toBe("extracted");
    expect(r.facts.map(f => f.fact_id)).toEqual(["F-01", "F-02", "F-03"]);
    expect(r.facts.every(f => f.check === "green")).toBe(true);
    expect(r.facts[0]).toMatchObject({ label: "functionality_reported", value: c.reported });
    await runAction(c.id, "clean", preparer);
    r = await runAction(c.id, "validate", preparer);
    expect(r.status).toBe("validated");
    expect(r.period_end).toBe(c.period_end);
    expect(r.coverage).toMatchObject({ total: 5, observed: 5, missing_ids: [] });
    const metric = (id: string) => r.metrics.find(m => m.metric_id === id)?.value;
    expect([metric("pct_full"), metric("pct_incl_partly"), metric("count_total")]).toEqual([c.full, c.incl, 5]);

    r = await runAction(c.id, "french", preparer);
    expect(r.status).toBe("translated");
    expect(r.french).toMatchObject({ text: replayOf(c.id).french.text, check: "green", problems: [] });

    let seen = 0;
    for (const funder of ["fdf", "quebec"] as const) {
      r = await build(c.id, funder);
      const t = r.templates[funder]!;
      expect(r.status).toBe("filled");
      expect(t.fields.map(f => f.key)).toEqual(["baseline_pct", "milestone_pct", "target_pct", "pct_full", "pct_incl_partly", "count_total", "progress", "definition_note"]);
      expect(t.fields.every(f => f.check === "green")).toBe(true);
      expect(t.checks.filter(k => !k.passed)).toEqual([]);
      expect(crossCheck(t)).toMatchObject({ passed: true, severity: "warn", message: c.matches === "pct_full" ? "The report matches fully working points." : "The report matches the count including partly working points." });
      expect(t.fields.find(f => f.key === "progress")!.value).toContain(c.reported + "%");

      // A wrong first draft is caught by the checks and corrected on the second recorded attempt.
      const { replayed, verified } = await fillAttempts(c.id, seen);
      seen += replayed.length;
      const failure = c.firstFailure[funder];
      if (failure) {
        expect(replayed).toEqual([1, 2]);
        expect(verified.map(v => [v.attempt, v.passed])).toEqual([[1, false], [2, true]]);
        expect(verified[0].failures.join(" ")).toMatch(failure);
      }
      else {
        expect(replayed).toEqual([1]);
        expect(verified.map(v => [v.attempt, v.passed])).toEqual([[1, true]]);
      }
    }

    // English funder: a different person approves, and the same person confirms the export.
    const fdf = r.templates.fdf!;
    await runAction(c.id, "approve", { actor: approver, funder_id: "fdf", expected_revision: fdf.revision });
    r = await runAction(c.id, "export", { actor: approver, funder_id: "fdf", expected_revision: fdf.revision });
    expect(r.templates.fdf!.approval).toMatchObject({ approver, approved_revision: fdf.revision });
    expect(r.templates.fdf!.approval!.sent_at).not.toBeNull();
    expect(r.templates.fdf!.disclosure).toContain(approver);
    const english = (await getExport(c.id, "fdf", fdf.revision)).content;
    expect(english).toContain("Fictional data");
    expect(english).toContain(c.period);
    expect(english).toContain(c.reported + "%");

    // French funder: approval is refused until a bilingual person has reviewed the current revision.
    const quebec = r.templates.quebec!;
    await expect(runAction(c.id, "approve", { actor: approver, funder_id: "quebec", expected_revision: quebec.revision })).rejects.toThrow(/French/i);
    for (const i of (await getRecord(c.id)).french?.items ?? []) await runAction(c.id, "french_item", { actor: reviewer, key: i.id, decision: "approve" });
    await runAction(c.id, "review", { actor: reviewer, funder_id: "quebec", expected_revision: quebec.revision });
    await runAction(c.id, "approve", { actor: approver, funder_id: "quebec", expected_revision: quebec.revision });
    r = await runAction(c.id, "export", { actor: approver, funder_id: "quebec", expected_revision: quebec.revision });
    const french = (await getExport(c.id, "quebec", quebec.revision)).content;
    expect(french).toContain("Données fictives");
    expect(french).toContain(c.period);

    expect(r.status).toBe("sent");
    expect(Object.values(r.templates).every(t => t.approval?.sent_at && t.checks.every(k => k.passed))).toBe(true);
    const log = await getLog();
    expect(log.valid).toBe(true);
    expect(log.entries.filter(e => e.record_id === c.id && e.action === "export")).toHaveLength(2);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe("mismatch report demo-spring-q1", () => {
  const c = mismatch;
  async function prepared() {
    await prepare(c.id);
    await build(c.id, "fdf");
    return build(c.id, "quebec");
  }

  test("its reported figure disagrees with both computed definitions", async () => {
    const r = await prepared();
    const metric = (id: string) => r.metrics.find(m => m.metric_id === id)?.value;
    expect([metric("pct_full"), metric("pct_incl_partly")]).toEqual([c.full, c.incl]);
    expect(r.facts[0]).toMatchObject({ label: "functionality_reported", value: c.reported, check: "green" });
    expect(r.original_text).toContain(c.reported + "%");
  });

  test("both funder versions carry a visible warning and are not approved or exported", async () => {
    const r = await prepared();
    expect(r.status).toBe("filled");
    for (const funder of ["fdf", "quebec"] as const) {
      const t = r.templates[funder]!;
      // Every figure and citation checks out; the one open item is the definition warning.
      expect(t.fields.every(f => f.check === "green")).toBe(true);
      expect(t.checks.filter(k => !k.passed).map(k => [k.rule_id, k.severity])).toEqual([["functionality_cross_check", "warn"]]);
      expect(crossCheck(t).message).toBe("The reported figure does not match either definition.");
      expect(t.approval).toBeNull();
      expect(t.disclosure).toBeNull();
      await expect(getExport(c.id, funder, t.revision)).rejects.toThrow(/Confirm the export/);
    }
    expect((await getLog()).entries.filter(e => e.record_id === c.id && (e.action === "approve" || e.action === "export"))).toEqual([]);
    expect(r.templates.fdf!.fields.find(f => f.key === "definition_note")!.value).toContain("matches neither");
  });

  test("the preparer cannot approve it, and approving it never clears or hides the warning", async () => {
    let r = await prepared();
    const t = r.templates.fdf!;
    await expect(runAction(c.id, "approve", { actor: preparer.actor, funder_id: "fdf", expected_revision: t.revision })).rejects.toThrow(/different/i);
    // Current behaviour: the definition check is a warning, so a different person may approve while it
    // is showing. That approval still needs the same person to confirm the export, and the warning stays.
    r = await runAction(c.id, "approve", { actor: approver, funder_id: "fdf", expected_revision: t.revision });
    expect(r.templates.fdf!.approval).toMatchObject({ approver, approved_revision: t.revision, sent_at: null });
    expect(crossCheck(r.templates.fdf!)).toMatchObject({ passed: false, severity: "warn" });
    await expect(getExport(c.id, "fdf", t.revision)).rejects.toThrow(/Confirm the export/);
    await expect(runAction(c.id, "export", { actor: "Someone else", funder_id: "fdf", expected_revision: t.revision })).rejects.toThrow(/same approving/i);
  });

  test("the French version also needs a bilingual review before it can be approved", async () => {
    const r = await prepared();
    const t = r.templates.quebec!;
    await expect(runAction(c.id, "approve", { actor: approver, funder_id: "quebec", expected_revision: t.revision })).rejects.toThrow(/French/i);
  });
});
