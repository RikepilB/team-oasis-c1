// Turns an approved Markdown export into PDF, Word (.docx) and Excel (.xlsx) without extra dependencies.
// The Markdown export stays the record of truth; these are renderings of exactly the same approved text.
import { deflateRawSync } from "node:zlib";

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buf: Buffer) { let c = 0xffffffff; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
// Minimal ZIP writer (deflate), enough for Office Open XML packages.
export function zip(files: { name: string; data: string }[]): Buffer {
  const locals: Buffer[] = []; const centrals: Buffer[] = []; let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8"); const raw = Buffer.from(f.data, "utf8"); const body = deflateRawSync(raw); const crc = crc32(raw);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8); local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10); central.writeUInt32LE(0, 12); central.writeUInt32LE(crc, 16); central.writeUInt32LE(body.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, name, body); centrals.push(central, name); offset += local.length + name.length + body.length;
  }
  const cd = Buffer.concat(centrals); const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}
const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type Section = { heading: string; value: string; source: string };
/** Reads the export Markdown: "# title", then "## heading" blocks with their text and an optional "Source:" line. */
export function parseExport(md: string): { title: string; preface: string[]; sections: Section[] } {
  const lines = md.replace(/\r/g, "").split("\n"); let title = ""; const preface: string[] = []; const sections: Section[] = [];
  for (const line of lines) {
    if (line.startsWith("# ")) title = line.slice(2).trim();
    else if (line.startsWith("## ")) sections.push({ heading: line.slice(3).trim(), value: "", source: "" });
    else if (!line.trim()) continue;
    else if (!sections.length) preface.push(line.trim());
    else if (/^sources?\s*:/i.test(line.trim())) sections.at(-1)!.source = line.trim().replace(/^sources?\s*:\s*/i, "");
    else sections.at(-1)!.value += (sections.at(-1)!.value ? "\n" : "") + line.trim();
  }
  return { title, preface, sections };
}

export function toDocx(md: string, language: string): Buffer {
  const { title, preface, sections } = parseExport(md);
  const p = (text: string, opts: { bold?: boolean; size?: number; color?: string } = {}) => `<w:p><w:r><w:rPr>${opts.bold ? "<w:b/>" : ""}${opts.color ? `<w:color w:val="${opts.color}"/>` : ""}<w:sz w:val="${opts.size ?? 22}"/><w:lang w:val="${language === "fr" ? "fr-CA" : "en-CA"}"/></w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;
  const body = [p(title, { bold: true, size: 36, color: "0B4F6C" }), ...preface.map(l => p(l, { size: 18, color: "5B6B73" })),
    ...sections.flatMap(s => [p(s.heading, { bold: true, size: 26, color: "0B4F6C" }), ...s.value.split("\n").map(v => p(v)), ...(s.source ? [p("Source: " + s.source, { size: 16, color: "5B6B73" })] : [])])].join("");
  return zip([
    { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>` },
    { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>` },
    { name: "word/document.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>` },
  ]);
}

export function toXlsx(md: string): Buffer {
  const { title, preface, sections } = parseExport(md);
  const rows: string[][] = [[title], ...preface.map(l => [l]), [], ["Section", "Value", "Source"], ...sections.map(s => [s.heading, s.value, s.source])];
  const col = (i: number) => String.fromCharCode(65 + i);
  const cell = (v: string, r: number, i: number) => { const num = /^-?\d+(\.\d+)?$/.test(v.trim()); return num ? `<c r="${col(i)}${r}"><v>${v.trim()}</v></c>` : `<c r="${col(i)}${r}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`; };
  const sheet = rows.map((row, r) => `<row r="${r + 1}">${row.map((v, i) => cell(v, r + 1, i)).join("")}</row>`).join("");
  return zip([
    { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>` },
    { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>` },
    { name: "xl/worksheets/sheet1.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="40" customWidth="1"/><col min="2" max="2" width="70" customWidth="1"/><col min="3" max="3" width="28" customWidth="1"/></cols><sheetData>${sheet}</sheetData></worksheet>` },
  ]);
}

// Simple text PDF (Helvetica, WinAnsi) with wrapping and pages.
const WIN: Record<string, string> = { "’": "'", "‘": "'", "“": "\"", "”": "\"", "–": "-", "—": "-", "…": "...", "≤": "<=", "≥": ">=", "→": "->", "✓": "v", "✕": "x", " ": " ", " ": " " };
const latin = (s: string) => [...s].map(c => WIN[c] ?? (c.charCodeAt(0) < 256 ? c : "?")).join("");
const esc = (s: string) => latin(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
function wrap(text: string, size: number, width: number) { const max = Math.floor(width / (size * 0.5)); const out: string[] = []; for (const para of text.split("\n")) { let line = ""; for (const w of para.split(/\s+/)) { if ((line + " " + w).trim().length > max) { if (line) out.push(line); line = w; } else line = (line + " " + w).trim(); } out.push(line); } return out; }
export function toPdf(md: string): Buffer {
  const { title, preface, sections } = parseExport(md);
  const items: { text: string; size: number; bold?: boolean; gap?: number }[] = [{ text: title, size: 18, bold: true, gap: 8 }, ...preface.map(l => ({ text: l, size: 9 })), ...sections.flatMap(s => [{ text: s.heading, size: 12, bold: true, gap: 10 }, { text: s.value, size: 11 }, ...(s.source ? [{ text: "Source: " + s.source, size: 8 }] : [])])];
  const pages: string[] = []; let ops = ""; let y = 750;
  for (const it of items) for (const [i, line] of wrap(it.text, it.size, 500).entries()) {
    const step = it.size * 1.4 + (i === 0 ? it.gap ?? 0 : 0);
    if (y - step < 50) { pages.push(ops); ops = ""; y = 750; }
    y -= step; ops += `BT /${it.bold ? "F2" : "F1"} ${it.size} Tf 56 ${y.toFixed(1)} Td (${esc(line)}) Tj ET\n`;
  }
  pages.push(ops);
  const objs: string[] = []; const n = pages.length;
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[2] = `<< /Type /Pages /Kids [${pages.map((_, i) => `${5 + i * 2} 0 R`).join(" ")}] /Count ${n} >>`;
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objs[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  pages.forEach((content, i) => { objs[5 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`; objs[6 + i * 2] = `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}endstream`; });
  let out = "%PDF-1.4\n"; const offsets: number[] = [];
  for (let i = 1; i < objs.length; i++) { offsets[i] = Buffer.byteLength(out, "latin1"); out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n${offsets.slice(1).map(o => String(o).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "latin1");
}
