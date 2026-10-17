import { respond } from "@/lib/demo/http";
import { listInbox } from "@/lib/demo/workflow";
export const dynamic = "force-dynamic";
export async function GET() { return respond(listInbox); }
