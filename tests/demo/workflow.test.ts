import { beforeEach, afterEach, test, expect, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getRecord, runAction, getExport, getLog, getEvidence, listInbox } from "@/lib/demo/workflow";
let temp: string;
const prior = { data: process.env.AQUIFER_DATA_DIR, runtime: process.env.AQUIFER_RUNTIME_DIR };
beforeEach(() => { temp = mkdtempSync(path.join(tmpdir(), "aquifer-test-")); process.env.AQUIFER_DATA_DIR = "data/fixtures/demo"; process.env.AQUIFER_RUNTIME_DIR = temp; });
afterEach(() => {
  process.env.AQUIFER_DATA_DIR = prior.data; process.env.AQUIFER_RUNTIME_DIR = prior.runtime; if (prior.data === undefined)
    delete process.env.AQUIFER_DATA_DIR; if (prior.runtime === undefined)
    delete process.env.AQUIFER_RUNTIME_DIR; rmSync(temp, { recursive: true, force: true }); vi.restoreAllMocks();
});
async function prepared(funder: "fdf" | "quebec" = "fdf") {
  for (const a of ["extract", "clean", "validate", "french"])
    await runAction("fixture-q1", a, { actor: "Preparer", preparer: "Preparer" });
  const current = await getRecord("fixture-q1");
  return runAction("fixture-q1", "template", { actor: "Preparer", preparer: "Preparer", funder_id: funder, ...(current.templates[funder] ? { expected_revision: current.templates[funder]!.revision } : {}) });
}
test("inbox and original source survive the journey", async () => { expect((await listInbox()).map(r => r.record_id).sort()).toEqual(["demo-river-may", "demo-school-jun", "demo-spring-q1", "demo-spring-q4", "fixture-q1", "fixture-q4"]); const original = (await getRecord("fixture-q1")).original_text; const r = await prepared(); expect(r.original_text).toBe(original); expect(r.templates.fdf?.fields.every(f => f.check === "green")).toBe(true); expect((await getLog()).entries.some(e => e.action === "replay" && e.detail.attempt === 2)).toBe(true); });
test("full English path repeats without duplicate approvals/exports or network", async () => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network forbidden"));
  for (let i = 0;i < 2;i++) {
    const r = await prepared();
    const revision = r.templates.fdf!.revision;
    await runAction("fixture-q1", "approve", { actor: "Reviewer", funder_id: "fdf", expected_revision: revision });
    await runAction("fixture-q1", "export", { actor: "Reviewer", funder_id: "fdf", expected_revision: revision });
    await runAction("fixture-q1", "export", { actor: "Reviewer", funder_id: "fdf", expected_revision: revision });
    const out = await getExport("fixture-q1", "fdf", revision);
    expect(out.content).toContain("Fictional data");
  }
  expect((await getLog()).valid).toBe(true);
  expect(globalThis.fetch).not.toHaveBeenCalled();
});
test("self approval and empty names are rejected", async () => { const r = await prepared(); await expect(runAction("fixture-q1", "approve", { actor: " preparer ", funder_id: "fdf", expected_revision: r.templates.fdf!.revision })).rejects.toThrow(/different/i); await expect(runAction("fixture-q1", "approve", { actor: "", funder_id: "fdf" })).rejects.toThrow(); });
test("wrong number blocks approval", async () => { const r = await prepared(); const edited = await runAction("fixture-q1", "edit", { actor: "Preparer", funder_id: "fdf", key: "progress", value: "Reported functionality is 99%.", expected_revision: r.templates.fdf!.revision }); expect(edited.templates.fdf!.fields.find(f => f.key === "progress")!.check).toBe("red"); await expect(runAction("fixture-q1", "approve", { actor: "Reviewer", funder_id: "fdf", expected_revision: edited.templates.fdf!.revision })).rejects.toThrow(); });
test("a green edit still invalidates approval and stale revision cannot export", async () => { let r = await prepared(); const t = r.templates.fdf!; await runAction("fixture-q1", "approve", { actor: "Reviewer", funder_id: "fdf", expected_revision: t.revision }); r = await runAction("fixture-q1", "edit", { actor: "Preparer", funder_id: "fdf", key: "progress", value: "Reported functionality remains 80%.", expected_revision: t.revision }); expect(r.templates.fdf!.approval).toBeNull(); await expect(runAction("fixture-q1", "export", { actor: "Reviewer", funder_id: "fdf", expected_revision: t.revision })).rejects.toThrow(); });
test("French final text requires current human review; edit invalidates it", async () => { let r = await prepared("quebec"); await expect(runAction("fixture-q1", "approve", { actor: "Reviewer", funder_id: "quebec", expected_revision: r.templates.quebec!.revision })).rejects.toThrow(/French|français/i); r = await runAction("fixture-q1", "review", { actor: "Bilingual reviewer", funder_id: "quebec", expected_revision: r.templates.quebec!.revision }); await runAction("fixture-q1", "approve", { actor: "Reviewer", funder_id: "quebec", expected_revision: r.templates.quebec!.revision }); await runAction("fixture-q1", "export", { actor: "Reviewer", funder_id: "quebec", expected_revision: r.templates.quebec!.revision }); expect((await getExport("fixture-q1", "quebec", r.templates.quebec!.revision)).content).toContain("Données fictives"); r = await runAction("fixture-q1", "edit", { actor: "Preparer", funder_id: "quebec", key: "progress", value: "Le taux déclaré reste de 80%.", expected_revision: r.templates.quebec!.revision }); expect(r.templates.quebec!.review).toBeNull(); });
test("missing and empty required fields cannot approve", async () => { let r = await prepared(); r = await runAction("fixture-q1", "edit", { actor: "Preparer", funder_id: "fdf", key: "progress", value: "", expected_revision: r.templates.fdf!.revision }); await expect(runAction("fixture-q1", "approve", { actor: "Reviewer", funder_id: "fdf", expected_revision: r.templates.fdf!.revision })).rejects.toThrow(); });
test("same snapshot supports reported number and evidence", async () => { const r = await prepared(); const e = await getEvidence({ snapshot: r.snapshot_id, definition: "incl_partly" }); expect(e.rows).toHaveLength(4); expect(e.counts.total).toBe(5); expect(e.counts.pct_incl_partly).toBe(80); });
test("simultaneous export clicks append exactly one send event", async () => { const r = await prepared(); const input = { actor: "Reviewer", funder_id: "fdf" as const, expected_revision: r.templates.fdf!.revision }; await runAction("fixture-q1", "approve", input); await Promise.all([runAction("fixture-q1", "export", input), runAction("fixture-q1", "export", input)]); expect((await getLog()).entries.filter(e => e.action === "export")).toHaveLength(1); });
test("privacy guard blocks extraction without storing raw personal data in audit", async () => { const folder = path.join(temp, "fixture"); cpSync("data/fixtures/demo", folder, { recursive: true }); process.env.AQUIFER_DATA_DIR = folder; const p = path.join(folder, "inbox", "fixture-q1.txt"); writeFileSync(p, readFileSync(p, "utf8") + " Contact: private@example.test."); await expect(runAction("fixture-q1", "extract", { actor: "Preparer" })).rejects.toThrow(/Personal/i); expect(JSON.stringify((await getLog()).entries)).not.toContain("private@example.test"); });
test("missing observations retain the register denominator and block approval", async () => {
  const folder = path.join(temp, "fixture");
  cpSync("data/fixtures/demo", folder, { recursive: true });
  process.env.AQUIFER_DATA_DIR = folder;
  const p = path.join(folder, "kijana_monitoring_visits.csv");
  writeFileSync(p, readFileSync(p, "utf8").split("\n").filter(l => !l.includes(",DEMO-5,")).join("\n"));
  const r = await prepared();
  const e = await getEvidence({ snapshot: r.snapshot_id });
  expect(e.counts.total).toBe(5);
  expect(e.counts.observed_total).toBe(4);
  expect(e.counts.pct_full).toBe(40);
  expect(e.missing_ids).toEqual(["DEMO-5"]);
  await expect(runAction("fixture-q1", "approve", { actor: "Reviewer", funder_id: "fdf", expected_revision: r.templates.fdf!.revision })).rejects.toThrow(/coverage/i);
});
test("empty datasets show unavailable percentages", async () => {
  const folder = path.join(temp, "fixture");
  cpSync("data/fixtures/demo", folder, { recursive: true });
  process.env.AQUIFER_DATA_DIR = folder;
  for (const file of ["kijana_water_points.csv", "kijana_monitoring_visits.csv"]) {
    const p = path.join(folder, file);
    writeFileSync(p, readFileSync(p, "utf8").split("\n")[0] + "\n");
  }
  const e = await getEvidence();
  expect(e.counts.total).toBe(0);
  expect(e.counts.pct_full).toBeNull();
  expect(e.counts.pct_incl_partly).toBeNull();
});
test("duplicate register identifiers are refused", async () => {
  const folder = path.join(temp, "fixture");
  cpSync("data/fixtures/demo", folder, { recursive: true });
  process.env.AQUIFER_DATA_DIR = folder;
  const p = path.join(folder, "kijana_water_points.csv");
  const text = readFileSync(p, "utf8");
  writeFileSync(p, text + text.split("\n")[1] + "\n");
  await expect(getRecord("fixture-q1")).rejects.toThrow(/identifiers/i);
});
test("exhausted corrections and unknown citations remain blocking", async () => {
  const folder = path.join(temp, "fixture");
  cpSync("data/fixtures/demo", folder, { recursive: true });
  process.env.AQUIFER_DATA_DIR = folder;
  const p = path.join(folder, "replay/fixture-q1.json");
  const data = JSON.parse(readFileSync(p, "utf8"));
  for (const attempt of data.templates.fdf.attempts) {
    attempt.fields[0].cites = ["F-UNKNOWN"];
  }
  writeFileSync(p, JSON.stringify(data));
  const r = await prepared();
  expect(r.templates.fdf!.fields.some(f => f.check === "red")).toBe(true);
  await expect(runAction("fixture-q1", "approve", { actor: "Reviewer", funder_id: "fdf", expected_revision: r.templates.fdf!.revision })).rejects.toThrow();
});
test("a second funder has independent approval and export state", async () => {
  let r = await prepared();
  const revision = r.templates.fdf!.revision;
  await runAction("fixture-q1", "approve", { actor: "Reviewer", funder_id: "fdf", expected_revision: revision });
  r = await runAction("fixture-q1", "template", { actor: "Preparer", funder_id: "quebec" });
  expect(r.templates.fdf!.approval?.approved_revision).toBe(revision);
  expect(r.templates.quebec!.approval).toBeNull();
  await runAction("fixture-q1", "export", { actor: "Reviewer", funder_id: "fdf", expected_revision: revision });
  expect((await getExport("fixture-q1", "fdf", revision)).content).toContain("Reviewer");
});
test("only the stored approving person can confirm export", async () => {
  const r = await prepared();
  const revision = r.templates.fdf!.revision;
  await runAction("fixture-q1", "approve", { actor: "Reviewer", funder_id: "fdf", expected_revision: revision });
  await expect(runAction("fixture-q1", "export", { actor: "Someone else", funder_id: "fdf", expected_revision: revision })).rejects.toThrow(/same approving/i);
});
test("numeric fields reject edits and private narrative edits are blocked", async () => {
  const r = await prepared();
  const common = { actor: "Preparer", funder_id: "fdf" as const, expected_revision: r.templates.fdf!.revision };
  await expect(runAction("fixture-q1", "edit", { ...common, key: "pct_full", value: "99%" })).rejects.toThrow(/narrative/i);
  await expect(runAction("fixture-q1", "edit", { ...common, key: "progress", value: "Contact private@example.test." })).rejects.toThrow(/Personal/i);
  expect(JSON.stringify((await getLog()).entries)).not.toContain("private@example.test");
});
test("wrong snapshot identifiers cannot silently recompute evidence", async () => { await expect(getEvidence({ snapshot: "unknown" })).rejects.toThrow(/unavailable/i); });

