import { beforeEach, afterEach, describe, test, expect, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getRecord, runAction, getLog } from "@/lib/demo/workflow";
import { alternatives, buildFrenchItems } from "@/lib/demo/french-review";

let temp: string;
const prior = { data: process.env.AQUIFER_DATA_DIR, runtime: process.env.AQUIFER_RUNTIME_DIR };
beforeEach(() => { temp = mkdtempSync(path.join(tmpdir(), "aquifer-fr-")); process.env.AQUIFER_DATA_DIR = "data/fixtures/demo"; process.env.AQUIFER_RUNTIME_DIR = temp; vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network forbidden")); });
afterEach(() => {
  process.env.AQUIFER_DATA_DIR = prior.data; process.env.AQUIFER_RUNTIME_DIR = prior.runtime;
  if (prior.data === undefined) delete process.env.AQUIFER_DATA_DIR;
  if (prior.runtime === undefined) delete process.env.AQUIFER_RUNTIME_DIR;
  rmSync(temp, { recursive: true, force: true }); vi.restoreAllMocks();
});

const preparer = { actor: "Daniel", preparer: "Daniel" };
const reviewer = "Bilingual Content Coordinator";
async function translated(id: string) {
  for (const a of ["extract", "clean", "validate", "french"]) await runAction(id, a, preparer);
  const t = await runAction(id, "template", { ...preparer, funder_id: "quebec" });
  return t;
}

describe("French review items", () => {
  test("every flagged span sits exactly at its offset in every replayed draft", () => {
    const dir = "data/fixtures/demo";
    for (const f of readdirSync(path.join(dir, "replay"))) {
      const id = f.replace(/\.json$/, "");
      const fr = JSON.parse(readFileSync(path.join(dir, "replay", f), "utf8")).french;
      if (!fr) continue;
      const en = readFileSync(path.join(dir, "inbox", id + ".txt"), "utf8");
      for (const item of buildFrenchItems(en, fr.text, fr.uncertain_words))
        expect(fr.text.slice(item.position, item.position + item.word.length), id + " " + item.id).toBe(item.word);
    }
  });

  test("quick picks skip the English phrase the model translated", () => {
    expect(alternatives("Chosen for “protection works”; “aménagement” or “protection” may suit better.")).toEqual(["aménagement", "protection"]);
  });

  test("an unqualified “functional” gets a rule item; “fully functional” does not", () => {
    expect(buildFrenchItems("80% were reported functional.", "80% étaient déclarés fonctionnels.", []).map(i => [i.origin, i.word])).toEqual([["Rule", "fonctionnels"]]);
    expect(buildFrenchItems("40% were reported fully functional.", "40% étaient déclarés entièrement fonctionnels.", [])).toEqual([]);
  });

  test("review is refused until every item is decided; a decline rewrites the text live", async () => {
    let r = await translated("demo-spring-q4");
    const items = r.french!.items;
    expect(items.map(i => [i.origin, i.word])).toEqual([["AI", "de captage"], ["AI", "Des surveillants"]]);
    expect(items[0].alternatives).toEqual(["d’aménagement", "de protection"]);
    const revision = r.templates.quebec!.revision;
    await expect(runAction("demo-spring-q4", "review", { actor: reviewer, funder_id: "quebec", expected_revision: revision })).rejects.toThrow(/Decide every flagged French item/);

    await expect(runAction("demo-spring-q4", "french_item", { actor: reviewer, key: "FR-01", decision: "decline", note: "Funder wording" })).rejects.toThrow(/corrected French/);
    await expect(runAction("demo-spring-q4", "french_item", { actor: reviewer, key: "FR-01", decision: "decline", value: "aménagement" })).rejects.toThrow(/what is wrong/);

    r = await runAction("demo-spring-q4", "french_item", { actor: reviewer, key: "FR-01", decision: "decline", note: "The funder says aménagement.", value: "d’aménagement" });
    expect(r.french!.text).toContain("travaux d’aménagement à 3 sources");
    expect(r.french!.text).not.toContain("captage");
    expect(r.french!.check).toBe("green");
    const second = r.french!.items.find(i => i.id === "FR-02")!;
    expect(r.french!.text.slice(second.position, second.position + second.word.length)).toBe("Des surveillants");
    await expect(runAction("demo-spring-q4", "french_item", { actor: reviewer, key: "FR-01", decision: "approve" })).rejects.toThrow(/already decided/);

    r = await runAction("demo-spring-q4", "french_item", { actor: reviewer, key: "FR-02", decision: "approve" });
    expect(r.french!.items.every(i => i.decision)).toBe(true);
    r = await runAction("demo-spring-q4", "review", { actor: reviewer, funder_id: "quebec", expected_revision: revision });
    expect(r.templates.quebec!.review?.actor).toBe(reviewer);

    const decisions = (await getLog()).entries.filter(e => e.action === "french_item");
    expect(decisions.map(e => [e.detail.item, e.detail.decision, e.detail.after])).toEqual([["FR-01", "declined", "d’aménagement"], ["FR-02", "approved", "Des surveillants"]]);
    expect((await getLog()).valid).toBe(true);
  });

  test("a fix that changes a number turns the check red and blocks the review", async () => {
    const r = await translated("demo-spring-q4");
    const after = await runAction("demo-spring-q4", "french_item", { actor: reviewer, key: "FR-01", decision: "decline", note: "Test", value: "de captage à 4" });
    expect(after.french!.check).toBe("red");
    await runAction("demo-spring-q4", "french_item", { actor: reviewer, key: "FR-02", decision: "approve" });
    await expect(runAction("demo-spring-q4", "review", { actor: reviewer, funder_id: "quebec", expected_revision: r.templates.quebec!.revision })).rejects.toThrow(/French numerical integrity|numbers preserved/);
  });

  test("recreating the French draft resets every decision", async () => {
    await translated("fixture-q1");
    await runAction("fixture-q1", "french_item", { actor: reviewer, key: "FR-R1", decision: "approve" });
    const r = await runAction("fixture-q1", "french", preparer);
    expect(r.french!.items.map(i => i.decision)).toEqual([null]);
    expect((await getRecord("fixture-q1")).french!.items[0].word).toBe("fonctionnels");
  });
});
