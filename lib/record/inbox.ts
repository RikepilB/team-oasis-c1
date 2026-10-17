import { existsSync, readdirSync } from "node:fs";
import { inboxDir, isRecordId, readRecord, readSource } from "@/lib/record/store";
import type { FactRecord, InboxItem, InboxStatus } from "@/lib/types";

// An item's status is read off its stored record, never kept in a second place. Strongest first:
// a sent template, an approved one, any template, a French draft, any facts. No record yet is `new`.
// `cleaned` is not derived: nothing on the record marks the cleaning step done (it can finish with
// no changes), so a record that has been cleaned reads as `extracted` until it has more.
export function statusOf(r: FactRecord): InboxStatus {
  const templates = Object.values(r.templates);
  if (templates.some((t) => t?.approval?.sent_at)) return "sent";
  if (templates.some((t) => t?.approval)) return "approved";
  if (templates.length > 0) return "filled";
  if (r.french) return "translated";
  if (r.facts.length > 0) return "extracted";
  return "new";
}

// The reports waiting in `${PACK_DIR}/inbox`, ordered by id. A sidecar without its report is not
// an item. A missing folder is an empty inbox.
export function listInbox(): InboxItem[] {
  const dir = inboxDir();
  if (!existsSync(dir)) return [];
  const ids = readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.slice(0, -".json".length))
    .filter(isRecordId)
    .sort();
  const items: InboxItem[] = [];
  for (const id of ids) {
    const source = readSource(id);
    if (!source) continue;
    const stored = readRecord(id);
    items.push({
      id,
      project: source.sidecar.project,
      funder: source.sidecar.funder,
      received_date: source.sidecar.received_date,
      status: stored ? statusOf(stored) : "new",
    });
  }
  return items;
}
