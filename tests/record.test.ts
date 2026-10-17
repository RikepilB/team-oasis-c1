import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { appendAudit, readAudit, verifyAuditChain } from "@/lib/audit";
import { approve, disclosureFor, send } from "@/lib/record/approval";
import { listInbox } from "@/lib/record/inbox";
import { dataDir, getOrCreateRecord, saveRecord } from "@/lib/record/store";
import type { FactRecord, FunderId, TemplateField } from "@/lib/types";

const ID = "kijana-q1-test";
const fixtureText = readFileSync("data/fixtures/inbox/kijana-q1-test.txt", "utf8");

let tmp: string;
let savedPackDir: string | undefined;
let savedDataDir: string | undefined;

beforeEach(() => {
  tmp = mkdtempSync(path.join(tmpdir(), "record-"));
  savedPackDir = process.env.PACK_DIR;
  savedDataDir = process.env.DATA_DIR;
  process.env.PACK_DIR = path.join(tmp, "pack");
  process.env.DATA_DIR = path.join(tmp, "runtime");
  cpSync("data/fixtures/inbox", path.join(tmp, "pack", "inbox"), { recursive: true });
});

afterEach(() => {
  if (savedPackDir === undefined) delete process.env.PACK_DIR;
  else process.env.PACK_DIR = savedPackDir;
  if (savedDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = savedDataDir;
  rmSync(tmp, { recursive: true, force: true });
});

// A filled template on the record: one number field and one narrative field. `anyRed` turns the
// narrative field red, the way the verifier would when a sentence carries an unsourced number.
function seedTemplate(id: string, funder: FunderId, opts: { anyRed: boolean }) {
  const fields: TemplateField[] = [
    {
      key: "functionality",
      label: "Functionality",
      kind: "number",
      value: "85%",
      source: { fact_id: "F-01" },
      check: "green",
      check_reason: null,
    },
    {
      key: "summary",
      label: "Summary",
      kind: "narrative",
      value: "Functionality remains above target.",
      source: null,
      check: opts.anyRed ? "red" : "green",
      check_reason: opts.anyRed ? "number not in the Fact Record" : null,
    },
  ];
  const r = getOrCreateRecord(id);
  saveRecord({
    ...r,
    templates: { [funder]: { funder_id: funder, language: "en", fields, disclosure: null, approval: null } },
  });
}

const approveFdf = () => approve(ID, "fdf", "Sam Reviewer", "Alex Preparer");

describe("inbox", () => {
  test("lists the sidecar items with a new status", () => {
    expect(listInbox()).toEqual([
      {
        id: ID,
        project: "Kijana Resilient Towns",
        funder: "FDF",
        received_date: "2026-07-29",
        status: "new",
      },
    ]);
  });

  test("an empty or missing inbox lists nothing", () => {
    rmSync(path.join(tmp, "pack", "inbox"), { recursive: true });
    expect(listInbox()).toEqual([]);
  });

  test("status follows the stored record: extracted, translated, filled, approved, sent", () => {
    const status = () => listInbox()[0].status;
    const r = getOrCreateRecord(ID);
    expect(status()).toBe("new");

    const fact = {
      fact_id: "F-01",
      label: "functionality_reported",
      value: 85,
      unit: "%",
      period: "Q1 FY2026-27",
      quote: "The synthetic status sample records 85%.",
      check: "green" as const,
      check_reason: null,
    };
    saveRecord({ ...r, facts: [fact] });
    expect(status()).toBe("extracted");

    saveRecord({ ...getOrCreateRecord(ID), french: { text: "Texte", uncertain_words: [], check: "green", problems: [] } });
    expect(status()).toBe("translated");

    seedTemplate(ID, "fdf", { anyRed: false });
    expect(status()).toBe("filled");

    expect(approveFdf().ok).toBe(true);
    expect(status()).toBe("approved");

    expect(send(ID, "fdf", "Sam Reviewer").ok).toBe(true);
    expect(status()).toBe("sent");
  });
});

describe("fact record store", () => {
  test("creates the record from the inbox item, with period and period_end, and keeps it on disk", () => {
    const r = getOrCreateRecord(ID);
    expect(r).toMatchObject({
      record_id: ID,
      source_file: "inbox/kijana-q1-test.txt",
      original_text: fixtureText,
      received_date: "2026-07-29",
      source_location: "Synthetic test report",
      period: "Q1 FY2026-27",
      period_end: "2026-06-30",
      facts: [],
      changes: [],
      metrics: [],
      french: null,
      templates: {},
    });
    expect(existsSync(path.join(dataDir(), "facts", `${ID}.json`))).toBe(true);
    expect(getOrCreateRecord(ID)).toEqual(r);
  });

  test("the fixture carries the sentences the later tasks quote", () => {
    for (const s of [
      "The synthetic status sample records 85%.",
      "The training exercise assigns 22 fictional boreholes to a maintenance queue.",
      "The example contains 41 simulated committees.",
      "The test scenario uses four districts; two have a prepared test plan.",
      "The simulated assignment has four staff checking 320 water points.",
      "The coordinator spends eight simulated processing days checking four fictional funders.",
      "The sample includes 1,900 fictional people.",
    ]) {
      expect(fixtureText).toContain(s);
    }
  });

  test("original_text is never modified by later saves", () => {
    const r = getOrCreateRecord(ID);
    saveRecord({ ...r, facts: [], original_text: "changed" } as FactRecord);
    expect(getOrCreateRecord(ID).original_text).toBe(fixtureText);
  });

  test("a save keeps the other changes", () => {
    const r = getOrCreateRecord(ID);
    saveRecord({ ...r, changes: [{ field: "date", before: "12/07/2024", after: "2024-07-12" }] });
    expect(getOrCreateRecord(ID).changes).toHaveLength(1);
  });

  test("a stored file that fails the schema is an error, not a silent reset", () => {
    getOrCreateRecord(ID);
    writeFileSync(path.join(dataDir(), "facts", `${ID}.json`), JSON.stringify({ record_id: ID }));
    expect(() => getOrCreateRecord(ID)).toThrow();
  });

  test("a record id cannot leave the facts folder", () => {
    expect(() => getOrCreateRecord("../escape")).toThrow(/record id/);
    expect(() => getOrCreateRecord("a/b")).toThrow(/record id/);
  });

  test("an id with no inbox item cannot be created", () => {
    expect(() => getOrCreateRecord("not-in-the-inbox")).toThrow(/inbox/);
  });
});

describe("approve", () => {
  test("is refused while any template field is red", () => {
    seedTemplate(ID, "fdf", { anyRed: true });
    expect(approveFdf()).toEqual({ ok: false, reason: expect.stringContaining("red") });
    expect(readAudit()).toEqual([]);
  });

  test("is refused when approver equals preparer", () => {
    seedTemplate(ID, "fdf", { anyRed: false });
    const res = approve(ID, "fdf", "Sam Reviewer", "Sam Reviewer");
    expect(res).toEqual({ ok: false, reason: expect.stringContaining("preparer") });
    expect(readAudit()).toEqual([]);
  });

  test("the approver-equals-preparer check ignores case and surrounding spaces", () => {
    seedTemplate(ID, "fdf", { anyRed: false });
    const res = approve(ID, "fdf", "  sam reviewer ", "Sam Reviewer");
    expect(res).toEqual({ ok: false, reason: expect.stringContaining("preparer") });
  });

  test("is refused without a name for the approver or the preparer", () => {
    seedTemplate(ID, "fdf", { anyRed: false });
    expect(approve(ID, "fdf", "  ", "Alex Preparer")).toEqual({ ok: false, reason: expect.stringContaining("approver") });
    expect(approve(ID, "fdf", "Sam Reviewer", "")).toEqual({ ok: false, reason: expect.stringContaining("preparer") });
  });

  test("is refused when the record or the template does not exist", () => {
    expect(approveFdf()).toEqual({ ok: false, reason: expect.stringContaining("not found") });
    getOrCreateRecord(ID);
    expect(approveFdf()).toEqual({ ok: false, reason: expect.stringContaining("template") });
    expect(approve("../escape", "fdf", "Sam Reviewer", "Alex Preparer").ok).toBe(false);
  });

  test("stores the approver, the preparer and the time on the template", () => {
    seedTemplate(ID, "fdf", { anyRed: false });
    const res = approveFdf();
    expect(res.ok).toBe(true);
    const approval = getOrCreateRecord(ID).templates.fdf?.approval;
    expect(approval).toEqual({
      approver: "Sam Reviewer",
      preparer: "Alex Preparer",
      content_approved_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      sent_at: null,
    });
    expect(readAudit()).toMatchObject([
      { actor: "Sam Reviewer", action: "approve", record_id: ID, detail: { funder_id: "fdf", preparer: "Alex Preparer" } },
    ]);
  });

  test("a second person cannot approve what is already approved", () => {
    seedTemplate(ID, "fdf", { anyRed: false });
    approveFdf();
    const res = approve(ID, "fdf", "Jo Other", "Alex Preparer");
    expect(res).toEqual({ ok: false, reason: expect.stringContaining("Sam Reviewer") });
    expect(readAudit().filter((a) => a.action === "approve")).toHaveLength(1);
  });
});

describe("send", () => {
  test("double approve and double send each log once; send before approve is refused", () => {
    seedTemplate(ID, "fdf", { anyRed: false });
    expect(send(ID, "fdf", "Sam Reviewer").ok).toBe(false);
    approveFdf();
    approveFdf();
    send(ID, "fdf", "Sam Reviewer");
    send(ID, "fdf", "Sam Reviewer");
    const acts = readAudit()
      .map((a) => a.action)
      .filter((a) => a === "approve" || a === "send");
    expect(acts).toEqual(["approve", "send"]);
  });

  test("send before approve says why", () => {
    seedTemplate(ID, "fdf", { anyRed: false });
    expect(send(ID, "fdf", "Sam Reviewer")).toEqual({ ok: false, reason: expect.stringContaining("approv") });
    expect(existsSync(path.join(dataDir(), "exports"))).toBe(false);
  });

  test("send is refused when the record or the template does not exist", () => {
    expect(send(ID, "fdf", "Sam Reviewer").ok).toBe(false);
    getOrCreateRecord(ID);
    expect(send(ID, "fdf", "Sam Reviewer").ok).toBe(false);
  });

  test("send writes the export with the disclosure line", () => {
    seedTemplate(ID, "fdf", { anyRed: false });
    approveFdf();
    const res = send(ID, "fdf", "Sam Reviewer");
    expect(res.ok && readFileSync(res.export_path, "utf8")).toContain("Reviewed and approved by Sam Reviewer");
  });

  test("the export lives under exports/<record_id>-<funder_id>.md and holds the field values", () => {
    seedTemplate(ID, "fdf", { anyRed: false });
    const approved = approveFdf();
    const res = send(ID, "fdf", "Sam Reviewer");
    if (!res.ok || !approved.ok) throw new Error("expected approve and send to succeed");
    expect(path.resolve(res.export_path)).toBe(path.resolve(dataDir(), "exports", `${ID}-fdf.md`));
    const date = approved.record.templates.fdf?.approval?.content_approved_at.slice(0, 10) ?? "";
    const text = readFileSync(res.export_path, "utf8");
    expect(text).toContain("85%");
    expect(text).toContain("Functionality remains above target.");
    expect(text).toContain(disclosureFor("Sam Reviewer", date));
    expect(res.record.templates.fdf?.approval?.sent_at).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/));
    expect(readAudit().at(-1)).toMatchObject({ actor: "Sam Reviewer", action: "send", record_id: ID });
  });

  test("a repeat send returns the same export and does not rewrite it", () => {
    seedTemplate(ID, "fdf", { anyRed: false });
    approveFdf();
    const first = send(ID, "fdf", "Sam Reviewer");
    if (!first.ok) throw new Error("expected send to succeed");
    writeFileSync(first.export_path, "edited after send");
    const second = send(ID, "fdf", "Sam Reviewer");
    expect(second).toMatchObject({ ok: true, export_path: first.export_path });
    expect(readFileSync(first.export_path, "utf8")).toBe("edited after send");
  });
});

