import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { readAudit } from "@/lib/audit";
import { ExtractSchema, FillSchema } from "@/lib/harness/jobs";
import { providers, runStep } from "@/lib/harness/run";
import { getSkill } from "@/lib/harness/skills";

// The SDK is replaced for this whole file, so nothing here can reach the network even if a guard or
// a key check regresses. The fakes mirror the SDK's error classes (AnthropicError > APIError >
// APIConnectionError), which is what live.ts maps from.
const sdk = vi.hoisted(() => {
  const parse = vi.fn();
  const constructed = vi.fn();
  class AnthropicError extends Error {}
  class APIError extends AnthropicError {
    constructor(
      message: string,
      readonly status?: number,
    ) {
      super(message);
    }
  }
  class APIConnectionError extends APIError {}
  class Anthropic {
    static AnthropicError = AnthropicError;
    static APIError = APIError;
    static APIConnectionError = APIConnectionError;
    messages = { parse };
    constructor(opts?: unknown) {
      constructed(opts);
    }
  }
  return { parse, constructed, AnthropicError, APIError, APIConnectionError, Anthropic };
});
vi.mock("@anthropic-ai/sdk", () => ({ default: sdk.Anthropic }));

const ENV = ["DATA_DIR", "PACK_DIR", "AI_MODE", "ANTHROPIC_API_KEY"];
const saved: Record<string, string | undefined> = {};
let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(path.join(tmpdir(), "harness-live-"));
  for (const k of ENV) saved[k] = process.env[k];
  process.env.DATA_DIR = path.join(tmp, "runtime");
  process.env.PACK_DIR = path.join(tmp, "pack");
  process.env.AI_MODE = "live";
  process.env.ANTHROPIC_API_KEY = "test";
  sdk.parse.mockReset();
  sdk.constructed.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  rmSync(tmp, { recursive: true, force: true });
});

const ok = (parsed: unknown, extra: object = {}) => ({
  stop_reason: "end_turn",
  parsed_output: parsed,
  model: "claude-opus-5-5",
  usage: { input_tokens: 10, output_tokens: 5 },
  ...extra,
});
const aiCalls = () => readAudit().filter((e) => e.action === "ai_call");
const noFacts = { facts: [] };

