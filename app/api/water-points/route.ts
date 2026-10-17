import { respond } from "@/lib/demo/http";
import { cachedEvidence } from "@/lib/database/evidence-cache";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  let cache = "bypass";
  const response = await respond(async () => {
    const result = await cachedEvidence(Object.fromEntries(["snapshot", "cutoff", "definition", "group", "district"].filter(k => q.has(k)).map(k => [k, q.get(k)!])));
    cache = result.cache; return result.data;
  });
  response.headers.set("X-Synapse-Cache", cache);
  return response;
}
