import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { hasPackData } from "@/lib/kijana/load";
import {
  countFunctionality,
  getSnapshot,
  groupOf,
  latestStatus,
  metricRefs,
  pointsBehind,
  priorityGroups,
} from "@/lib/kijana/metrics";
import type { Visit, VisitStatus, WaterPoint, WaterPointStatus } from "@/lib/types";

const point = (id: string): WaterPoint => ({
  id,
  district: "Mvua",
  settlement: `Settlement ${id}`,
  type: "Borehole",
  sensor_installed: false,
});

const visit = (over: Partial<Visit> & Pick<Visit, "visit_id" | "visit_date">): Visit => ({
  water_point_id: "KJ-FIX-0001",
  status: "working",
  water_quality_test: "not_tested",
  repair_completed: "",
  ...over,
});

const base: WaterPointStatus = {
  id: "KJ-FIX-0001",
  district: "Mvua",
  settlement: "Settlement KJ-FIX-0001",
  status: "working",
  repair_recorded: false,
  latest_test: "not_tested",
  latest_visit_date: "2026-05-01",
};

// A list of statuses with the given mix, ids KJ-GEN-0001 upward.
function make(mix: Partial<Record<VisitStatus, number>>): WaterPointStatus[] {
  const out: WaterPointStatus[] = [];
  for (const status of ["working", "partly", "not_working"] as const) {
    for (let i = 0; i < (mix[status] ?? 0); i++) {
      out.push({ ...base, id: `KJ-GEN-${String(out.length + 1).padStart(4, "0")}`, status });
    }
  }
  return out;
}

describe("latestStatus", () => {
  const points = [point("KJ-FIX-0001")];
  const visits: Visit[] = [
    visit({ visit_id: 10, visit_date: "2026-05-01", status: "working" }),
    visit({ visit_id: 11, visit_date: "2026-05-01", status: "not_working" }),
    visit({ visit_id: 12, visit_date: "2026-07-02", status: "working" }),
  ];

  test("latest visit wins; ties broken by higher visit_id; visits after cutoff ignored", () => {
    const s = latestStatus(points, visits, "2026-06-30").find((p) => p.id === "KJ-FIX-0001")!;
    expect(s.status).toBe("not_working");
    expect(s.latest_visit_date).toBe("2026-05-01");
  });

  test("a later visit replaces an earlier one once the cutoff passes it", () => {
    const s = latestStatus(points, visits, "2026-07-02").find((p) => p.id === "KJ-FIX-0001")!;
    expect(s.status).toBe("working");
    expect(s.latest_visit_date).toBe("2026-07-02");
  });

  test("a visit dated exactly on the cutoff counts", () => {
    const s = latestStatus(points, visits, "2026-05-01")[0];
    expect(s.status).toBe("not_working");
  });

  test("the input order of visits does not change the result", () => {
    const s = latestStatus(points, [...visits].reverse(), "2026-06-30")[0];
    expect(s.status).toBe("not_working");
  });

  test("a point with no visit on or before the cutoff is left out", () => {
    expect(latestStatus(points, visits, "2026-04-30")).toEqual([]);
  });

  test("a visit to a point that is not in the list is ignored", () => {
    const stray = visit({ visit_id: 99, visit_date: "2026-05-02", water_point_id: "KJ-NOPE-9999" });
    expect(latestStatus(points, [...visits, stray], "2026-06-30")).toHaveLength(1);
  });

  test("district and settlement come from the point; one status per point, in point order", () => {
    const two = [point("KJ-FIX-0002"), point("KJ-FIX-0001")];
    const v = [
      ...visits,
      visit({ visit_id: 20, visit_date: "2026-01-01", water_point_id: "KJ-FIX-0002", status: "partly" }),
    ];
    const s = latestStatus(two, v, "2026-06-30");
    expect(s.map((x) => x.id)).toEqual(["KJ-FIX-0002", "KJ-FIX-0001"]);
    expect(s[0]).toMatchObject({ district: "Mvua", settlement: "Settlement KJ-FIX-0002", status: "partly" });
  });

  test("repair_recorded and latest_test come from the latest visit only (D7)", () => {
    const v: Visit[] = [
      visit({ visit_id: 1, visit_date: "2026-01-01", status: "not_working", water_quality_test: "fail", repair_completed: "Y" }),
      visit({ visit_id: 2, visit_date: "2026-02-01", status: "not_working", water_quality_test: "not_tested", repair_completed: "N" }),
    ];
    expect(latestStatus(points, v, "2026-06-30")[0]).toMatchObject({
      repair_recorded: false,
      latest_test: "not_tested",
    });
    const w: Visit[] = [
      visit({ visit_id: 1, visit_date: "2026-01-01", status: "not_working", repair_completed: "N" }),
      visit({ visit_id: 2, visit_date: "2026-02-01", status: "working", water_quality_test: "pass", repair_completed: "Y" }),
    ];
    expect(latestStatus(points, w, "2026-06-30")[0]).toMatchObject({
      repair_recorded: true,
      latest_test: "pass",
    });
  });

  test("a blank repair answer reads as no repair recorded", () => {
    const v = [visit({ visit_id: 1, visit_date: "2026-01-01", status: "not_working", repair_completed: "" })];
    expect(latestStatus(points, v, "2026-06-30")[0].repair_recorded).toBe(false);
  });
});

