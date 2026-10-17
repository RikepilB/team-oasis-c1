import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Profile, WorkflowDef } from "@/lib/types";

// The standard is plain files under standard/, read at call time so a person's edit shows on the
// next request. A file that fails its schema is an error naming the file, never a silent default.
const STANDARD = "standard";

// First 12 hex of the file's sha256: the version an audit entry or a screen can quote (SOC 2 CC8.1).
export function fileVersion(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 12);
}

function readJson<T>(file: string, schema: { parse(x: unknown): T }): T {
  try {
    return schema.parse(JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, "")));
  } catch (e) {
    throw new Error(`${file}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export function loadWorkflow(): WorkflowDef {
  return readJson(path.join(STANDARD, "workflows", "funder-report.json"), WorkflowDef);
}

export function loadProfiles(): Profile[] {
  const dir = path.join(STANDARD, "profiles");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => readJson(path.join(dir, f), Profile));
}

export function getProfile(id: string): Profile | null {
  return loadProfiles().find((p) => p.id === id) ?? null;
}
