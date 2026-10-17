import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { packDir } from "@/lib/kijana/load";
import { FactRecord } from "@/lib/types";

// Where the app keeps what it writes: fact records, the audit log and exports. Read at call time
// so a test can point it at a temp folder.
export function dataDir(): string {
  return process.env.DATA_DIR ?? "data/runtime";
}

export function inboxDir(): string {
  return path.join(packDir(), "inbox");
}

// One inbox item is two files with the same stem: `<id>.txt` (the report) and `<id>.json` (this).
const Sidecar = z.object({
  project: z.string(),
  funder: z.string(),
  received_date: z.string(),
  source_file: z.string(),
  source_location: z.string(),
  period: z.string(),
  period_end: z.string(),
});
export type Sidecar = z.infer<typeof Sidecar>;

// A record id is an inbox file stem and becomes a file name under data/runtime, so anything that
// could climb out of that folder is refused here, once, for every caller.
export function isRecordId(id: string): boolean {
  return /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/.test(id);
}

function assertRecordId(id: string): void {
  if (!isRecordId(id)) throw new Error(`"${id}" is not a valid record id`);
}

// The inbox item behind a record id, or null when the inbox has no such pair of files. The sidecar
// is validated; a malformed one is an error naming the file, never a silent skip.
export function readSource(id: string): { sidecar: Sidecar; text: string } | null {
  assertRecordId(id);
  const meta = path.join(inboxDir(), `${id}.json`);
  const report = path.join(inboxDir(), `${id}.txt`);
  if (!existsSync(meta) || !existsSync(report)) return null;
  let sidecar: Sidecar;
  try {
    sidecar = Sidecar.parse(JSON.parse(readFileSync(meta, "utf8").replace(/^﻿/, "")));
  } catch (e) {
    throw new Error(`${id}.json: ${e instanceof Error ? e.message : String(e)}`);
  }
  return { sidecar, text: readFileSync(report, "utf8") };
}

function factFile(id: string): string {
  assertRecordId(id);
  return path.join(dataDir(), "facts", `${id}.json`);
}

function writeRecord(record: FactRecord): void {
  const file = factFile(record.record_id);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(record, null, 2) + "\n");
}

// The stored record, or null when none has been created yet. A stored file that fails the schema is
// an error: recreating it would throw away the work in it.
export function readRecord(id: string): FactRecord | null {
  const file = factFile(id);
  if (!existsSync(file)) return null;
  try {
    return FactRecord.parse(JSON.parse(readFileSync(file, "utf8")));
  } catch (e) {
    throw new Error(`${path.basename(file)}: not a valid Fact Record (${e instanceof Error ? e.message : String(e)})`);
  }
}

// The stored record, created and saved from the inbox item the first time it is asked for.
export function getOrCreateRecord(id: string): FactRecord {
  const stored = readRecord(id);
  if (stored) return stored;
  const source = readSource(id);
  if (!source) throw new Error(`"${id}" is not in the inbox`);
  const { sidecar, text } = source;
  const record = FactRecord.parse({
    record_id: id,
    source_file: sidecar.source_file,
    original_text: text,
    received_date: sidecar.received_date,
    source_location: sidecar.source_location,
    period: sidecar.period,
    period_end: sidecar.period_end,
    facts: [],
    changes: [],
    metrics: [],
    french: null,
    templates: {},
  });
  writeRecord(record);
  return record;
}

// Every write of a Fact Record goes through here. The report text is never taken from the caller:
// it is the stored one, or (first save) the inbox file's. The caller's `original_text` is used only
// for an id that has neither.
export function saveRecord(r: FactRecord): void {
  assertRecordId(r.record_id);
  const original = readRecord(r.record_id)?.original_text ?? readSource(r.record_id)?.text ?? r.original_text;
  writeRecord(FactRecord.parse({ ...r, original_text: original }));
}
