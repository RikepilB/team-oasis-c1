import { createHash } from "node:crypto";
import { EvidenceView } from "@/lib/demo/types";
import { context } from "@/lib/demo/store";
import { getEvidence } from "@/lib/demo/workflow";

// Redis is disposable read acceleration. Decisions and exports never use this path.
export function redisConfigured() {
  return !!((process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) && (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN));
}
async function command(args: (string | number)[]): Promise<unknown> {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token || new URL(url).protocol !== "https:") return null;
  const response = await fetch(url, { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(args), cache: "no-store", signal: AbortSignal.timeout(600) });
  if (!response.ok) throw new Error("Cache request failed.");
  const value = await response.json();
  if (value.error) throw new Error("Cache command failed.");
  return value.result;
}
export async function cachedEvidence(query: Parameters<typeof getEvidence>[0] = {}) {
  if (!query.snapshot || !redisConfigured()) return { data: await getEvidence(query), cache: "bypass" };
  const c = context();
  const identity = JSON.stringify(["evidence-v1", process.env.SYNAPSE_NAMESPACE || c.runtime, c.identity, Object.entries(query).sort(([a],[b])=>a.localeCompare(b))]);
  const key = "synapse:evidence:" + createHash("sha256").update(identity).digest("hex");
  let reachable = true;
  try {
    const raw = await command(["GET", key]);
    if (typeof raw === "string" && raw.length < 1_000_000) {
      const parsed = EvidenceView.safeParse(JSON.parse(raw));
      if (parsed.success && parsed.data.snapshot_id === query.snapshot && (!query.cutoff || parsed.data.cutoff === query.cutoff)) return { data: parsed.data, cache: "hit" };
    }
  } catch { reachable = false; /* A cache outage must not hide PostgreSQL evidence. */ }
  const data = await getEvidence(query);
  const text = JSON.stringify(data);
  if (reachable && text.length < 1_000_000) try { await command(["SET", key, text, "EX", 3600]); } catch { /* The primary result remains valid. */ }
  return { data, cache: "miss" };
}
