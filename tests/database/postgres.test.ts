import { beforeEach,afterAll,test,expect } from "vitest";
import { randomUUID } from "node:crypto";
import { existsSync,readFileSync,mkdtempSync,cpSync,writeFileSync,rmSync } from "node:fs";
import path from "node:path";
import { databasePool,closeDatabase,postgresTransaction } from "@/lib/database/runtime";
import { context,atomic,readJson } from "@/lib/demo/store";
import { runAction,getRecord,getLog,getExport } from "@/lib/demo/workflow";
import { answerQuestion } from "@/lib/demo/questions";
const real=test.runIf(process.env.SYNAPSE_DATABASE_TEST==="1");
beforeEach(()=>{if(process.env.SYNAPSE_DATABASE_TEST==="1"){process.env.SYNAPSE_STORAGE="postgres";process.env.SYNAPSE_DATA_DIR="data/fixtures/demo";process.env.SYNAPSE_RUNTIME_DIR="data/runtime/pg-test-"+randomUUID();}});
afterAll(async()=>{await closeDatabase();});
async function prepared(id="fixture-q1",funder:"fdf"|"quebec"="fdf"){
 for(const action of ["extract","clean","validate","french"])await runAction(id,action,{actor:"Casey",preparer:"Casey"});
 const current=await getRecord(id);return runAction(id,"template",{actor:"Casey",funder_id:funder,...(current.templates[funder]?{expected_revision:current.templates[funder]!.revision}:{})});
}
real("PostgreSQL repeats both reports and funders twice, enforcing human review",async()=>{
 for(let cycle=0;cycle<2;cycle++)for(const id of ["fixture-q1","fixture-q4"])for(const funder of ["fdf","quebec"] as const){
  let r=await prepared(id,funder);const input={actor:"Morgan",funder_id:funder,expected_revision:r.templates[funder]!.revision};
  await expect(runAction(id,"approve",{...input,actor:"Casey"})).rejects.toThrow(/different/);
  if(funder==="quebec"){await expect(runAction(id,"approve",input)).rejects.toThrow(/French/);for(const i of (await getRecord(id)).french?.items??[])await runAction(id,"french_item",{actor:"Camille",key:i.id,decision:"approve"});r=await runAction(id,"review",{...input,actor:"Camille"});}
  await runAction(id,"approve",input);await Promise.all([runAction(id,"export",input),runAction(id,"export",input)]);
  expect((await getExport(id,funder,r.templates[funder]!.revision)).content).toContain("Morgan");
 }
 expect((await getLog()).valid).toBe(true);
 expect((await getLog()).entries.filter(e=>e.action==="export")).toHaveLength(8);
 expect(existsSync(path.join(context().runtime,"records/fixture-q1.json"))).toBe(false);
},30000);
real("PostgreSQL rolls back changed state when a transaction fails",async()=>{
 const c=context();const file=path.join(c.runtime,"records/probe.json");
 await expect(postgresTransaction(c.runtime,async()=>{atomic(file,{value:1});throw new Error("deliberate rollback");})).rejects.toThrow("deliberate rollback");
 const rows=await databasePool().query("SELECT * FROM synapse_documents WHERE namespace=$1 AND key=$2",[c.runtime,"records/probe.json"]);expect(rows.rowCount).toBe(0);
});
real("a valid edit invalidates approval and stale export cannot proceed in PostgreSQL",async()=>{
 const r=await prepared();const rev=r.templates.fdf!.revision;await runAction("fixture-q1","approve",{actor:"Morgan",funder_id:"fdf",expected_revision:rev});
 const edited=await runAction("fixture-q1","edit",{actor:"Casey",funder_id:"fdf",key:"progress",value:"Reported functionality remains 80%.",expected_revision:rev});expect(edited.templates.fdf!.approval).toBeNull();
 await expect(runAction("fixture-q1","export",{actor:"Morgan",funder_id:"fdf",expected_revision:rev})).rejects.toThrow();
});
real("database guards reject source, snapshot and audit rewriting",async()=>{
 const r=await prepared();const c=context();
 await expect(databasePool().query("UPDATE synapse_documents SET content=$3 WHERE namespace=$1 AND key=$2",[c.runtime,"records/fixture-q1.json",JSON.stringify({...r,original_text:"invented"})])).rejects.toThrow(/immutable/);
 await expect(databasePool().query("DELETE FROM synapse_documents WHERE namespace=$1 AND key LIKE 'snapshots/%'",[c.runtime])).rejects.toThrow(/immutable/);
 await expect(databasePool().query("UPDATE synapse_audit SET payload='{}' WHERE namespace=$1",[c.runtime])).rejects.toThrow(/immutable/);
 expect((await getRecord("fixture-q1")).original_text).toBe(r.original_text);expect((await getLog()).valid).toBe(true);
});
real("evidence questions return only verified quotes and preserve exact snapshot links",async()=>{
 await prepared();const answer=await answerQuestion("fixture-q1",{question:"Where does functionality come from?",language:"en"});const record=await getRecord("fixture-q1");
 expect(answer.mode).toBe("verified_api");expect(answer.citations.length).toBeGreaterThan(0);for(const citation of answer.citations)expect(record.original_text).toContain(citation.quote);
 expect(answer.links.some(l=>l.href.includes(record.snapshot_id))).toBe(true);
 const absent=await answerQuestion("fixture-q1",{question:"unicorn spaceship",language:"fr"});expect(absent.citations).toEqual([]);
});
real("schema is present and repeatable",async()=>{await databasePool().query(readFileSync("database/migrations/001_runtime.sql","utf8"));await expect(postgresTransaction(context().runtime,async()=>{const file=path.join(context().runtime,"records/check.json");atomic(file,{ok:true});return readJson(file);})).resolves.toEqual({ok:true});});

