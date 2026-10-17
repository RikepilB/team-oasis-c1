import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ProviderFn } from "@/lib/harness/run";
import { packDir } from "@/lib/kijana/load";
import { isRecordId } from "@/lib/record/store";

// Replay returns a recorded output and never touches the network, so the full path runs offline with
// no key (NFR-3). A recording is `<job>-<key>-a<attempt>.json` in the shape the job's schema expects.
// Tracked, synthetic recordings live in data/fixtures/ai/; recordings of real pack reports stay in
// the git-ignored <pack>/ai/. The tracked folder is read first.
export const FIXTURES_DIR = path.join("data", "fixtures", "ai");

export const replayProvider: ProviderFn = async ({ job, key, attempt }) => {
  const missing = (message: string) => ({ ok: false as const, error: { kind: "replay_missing" as const, message } });
  // The key becomes part of a file name, so anything that could climb out of the folder is refused.
  if (!isRecordId(key)) return missing(`"${key}" is not a valid replay key`);

  const name = `${job}-${key}-a${attempt}.json`;
  const file = [FIXTURES_DIR, path.join(packDir(), "ai")].map((dir) => path.join(dir, name)).find((f) => existsSync(f));
  if (!file) {
    return missing(`No recorded output "${name}". Record one in live mode and copy it to data/fixtures/ai/, or switch provider.`);
  }
  let text: string;
  try {
    text = readFileSync(file, "utf8").replace(/^﻿/, "");
  } catch (e) {
    return missing(`Cannot read "${name}": ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: { kind: "parse", message: `"${name}" is not valid JSON: ${e instanceof Error ? e.message : String(e)}` } };
  }
};
