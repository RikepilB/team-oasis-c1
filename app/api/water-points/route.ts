import { respond } from "@/lib/demo/http";
import { getEvidence } from "@/lib/demo/workflow";
export const dynamic = "force-dynamic";
export async function GET(req: Request) { const q = new URL(req.url).searchParams; return respond(() => getEvidence(Object.fromEntries(["snapshot", "cutoff", "definition", "group", "district"].filter(k => q.has(k)).map(k => [k, q.get(k)!])))); }
