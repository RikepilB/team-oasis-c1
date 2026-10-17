import { describe, expect, test } from "vitest";
import { cleanKijana } from "@/lib/kijana/clean";
import { hasPackData, loadKijana, packDir } from "@/lib/kijana/load";
import type { RawPoint, RawVisit } from "@/lib/types";

// The committed fixtures are synthetic (data/fixtures/*.csv); the real pack is not in the repo.
const fixtures = () => cleanKijana(loadKijana("data/fixtures"));

describe("cleanKijana on the fixtures", () => {
  test("maps non-standard statuses and records each change", () => {
    const r = fixtures();
    expect(r.report.status_mapped).toMatchObject({ "Func.": 1, functional: 1, NF: 1, Partially: 1 });
    expect(r.visits.every((v) => ["working", "partly", "not_working"].includes(v.status))).toBe(true);
    expect(r.report.changes).toContainEqual({
      field: expect.stringContaining("status"),
      before: "NF",
      after: "not_working",
    });
  });

  test("parses dd/mm/yyyy day-first and flags ambiguous dates", () => {
    const r = fixtures();
    expect(r.visits.find((v) => v.visit_date === "2026-01-24")).toBeDefined();
    expect(r.visits.find((v) => v.visit_date === "2024-07-12")).toBeDefined(); // 12/07/2024 is 12 July
    expect(r.report.ambiguous_dates).toHaveLength(1);
    expect(r.report.day_first_dates).toHaveLength(2);
  });

  test("drops visits to points not in the register", () => {
    const r = fixtures();
    expect(r.report.orphan_visits.map((o) => o.water_point_id)).toEqual(["KJ-XXX-9999"]);
    expect(r.visits.some((v) => v.water_point_id === "KJ-XXX-9999")).toBe(false);
  });

  test("keeps every other visit and reports nothing unmapped", () => {
    const r = fixtures();
    expect(r.visits).toHaveLength(9);
    expect(r.report.unmapped_status).toEqual([]);
    expect(r.points).toHaveLength(5);
  });

  test("leaves a blank repair_completed blank (no repair recorded)", () => {
    const blank = fixtures().visits.find((v) => v.visit_id === 4);
    expect(blank).toMatchObject({ status: "not_working", water_quality_test: "fail", repair_completed: "" });
  });

  test("converts the register to typed water points", () => {
    const r = fixtures();
    expect(r.points[0]).toEqual({
      id: "KJ-MVU-0001",
      district: "Mvua",
      settlement: "Fixtureville North",
      type: "Borehole",
      sensor_installed: true,
    });
    expect(r.points.find((p) => p.id === "KJ-MVU-0002")?.sensor_installed).toBe(false);
  });
});

