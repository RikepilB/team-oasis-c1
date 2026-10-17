import type {
  Change,
  CleanResult,
  RawPoint,
  RawVisit,
  Visit,
  VisitStatus,
  WaterPoint,
  WaterQualityTest,
} from "@/lib/types";

// The three spellings the pack's data guide calls standard. Anything else that still maps is a
// non-standard value: counted in the report and listed as a change.
const STANDARD_STATUS = new Map<string, VisitStatus>([
  ["Functional", "working"],
  ["Partially functional", "partly"],
  ["Not functional", "not_working"],
]);

// Lower-cased lookup for the non-standard spellings (architecture section 8).
const STATUS_ALIASES = new Map<string, VisitStatus>([
  ["functional", "working"],
  ["func.", "working"],
  ["partially functional", "partly"],
  ["partially", "partly"],
  ["not functional", "not_working"],
  ["nf", "not_working"],
]);

const UNREADABLE_DATE = "excluded: unreadable date";

// Missing columns (a ragged row) read as blank rather than crashing.
const text = (v: string | undefined): string => (v ?? "").trim();

function isRealDate(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const pad = (n: number): string => String(n).padStart(2, "0");

type ParsedDate = { iso: string; dayFirst: boolean; ambiguous: boolean };

// ISO yyyy-mm-dd, else dd/mm/yyyy. A slash date is always read day-first: every one in the pack
// that can only be day-first is, so the rest follow. Where both parts are 12 or less the reading
// is an assumption, so it is flagged.
function parseDate(raw: string): ParsedDate | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) {
    const [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    return isRealDate(y, m, d) ? { iso: raw, dayFirst: false, ambiguous: false } : null;
  }
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (dmy) {
    const [d, m, y] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
    if (!isRealDate(y, m, d)) return null;
    return { iso: `${y}-${pad(m)}-${pad(d)}`, dayFirst: true, ambiguous: d <= 12 && m <= 12 };
  }
  return null;
}

function waterQualityTest(raw: string): WaterQualityTest {
  const v = text(raw).toLowerCase();
  return v === "pass" ? "pass" : v === "fail" ? "fail" : "not_tested";
}

// Blank stays blank: the pack has a not-working latest visit with no repair answer, and the
// metrics read it as "no repair recorded".
function repairCompleted(raw: string): Visit["repair_completed"] {
  const v = text(raw).toLowerCase();
  return v === "y" || v === "yes" ? "Y" : v === "n" || v === "no" ? "N" : "";
}

function cleanPoint(p: RawPoint): WaterPoint {
  return {
    id: text(p.water_point_id),
    district: text(p.district),
    settlement: text(p.settlement),
    type: text(p.type),
    sensor_installed: /^(y|yes|true|1)$/i.test(text(p.sensor_installed)),
  };
}

// The report describes the raw files, so the status and date tallies cover every row, including
// visits that are then dropped as orphans (requirements section 7.2 counts rows of the file).
export function cleanKijana(raw: { points: RawPoint[]; visits: RawVisit[] }): CleanResult {
  const points = raw.points.map(cleanPoint);
  const register = new Set(points.map((p) => p.id));

  const visits: Visit[] = [];
  const statusMapped = new Map<string, number>();
  const dayFirst: number[] = [];
  const ambiguous: number[] = [];
  const orphans: { visit_id: number; water_point_id: string }[] = [];
  const unmapped: { visit_id: number; raw: string }[] = [];
  const changes: Change[] = [];

  for (const row of raw.visits) {
    const visitId = Number(text(row.visit_id));
    const pointId = text(row.water_point_id);

    const rawStatus = text(row.status);
    const standard = STANDARD_STATUS.get(rawStatus);
    const status = standard ?? STATUS_ALIASES.get(rawStatus.toLowerCase());
    if (!status) {
      unmapped.push({ visit_id: visitId, raw: rawStatus });
    } else if (!standard) {
      statusMapped.set(rawStatus, (statusMapped.get(rawStatus) ?? 0) + 1);
      changes.push({ field: `visit ${visitId} status`, before: rawStatus, after: status });
    }

    const rawDate = text(row.visit_date);
    const date = parseDate(rawDate);
    if (!date) {
      changes.push({ field: `visit ${visitId} visit_date`, before: rawDate, after: UNREADABLE_DATE });
    } else if (date.dayFirst) {
      dayFirst.push(visitId);
      if (date.ambiguous) ambiguous.push(visitId);
      changes.push({ field: `visit ${visitId} visit_date`, before: rawDate, after: date.iso });
    }

    // Decided on its own, so an orphan with a bad status or date is still listed as an orphan.
    if (!register.has(pointId)) {
      orphans.push({ visit_id: visitId, water_point_id: pointId });
      continue;
    }
    if (!status || !date) continue;

    visits.push({
      visit_id: visitId,
      water_point_id: pointId,
      visit_date: date.iso,
      status,
      water_quality_test: waterQualityTest(row.water_quality_test),
      repair_completed: repairCompleted(row.repair_completed),
    });
  }

  return {
    points,
    visits,
    report: {
      status_mapped: Object.fromEntries(statusMapped),
      day_first_dates: dayFirst,
      ambiguous_dates: ambiguous,
      orphan_visits: orphans,
      unmapped_status: unmapped,
      changes,
    },
  };
}
