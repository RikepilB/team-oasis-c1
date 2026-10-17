import { expect, test } from "vitest";
import { loadStandard } from "@/lib/demo/standard";
test("demo exposes exactly two templates and complete registered replay jobs", () => {
  const s = loadStandard();
  expect(s.templates.map(t => t.id)).toEqual(["fdf", "quebec"]);
  expect(s.skills.filter(s => s.kind === "ai").every(s => s.registered && s.instruction.length > 0)).toBe(true);
  expect(s.profiles.every(p => p.provider === "replay" && p.offline)).toBe(true);
  expect(s.templates.every(t => t.numeric.every(f => f.source.id) && t.narrative.length > 0)).toBe(true);
});