describe("cleanKijana rules on inline rows", () => {
  const point = (id: string, extra: Partial<RawPoint> = {}): RawPoint => ({
    water_point_id: id,
    district: "Mvua",
    settlement: "Fixtureville",
    type: "Borehole",
    install_year: "2020",
    management: "Committee",
    committee_women_share: "0.5",
    est_users: "100",
    tariff_model: "Free",
    sensor_installed: "N",
    grid_x: "1",
    grid_y: "2",
    ...extra,
  });
  const visit = (id: number, extra: Partial<RawVisit> = {}): RawVisit => ({
    visit_id: String(id),
    water_point_id: "P-1",
    visit_date: "2025-01-15",
    visitor_role: "Area mechanic",
    status: "Functional",
    issue_category: "none",
    downtime_days_reported: "0",
    water_quality_test: "Pass",
    repair_completed: "N",
    notes: "",
    ...extra,
  });
  const clean = (visits: RawVisit[]) => cleanKijana({ points: [point("P-1")], visits });

  test("standard statuses are mapped without a change or a status_mapped entry", () => {
    const r = clean([
      visit(1, { status: "Functional" }),
      visit(2, { status: "Partially functional" }),
      visit(3, { status: "Not functional" }),
    ]);
    expect(r.visits.map((v) => v.status)).toEqual(["working", "partly", "not_working"]);
    expect(r.report.status_mapped).toEqual({});
    expect(r.report.changes).toEqual([]);
  });

  test("status matching ignores case and surrounding spaces; the report keeps the raw text", () => {
    const r = clean([visit(1, { status: "  nf " }), visit(2, { status: "PARTIALLY FUNCTIONAL" })]);
    expect(r.visits.map((v) => v.status)).toEqual(["not_working", "partly"]);
    expect(r.report.status_mapped).toEqual({ nf: 1, "PARTIALLY FUNCTIONAL": 1 });
  });

  test("an unknown or blank status is reported as unmapped and the visit is excluded", () => {
    const r = clean([visit(1, { status: "Broken" }), visit(2, { status: "" }), visit(3)]);
    expect(r.report.unmapped_status).toEqual([
      { visit_id: 1, raw: "Broken" },
      { visit_id: 2, raw: "" },
    ]);
    expect(r.visits.map((v) => v.visit_id)).toEqual([3]);
  });

  test("ISO dates pass through untouched", () => {
    const r = clean([visit(1, { visit_date: "2025-03-09" })]);
    expect(r.visits[0].visit_date).toBe("2025-03-09");
    expect(r.report.day_first_dates).toEqual([]);
    expect(r.report.changes).toEqual([]);
  });

  test("dd/mm/yyyy is day-first: ambiguous when both parts are 12 or less, and the change is listed", () => {
    const r = clean([
      visit(1, { visit_date: "12/07/2024" }),
      visit(2, { visit_date: "24/01/2026" }),
      visit(3, { visit_date: "5/3/2025" }),
    ]);
    expect(r.visits.map((v) => v.visit_date)).toEqual(["2024-07-12", "2026-01-24", "2025-03-05"]);
    expect(r.report.day_first_dates).toEqual([1, 2, 3]);
    expect(r.report.ambiguous_dates).toEqual([1, 3]);
    expect(r.report.changes).toContainEqual({
      field: expect.stringContaining("date"),
      before: "12/07/2024",
      after: "2024-07-12",
    });
  });

  test("a date that is not a real calendar day excludes the visit and says so", () => {
    const r = clean([visit(1, { visit_date: "31/02/2025" }), visit(2, { visit_date: "soon" }), visit(3)]);
    expect(r.visits.map((v) => v.visit_id)).toEqual([3]);
    expect(r.report.changes).toEqual([
      { field: "visit 1 visit_date", before: "31/02/2025", after: "excluded: unreadable date" },
      { field: "visit 2 visit_date", before: "soon", after: "excluded: unreadable date" },
    ]);
  });

  test("an orphan visit is listed even when its status or date is also bad", () => {
    const r = clean([visit(1, { water_point_id: "KJ-XXX-1", status: "Broken", visit_date: "nope" }), visit(2)]);
    expect(r.report.orphan_visits).toEqual([{ visit_id: 1, water_point_id: "KJ-XXX-1" }]);
    expect(r.visits.map((v) => v.visit_id)).toEqual([2]);
  });

  test("water_quality_test and repair_completed are normalised", () => {
    const r = clean([
      visit(1, { water_quality_test: "FAIL", repair_completed: "y" }),
      visit(2, { water_quality_test: "", repair_completed: "" }),
      visit(3, { water_quality_test: "Not tested", repair_completed: "No" }),
    ]);
    expect(r.visits.map((v) => [v.water_quality_test, v.repair_completed])).toEqual([
      ["fail", "Y"],
      ["not_tested", ""],
      ["not_tested", "N"],
    ]);
  });
});

test.skipIf(!hasPackData())("real pack: known issues match requirements §7.2", () => {
  const r = cleanKijana(loadKijana(packDir()));
  expect(r.points).toHaveLength(320);
  expect(r.visits.length + r.report.orphan_visits.length).toBe(2760);
  expect(r.report.orphan_visits).toHaveLength(6);
  expect(r.report.day_first_dates).toHaveLength(10);
  expect(r.report.ambiguous_dates).toHaveLength(4);
  expect(r.report.status_mapped).toMatchObject({ "Func.": 26, functional: 20, NF: 20, Partially: 18 });
  expect(r.report.unmapped_status).toHaveLength(0);
});
