import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// AI_MODE=live sends each drafting job to the model instead of the recorded replay. The model is mocked
// here, so this checks the wiring (what is sent, what comes back, what is logged) without a key.
const live = vi.hoisted(() => ({ calls: [] as { job: string; key: string; attempt: number; input: string }[] }));
vi.mock("@/lib/harness/providers/live", () => ({
  DEFAULT_MODEL: "claude-haiku-5-5",
  activeModel: () => process.env.SYNAPSE_MODEL || "claude-haiku-5-5",
  MODEL: "claude-haiku-5-5",
  liveProvider: vi.fn(async (args: { job: string; key: string; attempt: number; input: string }) => {
    live.calls.push(args);
    const replay = JSON.parse(readFileSync("data/fixtures/demo/replay/sample-healthy-schools-q2.json", "utf8"));
    if (args.job === "extract_facts") return { ok: true, data: { facts: replay.facts }, model: "claude-haiku-5-5" };
    if (args.job === "draft_french") return { ok: true, data: replay.french, model: "claude-haiku-5-5" };
    return { ok: true, data: replay.templates[args.key.endsWith("quebec") ? "quebec" : "fdf"].attempts[0], model: "claude-haiku-5-5" };
  }),
}));
import { getLog, getRecord, runAction } from "@/lib/demo/workflow";

const ENV = ["SYNAPSE_DATA_DIR", "SYNAPSE_RUNTIME_DIR", "AI_MODE", "ANTHROPIC_API_KEY"] as const;
const prior = Object.fromEntries(ENV.map(k => [k, process.env[k]]));
let temp: string;
beforeEach(() => {
  temp = mkdtempSync(path.join(tmpdir(), "live-wiring-"));
  process.env.SYNAPSE_DATA_DIR = "data/fixtures/demo";
  process.env.SYNAPSE_RUNTIME_DIR = temp;
  process.env.AI_MODE = "live";
  live.calls.length = 0;
});
afterEach(() => {
  for (const k of ENV) { if (prior[k] === undefined) delete process.env[k]; else process.env[k] = prior[k]; }
  rmSync(temp, { recursive: true, force: true });
});

const id = "sample-healthy-schools-q2";
const who = { actor: "Daniel", preparer: "Daniel" };

test("live mode sends the report text to the model and logs the model used", async () => {
  await runAction(id, "extract", who);
  await runAction(id, "french", who);
  const r = await getRecord(id);
  expect(live.calls.map(c => c.job)).toEqual(["extract_facts", "draft_french"]);
  expect(live.calls[0].input).toBe(r.original_text);
  expect(r.facts.map(f => f.value)).toEqual([80, 4, 120]);
  expect(r.french?.items.filter(i => i.origin === "AI").map(i => i.word)).toEqual(["EAH", "Les enseignantes", "animé"]);
  const calls = (await getLog()).entries.filter(e => e.action === "ai_call");
  expect(calls).toHaveLength(2);
  expect(calls[0].detail).toMatchObject({ provider: "live", model: "claude-haiku-5-5", ok: true });
});

test("live mode builds the template prompt from facts and computed metrics", async () => {
  for (const a of ["extract", "clean", "validate"]) await runAction(id, a, who);
  await runAction(id, "template", { ...who, funder_id: "quebec" });
  const call = live.calls.find(c => c.job === "fill_template")!;
  expect(call.key).toBe(id + "-quebec");
  expect(call.input).toContain("Write in: French");
  expect(call.input).toContain("F-01 | functionality_reported | 80 %");
  expect(call.input).toMatch(/pct_incl_partly \| 80/);
  expect((await getRecord(id)).templates.quebec?.fields.every(f => f.check === "green")).toBe(true);
});
