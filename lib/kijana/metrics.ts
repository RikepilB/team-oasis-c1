import path from "node:path";
import { cleanKijana } from "@/lib/kijana/clean";
import { hasPackData, loadKijana, packDir } from "@/lib/kijana/load";
import type {
  CleaningReport,
  CleanResult,
  FunctionalityCounts,
  MetricRef,
  PriorityGroup,
  Visit,
  WaterPoint,
  WaterPointStatus,
} from "@/lib/types";

// Every number the app shows about the water points comes from this file (architecture section 8).

// Per point, the visit with the greatest (visit_date, visit_id) on or before the cutoff. ISO dates
// compare correctly as strings. Repair and test come from that visit alone (decision D7). A point
// with no visit by the cutoff has no status and is left out. Output follows the order of `points`.
export function latestStatus(points: WaterPoint[], visits: Visit[], cutoff: string): WaterPointStatus[] {
  const latest = new Map<string, Visit>();
  for (const v of visits) {
    if (v.visit_date > cutoff) continue;
    const best = latest.get(v.water_point_id);
    if (!best || v.visit_date > best.visit_date || (v.visit_date === best.visit_date && v.visit_id > best.visit_id)) {
      latest.set(v.water_point_id, v);
    }
  }

  const out: WaterPointStatus[] = [];
  for (const p of points) {
    const v = latest.get(p.id);
    if (!v) continue;
    out.push({
      id: p.id,
      district: p.district,
      settlement: p.settlement,
      status: v.status,
      repair_recorded: v.repair_completed === "Y",
      latest_test: v.water_quality_test,
      latest_visit_date: v.visit_date,
    });
  }
  return out;
}

// One decimal, e.g. 0.703125 -> 70.3. No points reads as 0 rather than NaN.
const pct = (n: number, total: number): number => (total === 0 ? 0 : Math.round((n / total) * 1000) / 10);

// The two headline numbers: fully working, and fully plus partly working.
export function countFunctionality(s: WaterPointStatus[]): FunctionalityCounts {
  const fully = s.filter((p) => p.status === "working").length;
  const partly = s.filter((p) => p.status === "partly").length;
  const not = s.filter((p) => p.status === "not_working").length;
  return {
    total: s.length,
    fully_working: fully,
    partly_working: partly,
    not_working: not,
    pct_full: pct(fully, s.length),
    pct_incl_partly: pct(fully + partly, s.length),
  };
}

// First matching rule wins, so a not-working point with a failed test is a fast-track repair, not
// an unsafe-water case.
export function groupOf(s: WaterPointStatus): PriorityGroup {
  if (s.status === "not_working" && !s.repair_recorded) return "red_fast_track";
  if (s.latest_test === "fail") return "red_unsafe";
  if (s.status === "partly") return "amber_partly";
  if (s.status === "not_working") return "amber_repair_recorded";
  return "green";
}

export function priorityGroups(s: WaterPointStatus[]): Record<PriorityGroup, WaterPointStatus[]> {
  const groups: Record<PriorityGroup, WaterPointStatus[]> = {
    red_fast_track: [],
    red_unsafe: [],
    amber_partly: [],
    amber_repair_recorded: [],
    green: [],
  };
  for (const p of s) groups[groupOf(p)].push(p);
  return groups;
}

// "Behind" means the points the percentage counts as working: working only, or working plus partly.
export function pointsBehind(s: WaterPointStatus[], definition: "full_only" | "incl_partly"): WaterPointStatus[] {
  return s.filter((p) => p.status === "working" || (definition === "incl_partly" && p.status === "partly"));
}

// One citable ref per metric id, so a template field can point at a number computed here.
export function metricRefs(s: WaterPointStatus[], cutoff: string): MetricRef[] {
  const c = countFunctionality(s);
  return [
    { metric_id: "pct_full", cutoff, value: c.pct_full },
    { metric_id: "pct_incl_partly", cutoff, value: c.pct_incl_partly },
    { metric_id: "count_total", cutoff, value: c.total },
    { metric_id: "count_full", cutoff, value: c.fully_working },
    { metric_id: "count_partly", cutoff, value: c.partly_working },
    { metric_id: "count_not", cutoff, value: c.not_working },
  ];
}

export type Snapshot = { statuses: WaterPointStatus[]; counts: FunctionalityCounts; report: CleaningReport };

// The pack is parsed once per folder and each cutoff computed once. Both keys use the resolved
// folder, read at call time, so a test that changes PACK_DIR gets fresh data.
const cleaned = new Map<string, CleanResult>();
const snapshots = new Map<string, Snapshot>();

export function getSnapshot(cutoff: string): Snapshot {
  const dir = path.resolve(packDir());
  const key = `${dir}\n${cutoff}`;
  const hit = snapshots.get(key);
  if (hit) return hit;

  if (!hasPackData()) throw new Error("pack data missing");
  let data = cleaned.get(dir);
  if (!data) {
    data = cleanKijana(loadKijana(dir));
    cleaned.set(dir, data);
  }
  const statuses = latestStatus(data.points, data.visits, cutoff);
  const snapshot: Snapshot = { statuses, counts: countFunctionality(statuses), report: data.report };
  snapshots.set(key, snapshot);
  return snapshot;
}