describe("live provider", () => {
  test("no key returns no_key and never builds a client", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await runStep("extract_facts", "x", "text", ExtractSchema);
    expect(res).toMatchObject({ ok: false, error: { kind: "no_key" } });
    expect(sdk.constructed).not.toHaveBeenCalled();
    expect(sdk.parse).not.toHaveBeenCalled();
    expect(aiCalls()).toHaveLength(0);
  });

  test("a guard-blocked input never reaches the live provider or the SDK", async () => {
    const spy = vi.spyOn(providers, "live");
    const res = await runStep("extract_facts", "x", "email me: a@b.co", ExtractSchema);
    expect(res).toMatchObject({ ok: false, error: { kind: "guard_blocked" } });
    expect(spy).not.toHaveBeenCalled();
    expect(sdk.constructed).not.toHaveBeenCalled();
    expect(sdk.parse).not.toHaveBeenCalled();
    expect(readAudit().map((e) => e.action)).toEqual(["blocked"]);
  });

  test("calls messages.parse with the model, the skill as system prompt and low effort", async () => {
    sdk.parse.mockResolvedValueOnce(ok(noFacts));
    const res = await runStep("extract_facts", "kijana-q1-test", "the report", ExtractSchema);
    expect(res).toMatchObject({ ok: true, attempt: 1, data: noFacts, failures: [] });

    expect(sdk.constructed).toHaveBeenCalledTimes(1);
    expect(sdk.parse).toHaveBeenCalledTimes(1);
    const args = sdk.parse.mock.calls[0][0];
    expect(args).toMatchObject({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      system: getSkill("extract_facts")!.instruction,
      messages: [{ role: "user", content: "the report" }],
      output_config: { effort: "low", format: { type: "json_schema" } },
    });
    // Both are rejected by this model.
    expect(args).not.toHaveProperty("thinking");
    expect(JSON.stringify(args)).not.toContain("budget_tokens");

    const [call] = aiCalls();
    expect(call.detail).toMatchObject({
      job: "extract_facts",
      key: "kijana-q1-test",
      provider: "live",
      attempt: 1,
      model: "claude-opus-5-5",
      usage: { input_tokens: 10, output_tokens: 5 },
    });
  });

  test("saves the parsed output under DATA_DIR/recordings, named like a replay fixture", async () => {
    sdk.parse.mockResolvedValueOnce(ok(noFacts));
    await runStep("extract_facts", "kijana-q1-test", "the report", ExtractSchema);
    const file = path.join(tmp, "runtime", "recordings", "extract_facts-kijana-q1-test-a1.json");
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(noFacts);
  });

  test("a key that is not a safe file name is still answered, just not recorded", async () => {
    sdk.parse.mockResolvedValueOnce(ok(noFacts));
    const res = await runStep("extract_facts", "../escape", "the report", ExtractSchema);
    expect(res.ok).toBe(true);
    expect(existsSync(path.join(tmp, "runtime", "recordings"))).toBe(false);
    expect(existsSync(path.join(tmp, "escape-a1.json"))).toBe(false);
  });

  test("a refusal is checked before the parsed output", async () => {
    sdk.parse.mockResolvedValueOnce(ok(noFacts, { stop_reason: "refusal" }));
    expect(await runStep("extract_facts", "x", "text", ExtractSchema)).toMatchObject({
      ok: false,
      error: { kind: "refusal" },
    });
  });

  test("a null parsed output is a parse error", async () => {
    sdk.parse.mockResolvedValueOnce(ok(null));
    expect(await runStep("extract_facts", "x", "text", ExtractSchema)).toMatchObject({
      ok: false,
      error: { kind: "parse" },
    });
  });

  test("an SDK parse failure (it throws a plain AnthropicError) is a parse error", async () => {
    sdk.parse.mockRejectedValueOnce(new sdk.AnthropicError("Failed to parse structured output"));
    expect(await runStep("extract_facts", "x", "text", ExtractSchema)).toMatchObject({
      ok: false,
      error: { kind: "parse" },
    });
  });

  test("a connection error is network, and nothing throws", async () => {
    sdk.parse.mockRejectedValueOnce(new sdk.APIConnectionError("Connection error."));
    expect(await runStep("extract_facts", "x", "text", ExtractSchema)).toMatchObject({
      ok: false,
      error: { kind: "network" },
    });
  });

  test("a rejected key is no_key; other API errors are network with the status", async () => {
    sdk.parse.mockRejectedValueOnce(new sdk.APIError("401 invalid x-api-key", 401));
    expect(await runStep("extract_facts", "x", "text", ExtractSchema)).toMatchObject({
      ok: false,
      error: { kind: "no_key" },
    });
    sdk.parse.mockRejectedValueOnce(new sdk.APIError("overloaded", 529));
    const res = await runStep("extract_facts", "x", "text", ExtractSchema);
    expect(res).toMatchObject({ ok: false, error: { kind: "network" } });
    expect(!res.ok && res.error.message).toContain("529");
  });

  test("an unexpected exception still comes back as an AiError", async () => {
    sdk.parse.mockRejectedValueOnce(new TypeError("boom"));
    const res = await runStep("extract_facts", "x", "text", ExtractSchema);
    expect(res).toMatchObject({ ok: false, error: { kind: "network" } });
    expect(!res.ok && res.error.message).toContain("boom");
  });

  test("self-correction: the retry sends the failed checks, both calls are audited and recorded", async () => {
    const bad = { fields: [{ key: "definition_note", value: "72% were fully working", cites: ["pct_full"] }] };
    const good = {
      fields: [{ key: "definition_note", value: "70.3% were fully working", cites: ["pct_full"] }],
    };
    sdk.parse.mockResolvedValueOnce(ok(bad)).mockResolvedValueOnce(ok(good));
    const validate = (d: z.infer<typeof FillSchema>) =>
      d.fields.filter((f) => f.value.includes("72")).map((f) => `${f.key} says 72`);
    const res = await runStep("fill_template", "kijana-q1-test-fdf", "Write it.", FillSchema, { validate });
    expect(res).toMatchObject({ ok: true, attempt: 2, failures: [], data: good });
    expect(sdk.parse.mock.calls[0][0].messages[0].content).toBe("Write it.");
    expect(sdk.parse.mock.calls[1][0].messages[0].content).toBe(
      "Write it.\n\nThese checks failed: definition_note says 72. Fix only these; keep every number as given.",
    );
    expect(aiCalls().map((c) => c.detail.attempt)).toEqual([1, 2]);
    for (const n of [1, 2]) {
      expect(existsSync(path.join(tmp, "runtime", "recordings", `fill_template-kijana-q1-test-fdf-a${n}.json`))).toBe(true);
    }
  });

  test("if the retry call fails, the first draft comes back with its failures", async () => {
    sdk.parse
      .mockResolvedValueOnce(ok(noFacts))
      .mockRejectedValueOnce(new sdk.APIConnectionError("Connection error."));
    const res = await runStep("extract_facts", "x", "text", ExtractSchema, { validate: () => ["red"] });
    expect(res).toMatchObject({ ok: true, attempt: 1, failures: ["red"] });
  });
});