describe("countFunctionality", () => {
  test("two counts round to one decimal", () => {
    expect(countFunctionality(make({ working: 225, partly: 48, not_working: 47 }))).toEqual({
      total: 320,
      fully_working: 225,
      partly_working: 48,
      not_working: 47,
      pct_full: 70.3,
      pct_incl_partly: 85.3,
    });
  });

  test("the earlier quarter rounds the same way", () => {
    expect(countFunctionality(make({ working: 220, partly: 48, not_working: 52 }))).toMatchObject({
      pct_full: 68.8,
      pct_incl_partly: 83.8,
    });
  });

  test("no points gives zeros, not NaN", () => {
    expect(countFunctionality([])).toEqual({
      total: 0,
      fully_working: 0,
      partly_working: 0,
      not_working: 0,
      pct_full: 0,
      pct_incl_partly: 0,
    });
  });
});

describe("groupOf", () => {
  test("first matching group rule wins", () => {
    expect(groupOf({ ...base, status: "not_working", repair_recorded: false, latest_test: "fail" })).toBe("red_fast_track");
    expect(groupOf({ ...base, status: "working", latest_test: "fail" })).toBe("red_unsafe");
    expect(groupOf({ ...base, status: "partly", latest_test: "pass" })).toBe("amber_partly");
    expect(groupOf({ ...base, status: "not_working", repair_recorded: true })).toBe("amber_repair_recorded");
    expect(groupOf({ ...base, status: "working", latest_test: "not_tested" })).toBe("green");
  });

  test("a failed test outranks partly and a recorded repair", () => {
    expect(groupOf({ ...base, status: "partly", latest_test: "fail" })).toBe("red_unsafe");
    expect(groupOf({ ...base, status: "not_working", repair_recorded: true, latest_test: "fail" })).toBe("red_unsafe");
  });

  test("a passed or missing test on a working point is green", () => {
    expect(groupOf({ ...base, status: "working", latest_test: "pass" })).toBe("green");
    expect(groupOf({ ...base, status: "working", repair_recorded: true })).toBe("green");
  });
});

describe("priorityGroups and pointsBehind", () => {
  const rows: WaterPointStatus[] = [
    { ...base, id: "A", status: "not_working", repair_recorded: false },
    { ...base, id: "B", status: "working", latest_test: "fail" },
    { ...base, id: "C", status: "partly" },
    { ...base, id: "D", status: "not_working", repair_recorded: true },
    { ...base, id: "E", status: "working" },
    { ...base, id: "F", status: "working", latest_test: "pass" },
  ];

  test("every group key is present and each point lands in exactly one", () => {
    const g = priorityGroups(rows);
    expect(Object.keys(g)).toEqual(["red_fast_track", "red_unsafe", "amber_partly", "amber_repair_recorded", "green"]);
    expect(g.red_fast_track.map((p) => p.id)).toEqual(["A"]);
    expect(g.red_unsafe.map((p) => p.id)).toEqual(["B"]);
    expect(g.amber_partly.map((p) => p.id)).toEqual(["C"]);
    expect(g.amber_repair_recorded.map((p) => p.id)).toEqual(["D"]);
    expect(g.green.map((p) => p.id)).toEqual(["E", "F"]);
  });

  test("no points gives five empty groups", () => {
    const g = priorityGroups([]);
    expect(Object.values(g).map((x) => x.length)).toEqual([0, 0, 0, 0, 0]);
  });

  test("pointsBehind: full_only is the working points, incl_partly adds the partly ones", () => {
    expect(pointsBehind(rows, "full_only").map((p) => p.id)).toEqual(["B", "E", "F"]);
    expect(pointsBehind(rows, "incl_partly").map((p) => p.id)).toEqual(["B", "C", "E", "F"]);
  });
});