real("competing edits serialize and only one expected revision succeeds",async()=>{
 const r=await prepared();const input={actor:"Casey",funder_id:"fdf" as const,key:"progress",value:"Reported functionality remains 80%.",expected_revision:r.templates.fdf!.revision};
 const results=await Promise.allSettled([runAction("fixture-q1","edit",input),runAction("fixture-q1","edit",input)]);expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);expect((await getLog()).entries.filter(e=>e.action==="correct")).toHaveLength(1);
});
real("an exported snapshot cannot be overwritten or deleted through SQL",async()=>{
 const r=await prepared();const input={actor:"Morgan",funder_id:"fdf" as const,expected_revision:r.templates.fdf!.revision};await runAction("fixture-q1","approve",input);await runAction("fixture-q1","export",input);
 await expect(databasePool().query("UPDATE synapse_documents SET content='changed' WHERE namespace=$1 AND key LIKE 'exports/%'",[context().runtime])).rejects.toThrow(/immutable/);
 await expect(databasePool().query("DELETE FROM synapse_documents WHERE namespace=$1 AND key LIKE 'exports/%'",[context().runtime])).rejects.toThrow(/immutable/);
 expect((await getExport("fixture-q1","fdf",input.expected_revision)).content).toContain("Morgan");
});

real("blocked private input keeps its audit without committing a partial report",async()=>{
 const folder=mkdtempSync(path.join(process.cwd(),"data/runtime/privacy-pg-"));
 try{cpSync("data/fixtures/demo",folder,{recursive:true});const file=path.join(folder,"inbox/fixture-q1.txt");writeFileSync(file,readFileSync(file,"utf8")+" Contact private@example.test.");process.env.SYNAPSE_DATA_DIR=folder;
 await expect(runAction("fixture-q1","extract",{actor:"Casey"})).rejects.toThrow(/Personal/);const log=await getLog();expect(log.valid).toBe(true);expect(log.entries.some(e=>e.action==="blocked")).toBe(true);expect(JSON.stringify(log.entries)).not.toContain("private@example.test");
 }finally{rmSync(folder,{recursive:true,force:true});}
});

real("a stable deployment namespace survives a different runtime root",async()=>{
 process.env.SYNAPSE_NAMESPACE="synapse-test-"+randomUUID();
 try{
  const r=await prepared();const firstRoot=context().runtime;
  process.env.SYNAPSE_RUNTIME_DIR="data/runtime/another-deployment-"+randomUUID();
  expect(context().runtime).not.toBe(firstRoot);
  const resumed=await getRecord("fixture-q1");expect(resumed.revision).toBe(r.revision);expect(resumed.snapshot_id).toBe(r.snapshot_id);expect((await getLog()).valid).toBe(true);
 }finally{delete process.env.SYNAPSE_NAMESPACE;}
});
