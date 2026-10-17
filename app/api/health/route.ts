import { redisConfigured } from "@/lib/database/evidence-cache";
import { databasePool, storageMode } from "@/lib/database/runtime";
export const dynamic = "force-dynamic";
export async function GET() {
 try { const storage=storageMode(); if(storage==="postgres") await databasePool().query("SELECT 1"); return Response.json({application:"Synapse",storage,provider:"replay",identity:"demo",cache:redisConfigured()?"redis_configured":"not_configured"},{headers:{"Cache-Control":"no-store"}}); }
 catch { return Response.json({error:{code:"storage_unavailable",message:"Configured storage is unavailable. No fallback was used."}},{status:503}); }
}
