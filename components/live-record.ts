"use client";
import { useSyncExternalStore } from "react";
import { api, useRemote } from "@/components/shell";
import type { DemoRecord } from "@/lib/demo/types";

// One copy of each open report, shared by the report page and the assistant,
// so a decision made in one shows in the other at once.
const records = new Map<string, DemoRecord>();
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export function publishRecord(r: DemoRecord) { records.set(r.record_id, r); listeners.forEach(l => l()); }

export function useLiveRecord(id: string) {
  const remote = useRemote<DemoRecord>("/api/reports/" + encodeURIComponent(id));
  const live = useSyncExternalStore(subscribe, () => records.get(id) ?? null, () => null);
  // Whichever copy is newer wins: a fresh fetch after another tab's change, or this tab's last action.
  const record = !live ? remote.data : !remote.data || live.revision >= remote.data.revision ? live : remote.data;
  return { record, loading: remote.loading && !live, error: remote.error };
}

export async function runRecordAction(id: string, step: string, body: Record<string, unknown>) {
  const next = await api<DemoRecord>("/api/reports/" + encodeURIComponent(id) + "/" + step, body);
  publishRecord(next);
  return next;
}
