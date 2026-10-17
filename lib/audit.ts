import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { dataDir } from "@/lib/record/store";
import { AuditEntry } from "@/lib/types";

// The audit log is one JSON line per event, appended and never rewritten. Each entry stores the
// hash of the one before it (SOC 2 CC7.2), so editing or deleting a line is detectable.
//
// hash = sha256(prev_hash + JSON of the entry without its hash). The first entry has prev_hash
// null, which counts as "" (not the string "null"). appendAudit builds keys in the fixed order
// at, actor, action, record_id, detail, prev_hash, hash; JSON.parse and JSON.stringify keep that
// order, so verifyAuditChain rebuilds the same bytes from the raw line.

const auditFile = () => path.join(dataDir(), "audit.jsonl");

function hashOf(withoutHash: Record<string, unknown>): string {
  const prev = typeof withoutHash.prev_hash === "string" ? withoutHash.prev_hash : "";
  return createHash("sha256")
    .update(prev + JSON.stringify(withoutHash))
    .digest("hex");
}

function readText(file: string): string {
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

const toLines = (text: string): string[] => text.split("\n").filter((line) => line.trim() !== "");

// The hash to chain the next entry to. A last line that cannot be read stops the append: chaining
// past it would hide the damage that verifyAuditChain is there to report.
function lastHash(lines: string[]): string | null {
  if (lines.length === 0) return null;
  try {
    const last = JSON.parse(lines[lines.length - 1]) as { hash?: unknown };
    if (typeof last.hash === "string") return last.hash;
  } catch {
    // falls through to the error below
  }
  throw new Error("audit.jsonl: the last line is not a valid entry; not appending to a damaged log");
}

export function appendAudit(e: Omit<AuditEntry, "at" | "hash" | "prev_hash">): AuditEntry {
  const file = auditFile();
  mkdirSync(path.dirname(file), { recursive: true });
  const text = readText(file);
  const withoutHash = {
    at: new Date().toISOString(),
    actor: e.actor,
    action: e.action,
    record_id: e.record_id,
    detail: e.detail,
    prev_hash: lastHash(toLines(text)),
  };
  const entry: AuditEntry = { ...withoutHash, hash: hashOf(withoutHash) };
  // A file that lost its final newline would otherwise glue this entry onto the last line.
  const needsBreak = text !== "" && !text.endsWith("\n");
  appendFileSync(file, (needsBreak ? "\n" : "") + JSON.stringify(entry) + "\n");
  return entry;
}

// Every entry in the file, in order. A line that is not a valid entry throws, naming the line;
// verifyAuditChain does not throw, so a screen can call it first and report the break.
export function readAudit(): AuditEntry[] {
  return toLines(readText(auditFile())).map((line, i) => {
    try {
      return AuditEntry.parse(JSON.parse(line));
    } catch (e) {
      throw new Error(`audit.jsonl line ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
    }
  });
}

// Re-reads the file and recomputes every hash. `entries` is the number of lines. `broken_at` is
// the 0-based index (the same index as in readAudit()) of the first line that is not valid JSON,
// does not link to the line before it, or whose hash does not match its content; null when the
// whole chain holds. A tail cut off cleanly cannot be detected by any hash chain.
export function verifyAuditChain(): { ok: boolean; entries: number; broken_at: number | null } {
  const lines = toLines(readText(auditFile()));
  let prevHash: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    let raw: unknown;
    try {
      raw = JSON.parse(lines[i]);
    } catch {
      return { ok: false, entries: lines.length, broken_at: i };
    }
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return { ok: false, entries: lines.length, broken_at: i };
    }
    const { hash, ...withoutHash } = raw as Record<string, unknown>;
    if (typeof hash !== "string" || withoutHash.prev_hash !== prevHash || hashOf(withoutHash) !== hash) {
      return { ok: false, entries: lines.length, broken_at: i };
    }
    prevHash = hash;
  }
  return { ok: true, entries: lines.length, broken_at: null };
}