import * as standardModule from "@/lib/demo/standard";
import * as skillRegistry from "@/lib/harness/skills";
import { context } from "@/lib/demo/store";
test("a standard change requires a fresh template and review", async () => {
  const r = await prepared(); const revision = r.templates.fdf!.revision;
  await runAction("fixture-q1", "approve", { actor: "Reviewer", funder_id: "fdf", expected_revision: revision });
  const original = standardModule.loadStandard;
  vi.spyOn(standardModule, "loadStandard").mockImplementation(() => { const s = original(); return { ...s, rules: s.rules.map(rule => ({ ...rule, label: rule.label + " updated" })) }; });
  await expect(runAction("fixture-q1", "export", { actor: "Reviewer", funder_id: "fdf", expected_revision: revision })).rejects.toThrow(/standard/i);
});
test("damaged audit chains block subsequent writes", async () => {
  await prepared(); const file = path.join(context().runtime, "audit.jsonl"); const lines = readFileSync(file, "utf8").trim().split("\n"); const entry = JSON.parse(lines[0]); entry.actor = "Tampered"; lines[0] = JSON.stringify(entry); writeFileSync(file, lines.join("\n") + "\n");
  expect((await getLog()).valid).toBe(false); await expect(runAction("fixture-q1", "clean", { actor: "Preparer" })).rejects.toThrow(/integrity/i);
});
test("an unregistered drafting job refuses to run", async () => {
  vi.spyOn(skillRegistry, "getSkill").mockReturnValue(null);
  await expect(runAction("fixture-q1", "extract", { actor: "Preparer" })).rejects.toThrow(/registered/i);
  expect((await getLog()).entries).toHaveLength(0);
});


test("the complete French journey succeeds twice with no network",async()=>{
 vi.spyOn(globalThis,"fetch").mockRejectedValue(new Error("Network forbidden"));
 for(let cycle=0;cycle<2;cycle++){
  const r=await prepared("quebec");const revision=r.templates.quebec!.revision;
  await runAction("fixture-q1","review",{actor:"Bilingual reviewer",funder_id:"quebec",expected_revision:revision});
  const decision={actor:"Reviewer",funder_id:"quebec" as const,expected_revision:revision};
  await runAction("fixture-q1","approve",decision);await runAction("fixture-q1","export",decision);
  expect((await getExport("fixture-q1","quebec",revision)).content).toContain("Données fictives");
 }
 expect(globalThis.fetch).not.toHaveBeenCalled();expect((await getLog()).valid).toBe(true);
});
