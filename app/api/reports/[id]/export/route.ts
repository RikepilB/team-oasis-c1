import { getExport, runAction } from "@/lib/demo/workflow";
import { respond, parseAction } from "@/lib/demo/http";
export const dynamic = "force-dynamic";
export async function GET(req: Request, { params }: {
  params: Promise<{
    id: string;
  }>;
}) {
  try {
    const { id } = await params;
    const q = new URL(req.url).searchParams;
    const out = await getExport(id, q.get("funder_id") || "", Number(q.get("revision")));
    return new Response(out.content, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": 'attachment; filename="' + out.filename + '"', "Cache-Control": "no-store" } });
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