describe("disclosureFor", () => {
  test("uses the agreed wording", () => {
    expect(disclosureFor("Sam Reviewer", "2026-07-30")).toBe(
      "Prepared with AI assistance. Reviewed and approved by Sam Reviewer on 2026-07-30. Figures are traced to the Kijana programme data.",
    );
  });
});

describe("audit log", () => {
  const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
  const withoutHash = (e: object): Record<string, unknown> =>
    Object.fromEntries(Object.entries(e).filter(([k]) => k !== "hash"));
  const add = (actor: string) => appendAudit({ actor, action: "verify", record_id: ID, detail: { n: 1 } });

  test("appends one JSON line per entry with a timestamp", () => {
    const e = add("system");
    expect(e.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    add("system");
    const lines = readFileSync(path.join(dataDir(), "audit.jsonl"), "utf8").trimEnd().split("\n");
    expect(lines).toHaveLength(2);
    expect(readAudit()).toHaveLength(2);
    expect(readAudit()[0]).toEqual(e);
  });

  test("hash is sha256 of the previous hash plus the entry without its hash", () => {
    const first = add("a1");
    const second = add("a2");
    expect(first.prev_hash).toBeNull();
    expect(first.hash).toBe(sha256(JSON.stringify(withoutHash(first))));
    expect(second.prev_hash).toBe(first.hash);
    expect(second.hash).toBe(sha256(first.hash + JSON.stringify(withoutHash(second))));
  });

  test("an empty log verifies", () => {
    expect(verifyAuditChain()).toEqual({ ok: true, entries: 0, broken_at: null });
  });

  test("audit chain verifies, and editing one stored line breaks it at that line", () => {
    add("a0");
    add("a1");
    add("a2");
    add("a3");
    expect(verifyAuditChain()).toEqual({ ok: true, entries: 4, broken_at: null });

    const file = path.join(dataDir(), "audit.jsonl");
    const lines = readFileSync(file, "utf8").trimEnd().split("\n");
    const edited = JSON.parse(lines[2]);
    edited.actor = "someone else";
    lines[2] = JSON.stringify(edited);
    writeFileSync(file, lines.join("\n") + "\n");

    expect(verifyAuditChain()).toEqual({ ok: false, entries: 4, broken_at: 2 });
  });

  test("rewriting a line and its own hash still breaks the next line", () => {
    add("a0");
    add("a1");
    add("a2");
    const file = path.join(dataDir(), "audit.jsonl");
    const lines = readFileSync(file, "utf8").trimEnd().split("\n");
    const rest = withoutHash(JSON.parse(lines[1]));
    rest.actor = "someone else";
    const forged = { ...rest, hash: sha256(readAudit()[0].hash + JSON.stringify(rest)) };
    lines[1] = JSON.stringify(forged);
    writeFileSync(file, lines.join("\n") + "\n");

    expect(verifyAuditChain()).toEqual({ ok: false, entries: 3, broken_at: 2 });
  });

  test("a deleted line breaks the chain where it was", () => {
    add("a0");
    add("a1");
    add("a2");
    const file = path.join(dataDir(), "audit.jsonl");
    const lines = readFileSync(file, "utf8").trimEnd().split("\n");
    lines.splice(1, 1);
    writeFileSync(file, lines.join("\n") + "\n");
    expect(verifyAuditChain()).toEqual({ ok: false, entries: 2, broken_at: 1 });
  });

  test("a line that is not JSON breaks the chain at that line", () => {
    add("a0");
    add("a1");
    const file = path.join(dataDir(), "audit.jsonl");
    const lines = readFileSync(file, "utf8").trimEnd().split("\n");
    lines[1] = "{not json";
    writeFileSync(file, lines.join("\n") + "\n");
    expect(verifyAuditChain()).toEqual({ ok: false, entries: 2, broken_at: 1 });
  });
});
