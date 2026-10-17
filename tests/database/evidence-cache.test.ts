import { afterEach, beforeEach, test, expect, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { cachedEvidence } from "@/lib/database/evidence-cache";
import { getRecord } from "@/lib/demo/workflow";
let folder: string;
beforeEach(()=>{folder=mkdtempSync(path.join(tmpdir(),"synapse-cache-"));vi.stubEnv("SYNAPSE_DATA_DIR","data/fixtures/demo");vi.stubEnv("SYNAPSE_RUNTIME_DIR",folder);vi.stubEnv("SYNAPSE_STORAGE","file");vi.stubEnv("UPSTASH_REDIS_REST_URL","https://cache.example.test");vi.stubEnv("UPSTASH_REDIS_REST_TOKEN","synthetic-test-token");});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();rmSync(folder,{recursive:true,force:true});});
test("immutable evidence hits Redis while mutable queries bypass it",async()=>{
 const saved=new Map<string,string>();const request=vi.fn(async(_url:unknown,init:RequestInit)=>{const [cmd,key,value]=JSON.parse(init.body as string);if(cmd==="SET")saved.set(key,value);return Response.json({result:cmd==="GET"?saved.get(key)||null:"OK"});});vi.stubGlobal("fetch",request);
 const record=await getRecord("fixture-q1");const query={snapshot:record.snapshot_id,cutoff:record.period_end};const first=await cachedEvidence(query);expect(first.cache).toBe("miss");const second=await cachedEvidence(query);expect(second.cache).toBe("hit");expect(second.data).toEqual(first.data);const before=request.mock.calls.length;expect((await cachedEvidence()).cache).toBe("bypass");expect(request.mock.calls.length).toBe(before);
});
test("Redis outage and corrupt payload fall back without changing evidence",async()=>{
 const record=await getRecord("fixture-q1");const query={snapshot:record.snapshot_id};vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new Error("offline")));const fallback=await cachedEvidence(query);expect(fallback.data.snapshot_id).toBe(record.snapshot_id);vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({result:"{bad"})));expect((await cachedEvidence(query)).data).toEqual(fallback.data);
});
test("snapshot cutoff mismatch is rejected even when Redis is unavailable",async()=>{
 const r=await getRecord("fixture-q1");vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new Error("offline")));await expect(cachedEvidence({snapshot:r.snapshot_id,cutoff:"2020-01-01"})).rejects.toThrow(/Cutoff/);
});
