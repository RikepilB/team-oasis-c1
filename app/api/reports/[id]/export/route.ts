import { getExport, runAction } from "@/lib/demo/workflow";
import { respond, parseAction } from "@/lib/demo/http";
import { toDocx, toPdf, toXlsx } from "@/lib/demo/office";
// Same approved text in four formats; Markdown stays the stored record.
const FORMATS = {
  md: { ext: ".md", type: "text/markdown; charset=utf-8" },
  pdf: { ext: ".pdf", type: "application/pdf" },
  docx: { ext: ".docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  xlsx: { ext: ".xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
} as const;
export const dynamic = "force-dynamic";
export async function GET(req: Request, { params }: {
  params: Promise<{
    id: string;
  }>;
}) {
  try {
    const { id } = await params;
    const q = new URL(req.url).searchParams;
    const format = (q.get("format") || "md") as keyof typeof FORMATS;
    if (!(format in FORMATS)) return Response.json({ error: { code: "invalid_format", message: "Use md, pdf, docx or xlsx." } }, { status: 400 });
    const out = await getExport(id, q.get("funder_id") || "", Number(q.get("revision")));
    const body = format === "pdf" ? toPdf(out.content) : format === "docx" ? toDocx(out.content, q.get("funder_id") === "quebec" ? "fr" : "en") : format === "xlsx" ? toXlsx(out.content) : out.content;
    const filename = out.filename.replace(/\.md$/, "") + FORMATS[format].ext;
    return new Response(typeof body === "string" ? body : new Uint8Array(body), { headers: { "Content-Type": FORMATS[format].type, "Content-Disposition": 'attachment; filename="' + filename + '"', "Cache-Control": "no-store" } });
  }
  catch (e) {
    return respond(async () => { throw e; });
  }
}
export async function POST(req: Request, { params }: {
  params: Promise<{
    id: string;
  }>;
}) { return respond(async () => { const { id } = await params; return runAction(id, "export", await parseAction(req)); }); }
