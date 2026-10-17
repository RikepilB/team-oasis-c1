#!/usr/bin/env node
// Template CLI: scaffold a draft from a preset, or check a template file before review.
//   npm run template -- presets
//   npm run template -- new <id> [--preset donor-update] [--lang en|fr]   → writes standard/drafts/<id>.json
//   npm run template -- check <file.json> [...more]                       → exit 1 if any problem
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PRESETS, checkTemplate, slug, toStandardFile } from "../lib/demo/template-kit.mjs";

const [command, ...args] = process.argv.slice(2);
const flag = name => { const i = args.indexOf("--" + name); return i >= 0 ? args[i + 1] : undefined; };

if (command === "presets") {
  for (const p of PRESETS) console.log(`${p.id.padEnd(20)} ${p.language}  ${p.label}${p.standard ? "  (approved standard: " + p.standard + ")" : ""}`);
} else if (command === "new") {
  const id = slug(args[0] ?? "");
  const preset = PRESETS.find(p => p.id === (flag("preset") ?? "fdf-quarterly"));
  if (!id || !preset) { console.error("Usage: new <id> [--preset <preset id>] [--lang en|fr]. See `presets`."); process.exit(2); }
  const file = path.join("standard", "drafts", id + ".json");
  if (existsSync(file)) { console.error(`${file} already exists; not overwriting.`); process.exit(2); }
  const draft = toStandardFile({ ...preset, id, language: flag("lang") ?? preset.language, label: preset.label + " (draft)" });
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(draft, null, 2) + "\n");
  console.log(`Wrote ${file} from preset ${preset.id}. Edit it, then run: npm run template -- check ${file}`);
} else if (command === "check") {
  if (!args.length) { console.error("Usage: check <file.json> [...more]"); process.exit(2); }
  let failed = 0;
  for (const file of args) {
    let problems;
    try { problems = checkTemplate(JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, ""))); }
    catch (e) { problems = ["Cannot read JSON: " + e.message]; }
    if (problems.length) { failed++; console.log(`✕ ${file}`); for (const p of problems) console.log("  - " + p); }
    else console.log(`✓ ${file} is ready for review`);
  }
  process.exit(failed ? 1 : 0);
} else {
  console.log("Synapse template CLI\n  presets                 list starter templates\n  new <id> [--preset p]   scaffold standard/drafts/<id>.json\n  check <file...>         validate template files");
  process.exit(command ? 2 : 0);
}
