import { reportCatalog } from "@/lib/demo/catalog";
import { respond } from "@/lib/demo/http";
export const dynamic="force-dynamic";
export async function GET(){return respond(reportCatalog);}
