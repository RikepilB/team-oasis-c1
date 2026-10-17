import type { ProviderFn } from "@/lib/harness/run";

// Manual: a person pastes the output of whichever approved tool they used, and the harness runs the
// same schema, rules and approvals on it. The schema check happens in runStep, as for replay.
export const manualProvider: ProviderFn = async ({ manualOutput }) => {
  const fail = (message: string) => ({ ok: false as const, error: { kind: "parse" as const, message } });
  if (!manualOutput?.trim()) return fail("Nothing was pasted. Paste the tool's JSON output and try again.");
  // Chat tools like to wrap JSON in a code fence; the JSON inside is still what was meant.
  const text = manualOutput.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: { kind: "parse", message: `The pasted text is not valid JSON: ${e instanceof Error ? e.message : String(e)}` } };
  }
};
