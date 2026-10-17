import { AsyncLocalStorage } from "node:async_hooks";
import path from "node:path";
import { Pool, type PoolClient } from "pg";

type Transaction = { root: string; namespace: string; files: Map<string, string>; dirty: Set<string>; auditStart: string };
const scope = new AsyncLocalStorage<Transaction>();
let pool: Pool | undefined;
export function storageMode(): "file" | "postgres" {
  const mode = process.env.SYNAPSE_STORAGE || "file";
  if (mode !== "file" && mode !== "postgres") throw new Error("Unknown Synapse storage mode.");
  return mode;
}
export function databasePool() {
  if (!process.env.DATABASE_URL) throw new Error("PostgreSQL mode requires DATABASE_URL on the server.");
  return pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 4, connectionTimeoutMillis: 3000, idleTimeoutMillis: 10000 });
}
export function memoryFile(file: string) {
  const active = scope.getStore();
  if (!active) return null;
  const key = path.relative(active.root, file).replaceAll("\\", "/");
  if (key.startsWith("../") || path.isAbsolute(key)) return null;
  return { active, key };
}
export async function closeDatabase() { if (pool) { await pool.end(); pool = undefined; } }
async function flushAudit(client: PoolClient, tx: Transaction) {
  const text = tx.files.get("audit.jsonl") || "";
  if (!text.startsWith(tx.auditStart)) throw new Error("Audit rewriting is forbidden.");
  for (const line of text.slice(tx.auditStart.length).split("\n").filter(Boolean)) {
    const event = JSON.parse(line);
    await client.query("INSERT INTO synapse_audit(namespace,event_id,payload) VALUES($1,$2,$3)", [tx.namespace, event.id, line]);
  }
}
export async function postgresTransaction<T>(root: string, work: () => Promise<T>): Promise<T> {
  if (scope.getStore()) return work();
  const namespace = process.env.SYNAPSE_NAMESPACE ? process.env.SYNAPSE_NAMESPACE + ":" + path.basename(root) : root;
  const client = await databasePool().connect();
  let committed=false;
  try {
    await client.query("BEGIN");
    // One namespace lock protects both report state and its hash-chained audit across processes.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [namespace]);
    const docs = await client.query<{key:string;content:string}>("SELECT key,content FROM synapse_documents WHERE namespace=$1", [namespace]);
    const audit = await client.query<{payload:string}>("SELECT payload FROM synapse_audit WHERE namespace=$1 ORDER BY sequence", [namespace]);
    const tx: Transaction = { root, namespace, files: new Map(docs.rows.map(row => [row.key, row.content])), dirty: new Set(), auditStart: audit.rows.map(row=>row.payload+"\n").join("") };
    if (tx.auditStart) tx.files.set("audit.jsonl", tx.auditStart);
    let result!: T;
    let failed = false;
    let failure: unknown;
    try { result = await scope.run(tx, work); }
    catch (error) { failed = true; failure = error; }
    // Failed checks retain their attempt audit, but never partially commit report/export changes.
    if (!failed) for (const key of tx.dirty) {
      if (key === "audit.jsonl") continue;
      await client.query("INSERT INTO synapse_documents(namespace,key,content) VALUES($1,$2,$3) ON CONFLICT(namespace,key) DO UPDATE SET content=EXCLUDED.content", [namespace,key,tx.files.get(key)]);
    }
    await flushAudit(client, tx);
    await client.query("COMMIT");
    committed=true;
    if (failed) throw failure;
    return result;
  } catch (error) { if(!committed) await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
