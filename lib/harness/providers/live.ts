import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ProviderFn, ProviderResult } from "@/lib/harness/run";
import { dataDir, isRecordId } from "@/lib/record/store";

// Live calls Claude. This is the only file that imports the SDK: it stands in for the approved
// Workspace Suite add-on, and swapping the tool means swapping this file.
export const MODEL = "claude-opus-5-5";

const fail = (kind: "no_key" | "network" | "refusal" | "parse", message: string): ProviderResult => ({
  ok: false,
  error: { kind, message },
});

// Every way a call can end becomes an AiError the screen shows with Retry; nothing throws.
function fromError(e: unknown): ProviderResult {
  if (e instanceof Anthropic.APIConnectionError) {
    return fail("network", "Could not reach the AI service. Check the connection and retry, or switch to replay.");
  }
  if (e instanceof Anthropic.APIError) {
    const status = e.status;
    if (status === 401 || status === 403) return fail("no_key", `The API key was rejected (${status}). Check ANTHROPIC_API_KEY.`);
    // No AiError kind fits a rate limit or a server error better than "network": retry later.
    return fail("network", `The AI service returned an error (${status ?? "no status"}): ${e.message}`);
  }
  // The SDK throws a plain AnthropicError when the answer is not JSON or does not fit the schema.
  if (e instanceof Anthropic.AnthropicError) return fail("parse", e.message);
  return fail("network", `Unexpected error: ${e instanceof Error ? e.message : String(e)}`);
}

// A good recording refreshes the demo: copy it from data/runtime/recordings/ into data/fixtures/ai/.
// It carries the replay file name, so that is all it takes.
function record(job: string, key: string, attempt: number, data: unknown): void {
  if (!isRecordId(key)) return;
  try {
    const dir = path.join(dataDir(), "recordings");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, `${job}-${key}-a${attempt}.json`), JSON.stringify(data, null, 2) + "\n");
  } catch {
    // A recording is a convenience; a full disk must not turn a good answer into a failed step.
  }
}

export const liveProvider: ProviderFn = async ({ job, key, attempt, system, input, schema }) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return fail("no_key", "No ANTHROPIC_API_KEY is set. Add it to .env.local, or switch to replay or manual.");
  }
  try {
    const client = new Anthropic(); // built only now, after the key check
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system,
      output_config: { effort: "low", format: zodOutputFormat(schema) },
      messages: [{ role: "user", content: input }],
    });
    // A refusal first: its content is not the answer, whatever parsed_output holds.
    if (response.stop_reason === "refusal") {
      return fail("refusal", "The model declined this request. Edit the input and retry, or switch provider.");
    }
    if (response.parsed_output == null) return fail("parse", "The model's answer did not match the expected shape.");
    record(job, key, attempt, response.parsed_output);
    return { ok: true, data: response.parsed_output, usage: response.usage, model: response.model };
  } catch (e) {
    return fromError(e);
  }
};
