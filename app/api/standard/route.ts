import { respond } from "@/lib/demo/http";
import { loadStandard } from "@/lib/demo/standard";
export const dynamic = "force-dynamic";
export async function GET() { return respond(async () => loadStandard()); }
