import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import type { RawPoint, RawVisit } from "@/lib/types";

const POINTS_FILE = "kijana_water_points.csv";
const VISITS_FILE = "kijana_monitoring_visits.csv";

// The folder that holds the pack (the Kijana CSVs now, inbox/ later). Read at call time so a test
// can point it at a temp folder.
export function packDir(): string {
  return process.env.PACK_DIR ?? "data/pack";
}

export function hasPackData(): boolean {
  const dir = packDir();
  return existsSync(path.join(dir, POINTS_FILE)) && existsSync(path.join(dir, VISITS_FILE));
}

function readRows<T>(file: string): T[] {
  // Excel writes a BOM; left in, it would rename the first column to "﻿visit_id".
  const text = readFileSync(file, "utf8").replace(/^﻿/, "");
  const parsed = Papa.parse<T>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  // Ragged rows are tolerated; a broken quote would silently merge rows, so that one is fatal.
  const broken = parsed.errors.find((e) => e.type === "Quotes");
  if (broken) throw new Error(`${path.basename(file)}: ${broken.message} (row ${broken.row})`);
  return parsed.data;
}

// Raw rows, every value still a string. cleanKijana turns them into typed rows.
export function loadKijana(dir: string): { points: RawPoint[]; visits: RawVisit[] } {
  return {
    points: readRows<RawPoint>(path.join(dir, POINTS_FILE)),
    visits: readRows<RawVisit>(path.join(dir, VISITS_FILE)),
  };
}
