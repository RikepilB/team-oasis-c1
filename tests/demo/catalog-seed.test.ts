import { afterEach, beforeEach, expect, test } from "vitest";
import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { reportCatalog } from "@/lib/demo/catalog";
import { context } from "@/lib/demo/store";
import { getLog, getRecord } from "@/lib/demo/workflow";
import { getReportStatus, matchesReportView, priorityRank } from "@/lib/demo/presentation";

// A fresh demo opens with sample work in "Needs action" and sample priorities (seed.json, priorities.json).
const ENV = ["SYNAPSE_DATA_DIR", "SYNAPSE_RUNTIME_DIR", "SYNAPSE_SEED", "AI_MODE"] as const;
const prior = Object.fromEntries(ENV.map(k => [k, process.env[k]]));
let temp: string;
beforeEach(() => { temp = mkdtempSync(path.join(tmpdir(), "seed-")); process.env.SYNAPSE_DATA_DIR = "data/fixtures/demo"; process.env.SYNAPSE_RUNTIME_DIR = temp; delete process.env.SYNAPSE_SEED; delete process.env.AI_MODE; });
afterEach(() => { for (const k of ENV) { if (prior[k] === undefined) delete process.env[k]; else process.env[k] = prior[k]; } rmSync(temp, { recursive: true, force: true }); });

test("a fresh demo has three sample reports needing action, with who prioritised them", async () => {
  const rows = await reportCatalog();
  const action = rows.filter(r => matchesReportView(r, "action")).map(r => r.record_id).sort();
  expect(action).toEqual(["demo-school-jun", "fixture-q1", "sample-healthy-schools-q2"]);
  expect(getReportStatus(rows.find(r => r.record_id === "demo-school-jun")!)).toBe("approved");
  const p0 = rows.find(r => r.record_id === "sample-healthy-schools-q2")!.priority!;
  expect(p0).toMatchObject({ level: "P0", set_by: "Director, International Programmes" });
  // Seeding happens once: a second read changes nothing.
  const again = await reportCatalog();
  expect(again.map(r => r.templates.length)).toEqual(rows.map(r => r.templates.length));
});

test("priority order: P0, P1, P2, then none", async () => {
  process.env.SYNAPSE_SEED = "off";
  const rows = await reportCatalog();
  const sorted = [...rows].sort((a, b) => priorityRank(a) - priorityRank(b)).map(r => r.priority?.level ?? "-");
  expect(sorted).toEqual(["P0", "P1", "P1", "P2", "-", "-", "-"]);
  expect(rows.every(r => r.templates.length === 0)).toBe(true);
});

test("the sample is claimed before it runs, so a failed step is never replayed", async () => {
  // A copy of the demo data whose seed fails at its second step.
  const data = path.join(temp, "data");
  cpSync("data/fixtures/demo", data, { recursive: true });
  writeFileSync(path.join(data, "seed.json"), JSON.stringify({ steps: [
    { id: "fixture-q1", action: "extract", actor: "Daniel" },
    { id: "demo-river-may", action: "clean", actor: "Daniel" },
    { id: "demo-river-may", action: "extract", actor: "Daniel" },
  ] }));
  process.env.SYNAPSE_DATA_DIR = data;
  await reportCatalog();
  expect(existsSync(path.join(context().runtime, "seeded.json"))).toBe(true);
  expect((await getRecord("fixture-q1")).completed).toEqual(["extract"]);
  expect((await getRecord("demo-river-may")).facts).toEqual([]);
  const entries = (await getLog()).entries.length;
  await reportCatalog();
  expect((await getLog()).entries.length).toBe(entries);
});

test("live AI mode skips the recorded sample instead of calling the model", async () => {
  process.env.AI_MODE = "live";
  const rows = await reportCatalog();
  expect(rows.every(r => r.templates.length === 0)).toBe(true);
  expect(existsSync(path.join(context().runtime, "seeded.json"))).toBe(false);
  expect((await getLog()).entries).toEqual([]);
});
