import { respond } from "@/lib/demo/http";
import { getLog } from "@/lib/demo/workflow";
export const dynamic = "force-dynamic";
export async function GET() { return respond(getLog); }
