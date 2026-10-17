import type { z } from "zod";
import { appendAudit } from "@/lib/audit";
import { guardPersonalData } from "@/lib/harness/guard";
import { liveProvider } from "@/lib/harness/providers/live";
import { manualProvider } from "@/lib/harness/providers/manual";
import { replayProvider } from "@/lib/harness/providers/replay";
import { getSkill, isRegistered } from "@/lib/harness/skills";

// The engine. One entry point, runStep: registered skill -> personal-data guard -> provider ->
// schema -> the caller's rule checks -> one retry that feeds the failed checks back -> audit.
// The AI is a pluggable provider behind it (replay | live | manual), not the product.

export type JobName = "extract_facts" | "draft_french" | "fill_template";
export type ProviderName = "replay" | "live" | "manual";

export type AiError = {
  kind: "no_key" | "network" | "refusal" | "parse" | "guard_blocked" | "replay_missing" | "unregistered_skill";
  message: string;
};

export type StepResult<T> =
  | { ok: true; data: T; attempt: 1 | 2; failures: string[] }
  | { ok: false; error: AiError };

export type ProviderArgs = {
  job: JobName;
  key: string;
  attempt: 1 | 2;
  system: string; // the skill's instruction
  input: string;
  schema: z.ZodType<unknown>;
  manualOutput?: string; // only the manual provider reads it
};
export type ProviderResult =
  | { ok: true; data: unknown; usage?: unknown; model?: string }
  | { ok: false; error: AiError };
export type ProviderFn = (args: ProviderArgs) => Promise<ProviderResult>;

// runStep reaches providers through this object at call time, so a test can spy on one.
export const providers: Record<ProviderName, ProviderFn> = {
  replay: replayProvider,
  live: liveProvider,
  manual: manualProvider,
};

export type StepOpts<T> = {
  skillsDir?: string; // where skills are read from; default standard/skills
  provider?: ProviderName; // default: AI_MODE, then replay
  manualOutput?: string; // the pasted output, for the manual provider
  validate?: (data: T) => string[]; // rule checks; each string is one failed check
  record_id?: string; // audit record; default: the key
};

// An unknown AI_MODE runs replay: it is the one mode that cannot reach the network.
function pickProvider(p: ProviderName | undefined): ProviderName {
  const v = (p ?? process.env.AI_MODE ?? "replay").trim().toLowerCase();
  return v === "live" || v === "manual" ? v : "replay";
}

const errorOf = (kind: AiError["kind"], message: string): { ok: false; error: AiError } => ({
  ok: false,
  error: { kind, message },
});

export async function runStep<T>(
  job: JobName,
  key: string,
  input: string,
  schema: z.ZodType<T>,
  opts: StepOpts<T> = {},
): Promise<StepResult<T>> {
  const providerName = pickProvider(opts.provider);
  const record_id = opts.record_id ?? key;

  // 1. Only a registered AI skill runs (constitution Article 8).
  let skill;
  try {
    skill = getSkill(job, opts.skillsDir);
  } catch (e) {
    return errorOf("unregistered_skill", e instanceof Error ? e.message : String(e));
  }
  if (!skill) return errorOf("unregistered_skill", `There is no skill "${job}" to run.`);
  if (skill.kind !== "ai") return errorOf("unregistered_skill", `Skill "${job}" is a code skill; it does not call a model.`);
  if (!isRegistered(skill) || !skill.instruction) {
    return errorOf(
      "unregistered_skill",
      `Skill "${job}" is not registered. It needs an owner, a data class, a tier, an approver and an instruction before it can run.`,
    );
  }
  const system = skill.instruction;
  const skill_version = skill.version;

  // 2. Personal data never reaches a provider. The retry input is checked too: it carries failure
  //    messages built from the model's own output.
  const blocked = (text: string): AiError | null => {
    const g = guardPersonalData(text);
    if (g.ok) return null;
    appendAudit({ actor: "system", action: "blocked", record_id, detail: { job, matches: g.matches } });
    return {
      kind: "guard_blocked",
      message: `Personal data found (${g.matches.join(", ")}). Remove it from the report and try again.`,
    };
  };
  const guardError = blocked(input);
  if (guardError) return { ok: false, error: guardError };

  // One provider call, audited, then checked against the schema and the caller's rules.
  const attempt = async (
    n: 1 | 2,
    text: string,
  ): Promise<{ ok: true; data: T; failures: string[] } | { ok: false; error: AiError }> => {
    let res: ProviderResult;
    try {
      res = await providers[providerName]({
        job,
        key,
        attempt: n,
        system,
        input: text,
        schema,
        manualOutput: opts.manualOutput,
      });
    } catch (e) {
      res = {
        ok: false,
        error: {
          kind: providerName === "live" ? "network" : "parse",
          message: `Unexpected error: ${e instanceof Error ? e.message : String(e)}`,
        },
      };
    }
    // Nothing was sent and nothing was replayed, so there is no call to record.
    if (!res.ok && (res.error.kind === "no_key" || res.error.kind === "replay_missing")) return res;
    appendAudit({
      actor: "system",
      action: "ai_call",
      record_id,
      detail: {
        job,
        key,
        provider: providerName,
        attempt: n,
        skill_version,
        ...(res.ok ? {} : { error: res.error.kind }),
        ...(res.ok && res.model !== undefined ? { model: res.model } : {}),
        ...(res.ok && res.usage !== undefined ? { usage: res.usage } : {}),
      },
    });
    if (!res.ok) return res;
    const parsed = schema.safeParse(res.data);
    if (!parsed.success) {
      const issues = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
      return errorOf("parse", `The ${job} output does not match its schema (${issues.join("; ")}).`);
    }
    return { ok: true, data: parsed.data, failures: opts.validate?.(parsed.data) ?? [] };
  };

  // 3. Attempt 1.
  const a1 = await attempt(1, input);
  if (!a1.ok) return a1;
  const done1: StepResult<T> = { ok: true, data: a1.data, attempt: 1, failures: a1.failures };
  // Manual output is a person's paste: they fix it, the harness does not ask a second time.
  if (a1.failures.length === 0 || providerName === "manual") return done1;

  // 4. One automatic retry that says what failed. If it cannot run (no a2 recording, a dropped
  //    connection, unreadable output), the first draft comes back with its failures: red checks the
  //    person sees are better than an error that hides the draft.
  const retryInput = `${input}\n\nThese checks failed: ${a1.failures.join("; ")}. Fix only these; keep every number as given.`;
  if (blocked(retryInput)) return done1;
  const a2 = await attempt(2, retryInput);
  if (!a2.ok) return done1;
  return { ok: true, data: a2.data, attempt: 2, failures: a2.failures };
}
