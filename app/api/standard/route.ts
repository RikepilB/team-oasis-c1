import { SHIPPED_FILES_CACHE, respond } from "@/lib/demo/http";
import { loadStandard } from "@/lib/demo/standard";
export const dynamic = "force-dynamic";
export async function GET() {
  const res = await respond(async () => loadStandard());
  if (res.ok) res.headers.set("Cache-Control", SHIPPED_FILES_CACHE);
  return res;
}