describe("metricRefs", () => {
  test("one ref per metric id, values from the counts, all carrying the cutoff", () => {
    const refs = metricRefs(make({ working: 225, partly: 48, not_working: 47 }), "2026-06-30");
    expect(refs).toEqual([
      { metric_id: "pct_full", cutoff: "2026-06-30", value: 70.3 },
      { metric_id: "pct_incl_partly", cutoff: "2026-06-30", value: 85.3 },
      { metric_id: "count_total", cutoff: "2026-06-30", value: 320 },
      { metric_id: "count_full", cutoff: "2026-06-30", value: 225 },
      { metric_id: "count_partly", cutoff: "2026-06-30", value: 48 },
      { metric_id: "count_not", cutoff: "2026-06-30", value: 47 },
    ]);
  });
});

describe("getSnapshot", () => {
  let tmp: string;
  let savedPackDir: string | undefined;

  beforeEach(() => {
    tmp = mkdtempSync(path.join(tmpdir(), "kijana-metrics-"));
    savedPackDir = process.env.PACK_DIR;
  });

  afterEach(() => {
    if (savedPackDir === undefined) delete process.env.PACK_DIR;
    else process.env.PACK_DIR = savedPackDir;
    rmSync(tmp, { recursive: true, force: true });
  });

  test("throws 'pack data missing' when the pack CSVs are not there", () => {
    process.env.PACK_DIR = tmp;
    expect(() => getSnapshot("2026-06-30")).toThrow(new Error("pack data missing"));
  });

  test("reads PACK_DIR at call time and returns statuses, counts and the cleaning report", () => {
    process.env.PACK_DIR = "data/fixtures";
    const s = getSnapshot("2026-04-30");
    expect(s.counts).toEqual({
      total: 5,
      fully_working: 2,
      partly_working: 1,
      not_working: 2,
      pct_full: 40,
      pct_incl_partly: 60,
    });
    expect(s.statuses).toHaveLength(5);
    expect(s.report.orphan_visits.map((o) => o.water_point_id)).toEqual(["KJ-XXX-9999"]);
    // KIL-0001's latest visit is a blank-repair "NF" with a failed test: fast-track, not unsafe.
    expect(groupOf(s.statuses.find((p) => p.id === "KJ-KIL-0001")!)).toBe("red_fast_track");
  });

  test("caches per directory and cutoff", () => {
    process.env.PACK_DIR = "data/fixtures";
    const a = getSnapshot("2026-04-30");
    expect(getSnapshot("2026-04-30")).toBe(a);
    expect(getSnapshot("2026-03-01")).not.toBe(a);
    expect(getSnapshot("2026-03-01").counts.total).toBe(5);
    expect(getSnapshot("2026-01-01").counts.total).toBe(4); // JIW's first visit is later
  });

  test("a changed PACK_DIR is not served from the old directory's cache", () => {
    process.env.PACK_DIR = "data/fixtures";
    expect(getSnapshot("2026-04-30").counts.total).toBe(5);
    process.env.PACK_DIR = tmp;
    expect(() => getSnapshot("2026-04-30")).toThrow("pack data missing");
  });

  test.skipIf(!hasPackData())("real pack pinned counts (requirements §7.3)", () => {
    const q1 = getSnapshot("2026-06-30");
    expect(q1.counts).toMatchObject({ total: 320, fully_working: 225, partly_working: 48, not_working: 47, pct_full: 70.3, pct_incl_partly: 85.3 });
    const q4 = getSnapshot("2026-03-31");
    expect(q4.counts).toMatchObject({ fully_working: 220, partly_working: 48, not_working: 52, pct_full: 68.8, pct_incl_partly: 83.8 });
    const g = priorityGroups(q1.statuses);
    expect([g.red_fast_track, g.red_unsafe, g.amber_partly, g.amber_repair_recorded, g.green].map((x) => x.length)).toEqual([22, 60, 37, 25, 176]);
    expect(pointsBehind(q1.statuses, "incl_partly")).toHaveLength(273);
  });
});
