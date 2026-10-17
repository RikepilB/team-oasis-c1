import assert from "node:assert/strict";
const base=process.argv[2];
if(!base) throw new Error("Usage: node scripts/smoke-demo.mjs <demo-base-url>");
async function request(route,body,fail=false){const r=await fetch(base+route,body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{});const value=await r.json();if(fail){assert.ok(!r.ok,route+" must reject");return value;}assert.ok(r.ok,route+": "+JSON.stringify(value));return value;}
const before=await request("/api/log");const runs=[];
for(let cycle=0;cycle<2;cycle++)for(const id of ["fixture-q1","fixture-q4"]){
 let r;
 for(const action of ["extract","clean","validate","french"])r=await request(`/api/reports/${id}/${action}`,{actor:"Casey",preparer:"Casey"});
 for(const funder of ["fdf","quebec"]){
  r=await request(`/api/reports/${id}`);
  r=await request(`/api/reports/${id}/template`,{actor:"Casey",funder_id:funder,...(r.templates[funder]?{expected_revision:r.templates[funder].revision}:{})});
  let input={actor:"Morgan",funder_id:funder,expected_revision:r.templates[funder].revision};
  await request(`/api/reports/${id}/approve`,{...input,actor:"Casey"},true);
  if(funder==="quebec"){await request(`/api/reports/${id}/approve`,input,true);await request(`/api/reports/${id}/review`,{...input,actor:"Camille"});}
  await request(`/api/reports/${id}/approve`,input);
  if(cycle===0&&funder==="fdf"){
   const field=r.templates[funder].fields.find(f=>f.kind==="narrative");const stale=input.expected_revision;
   r=await request(`/api/reports/${id}/edit`,{...input,actor:"Casey",key:field.key,value:field.value+" Reviewed."});
   assert.equal(r.templates[funder].approval,null);
   await request(`/api/reports/${id}/export`,{...input,expected_revision:stale},true);
   input={...input,expected_revision:r.templates[funder].revision};await request(`/api/reports/${id}/approve`,input);
  }
  await Promise.all([request(`/api/reports/${id}/export`,input),request(`/api/reports/${id}/export`,input)]);
  const download=await fetch(base+`/api/reports/${id}/export?funder_id=${funder}&revision=${input.expected_revision}`);assert.equal(download.status,200);assert.ok((await download.text()).includes("Morgan"));runs.push({cycle:cycle+1,id,funder,revision:input.expected_revision});
 }
}
const log=await request("/api/log");assert.ok(log.valid);assert.equal(log.entries.filter(e=>e.action==="export").length-before.entries.filter(e=>e.action==="export").length,8);
const r=await request("/api/reports/fixture-q1");const q=new URLSearchParams({snapshot:r.snapshot_id,cutoff:r.period_end,definition:"incl_partly"});const cache=[];
for(let i=0;i<2;i++){const response=await fetch(base+"/api/water-points?"+q);assert.equal(response.status,200);assert.equal((await response.json()).snapshot_id,r.snapshot_id);cache.push(response.headers.get("x-synapse-cache"));}
const answer=await request("/api/reports/fixture-q1/questions",{question:"Where does functionality come from?",language:"en"});assert.ok(answer.citations.length);assert.ok(answer.citations.every(c=>r.original_text.includes(c.quote)));
console.log(JSON.stringify({base,runs,audit_valid:log.valid,unique_exports:8,evidence_cache:cache,verified_source_quotes:answer.citations.length},null,2));
