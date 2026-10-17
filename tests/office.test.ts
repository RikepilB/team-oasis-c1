import { describe, expect, test } from "vitest";
import { inflateRawSync } from "node:zlib";
import { parseExport, toDocx, toPdf, toXlsx } from "@/lib/demo/office";
const MD = "# Fondation du Québec — Q4 FY2025-26\n\nFictional data / Données fictives. Replay demonstration.\n\n## Entièrement fonctionnels\n\n40 %\n\nSource: pct_full\n\n## Progrès\n\nLe programme rapporte 60% de points d’eau fonctionnels.\n\nSource: F-01\n";
// Reads a stored file back out of our ZIP so the test checks real package content, not just a signature.
function entries(buf: Buffer) {
  const out: Record<string, string> = {}; let i = 0;
  while (buf.readUInt32LE(i) === 0x04034b50) { const size = buf.readUInt32LE(i + 18), nameLen = buf.readUInt16LE(i + 26); const name = buf.subarray(i + 30, i + 30 + nameLen).toString(); const start = i + 30 + nameLen; out[name] = inflateRawSync(buf.subarray(start, start + size)).toString("utf8"); i = start + size; }
  return out;
}
describe("approved export renderings", () => {
  test("parses headings, values and sources", () => {
    const p = parseExport(MD);
    expect(p.title).toBe("Fondation du Québec — Q4 FY2025-26");
    expect(p.sections).toEqual([{ heading: "Entièrement fonctionnels", value: "40 %", source: "pct_full" }, { heading: "Progrès", value: "Le programme rapporte 60% de points d’eau fonctionnels.", source: "F-01" }]);
  });
  test("docx holds the same approved text", () => {
    const e = entries(toDocx(MD, "fr"));
    expect(Object.keys(e)).toEqual(["[Content_Types].xml", "_rels/.rels", "word/document.xml"]);
    expect(e["word/document.xml"]).toContain("40 %");
    expect(e["word/document.xml"]).toContain("Source: F-01");
  });
  test("xlsx lists each section with its value and source", () => {
    const sheet = entries(toXlsx(MD))["xl/worksheets/sheet1.xml"];
    expect(sheet).toContain("Entièrement fonctionnels");
    expect(sheet).toContain("pct_full");
  });
  test("pdf is a complete document with accents kept", () => {
    const pdf = toPdf(MD).toString("latin1");
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(pdf).toContain("(Entièrement fonctionnels) Tj");
  });
});
