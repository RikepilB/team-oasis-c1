import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { hasPackData, loadKijana, packDir } from "@/lib/kijana/load";

const POINTS = "kijana_water_points.csv";
const VISITS = "kijana_monitoring_visits.csv";

let tmp: string;
let savedPackDir: string | undefined;

beforeEach(() => {
  tmp = mkdtempSync(path.join(tmpdir(), "kijana-load-"));
  savedPackDir = process.env.PACK_DIR;
});

afterEach(() => {
  if (savedPackDir === undefined) delete process.env.PACK_DIR;
  else process.env.PACK_DIR = savedPackDir;
  rmSync(tmp, { recursive: true, force: true });
});

describe("loadKijana", () => {
  test("reads both CSVs as string rows", () => {
    const raw = loadKijana("data/fixtures");
    expect(raw.points).toHaveLength(5);
    expect(raw.visits).toHaveLength(10);
    expect(raw.visits[0]).toMatchObject({ visit_id: "1", water_point_id: "KJ-MVU-0001", status: "Functional" });
    expect(raw.visits[0].notes).toBe("Synthetic fixture row, routine check"); // quoted comma kept
  });

  test("strips a UTF-8 BOM so the first header stays water_point_id / visit_id", () => {
    writeFileSync(path.join(tmp, POINTS), "﻿water_point_id,district\nP-1,Mvua\n");
    writeFileSync(path.join(tmp, VISITS), "﻿visit_id,water_point_id\n7,P-1\n");
    const raw = loadKijana(tmp);
    expect(Object.keys(raw.points[0])).toEqual(["water_point_id", "district"]);
    expect(raw.visits[0]).toEqual({ visit_id: "7", water_point_id: "P-1" });
  });

  test("skips empty lines", () => {
    writeFileSync(path.join(tmp, POINTS), "water_point_id,district\nP-1,Mvua\n\n\n");
    writeFileSync(path.join(tmp, VISITS), "visit_id,water_point_id\n\n7,P-1\n\n");
    const raw = loadKijana(tmp);
    expect(raw.points).toHaveLength(1);
    expect(raw.visits).toHaveLength(1);
  });

  test("throws when a file is missing", () => {
    expect(() => loadKijana(tmp)).toThrow();
  });
});

describe("hasPackData / packDir", () => {
  test("PACK_DIR defaults to data/pack", () => {
    delete process.env.PACK_DIR;
    expect(packDir()).toBe("data/pack");
  });

  test("is true when both CSVs exist in PACK_DIR, read at call time", () => {
    process.env.PACK_DIR = tmp;
    expect(hasPackData()).toBe(false);
    writeFileSync(path.join(tmp, POINTS), "water_point_id\n");
    expect(hasPackData()).toBe(false); // one file is not enough
    writeFileSync(path.join(tmp, VISITS), "visit_id\n");
    expect(hasPackData()).toBe(true);
  });

  test("is false when PACK_DIR does not exist", () => {
    process.env.PACK_DIR = path.join(tmp, "nope");
    expect(hasPackData()).toBe(false);
  });

  test("is true for the committed fixtures folder (relative to the repo root)", () => {
    process.env.PACK_DIR = "data/fixtures";
    expect(hasPackData()).toBe(true);
  });
});
