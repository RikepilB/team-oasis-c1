import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import { Dataset, DemoError, type AuditEvent } from "@/lib/demo/types";
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const readJson = (file: string) => JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
export function safeId(id: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(id))
    throw new DemoError("invalid_id", "Invalid record or snapshot identifier."); return id;
}
export function atomic(file: string, value: unknown) {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + "." + randomUUID() + ".tmp";
  writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
  renameSync(tmp, file);
}
export function context() {
  const dir = path.resolve(process.env.AQUIFER_DATA_DIR || (existsSync("data/pack/dataset.json") ? "data/pack" : "data/fixtures/demo"));
  if (!existsSync(path.join(dir, "dataset.json")))
    throw new DemoError("data_missing", "Demo dataset is missing.", 503);
  const dataset = Dataset.parse(readJson(path.join(dir, "dataset.json")));
  const csv = path.resolve(dir, dataset.csv_dir);
  const identity = hash([dir, readFileSync(path.join(dir, "dataset.json"), "utf8"), ...["kijana_water_points.csv", "kijana_monitoring_visits.csv"].map(f => readFileSync(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ csv, f), "utf8")),
    ...readdirSync(path.join(dir, "inbox")).sort().filter(f => /\.(json|txt)$/.test(f)).map(f => readFileSync(path.join(dir, "inbox", f), "utf8"))].join("\n")).slice(0, 20);
  const runtime = path.resolve(process.env.AQUIFER_RUNTIME_DIR || "data/runtime", "aquifer-" + identity);
  return { dir, csv, dataset, runtime, identity };
}
export type Context = ReturnType<typeof context>;
const queues = (globalThis as typeof globalThis & {
  aquiferQueues?: Map<string, Promise<unknown>>;
}).aquiferQueues ??= new Map();
export async function serialized<T>(key: string, work: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) || Promise.resolve();
  const current = previous.catch(() => { }).then(work);
  queues.set(key, current);
  try {
    return await current;
  }
  finally {
    if (queues.get(key) === current)
      queues.delete(key);
  }
}
export function auditEntries(c: Context): AuditEvent[] {
  const file = path.join(c.runtime, "audit.jsonl");
  if (!existsSync(file))
    return [];
  return readFileSync(file, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));
}
export function chainValid(entries: AuditEvent[]) {
  let previous: string | null = null;
  for (const entry of entries) {
    const { hash: stored, ...body } = entry;
    if (body.prev_hash !== previous || hash(JSON.stringify(body)) !== stored)
      return false;
    previous = stored;
  }
  return true;
}
export function audit(c: Context, actor: string, action: string, record_id: string | null, detail: Record<string, unknown>) {
  const entries = auditEntries(c);
  if (!chainValid(entries))
    throw new DemoError("audit_corrupt", "Audit integrity failed. Further changes are blocked.", 409);
  const body = { id: randomUUID(), at: new Date().toISOString(), actor, action, record_id, detail, prev_hash: entries.at(-1)?.hash ?? null };
  const event = { ...body, hash: hash(JSON.stringify(body)) };
  mkdirSync(c.runtime, { recursive: true });
  writeFileSync(path.join(c.runtime, "audit.jsonl"), JSON.stringify(event) + "\n", { encoding: "utf8", flag: "a" });
  return event;
}
