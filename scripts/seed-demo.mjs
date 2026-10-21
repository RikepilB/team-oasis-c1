// Walks the demo reports to different stages through the public API, so every screen has something to show.
// Every number, check and log line comes from the real workflow; nothing is written to storage directly.
// Only reports still untouched are seeded, so running it twice adds nothing. Usage: node scripts/seed-demo.mjs <base-url>
const base = process.argv[2]?.replace(/\/$/, "");
if (!base) throw new Error("Usage: node scripts/seed-demo.mjs <base-url>");
const PREP = { daniel: "Daniel", grace: "Grace" }, REVIEWER = "Bilingual Content Coordinator", APPROVER = "Director, International Programmes";
async function call(route, body) {
  const r = await fetch(base + route, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  const value = await r.json();
  if (!r.ok) throw new Error(route + ": " + JSON.stringify(value));
  return value;
}
const get = id => call(`/api/reports/${id}`);
async function prepare(id, who, steps) {
  for (const step of steps) await call(`/api/reports/${id}/${step}`, { actor: who, preparer: who });
}
async function build(id, who, funder) {
  const r = await get(id);
  const t = r.templates[funder];
  return call(`/api/reports/${id}/template`, { actor: who, funder_id: funder, ...(t ? { expected_revision: t.revision } : {}) });
}
// The reviewer approves each flagged word; with fix=true the first one that has a suggestion is declined and corrected instead.
async function reviewFrench(id, fix) {
  let r = await get(id), fixed = false;
  for (const item of r.french.items.filter(i => !i.decision)) {
    if (fix && !fixed && item.alternatives.length) {
      r = await call(`/api/reports/${id}/french_item`, { actor: REVIEWER, key: item.id, decision: "decline", note: "The funder uses this wording in its own reports.", value: item.alternatives[0] });
      fixed = r.french.check === "green";
      if (!fixed) throw new Error(id + ": the suggested fix changed a number");
    } else r = await call(`/api/reports/${id}/french_item`, { actor: REVIEWER, key: item.id, decision: "approve" });
  }
  return call(`/api/reports/${id}/review`, { actor: REVIEWER, funder_id: "quebec", expected_revision: r.templates.quebec.revision });
}
async function approve(id, funder, exportToo) {
  const r = await get(id);
  const input = { actor: APPROVER, funder_id: funder, expected_revision: r.templates[funder].revision };
  await call(`/api/reports/${id}/approve`, input);
  if (exportToo) await call(`/api/reports/${id}/export`, input);
}
const PREP_ALL = ["extract", "clean", "validate", "french"];
// One stage per report, from untouched to completed.
const PLAN = {
  "demo-river-may": null, // Received and unassigned: the place to show step one live.
  "demo-school-jun": async id => prepare(id, PREP.grace, ["extract", "clean"]),
  "demo-spring-q1": async id => { await prepare(id, PREP.daniel, ["extract", "clean", "validate"]); await build(id, PREP.daniel, "fdf"); },
  "demo-spring-q4": async id => { await prepare(id, PREP.daniel, PREP_ALL); await build(id, PREP.daniel, "fdf"); await build(id, PREP.daniel, "quebec"); },
  "fixture-q1": async id => { await prepare(id, PREP.daniel, PREP_ALL); await build(id, PREP.daniel, "fdf"); await build(id, PREP.daniel, "quebec"); await reviewFrench(id, false); await approve(id, "fdf", false); },
  "fixture-q4": async id => { await prepare(id, PREP.grace, PREP_ALL); await build(id, PREP.grace, "fdf"); await build(id, PREP.grace, "quebec"); await reviewFrench(id, true); await approve(id, "fdf", true); await approve(id, "quebec", true); },
};
const done = [];
for (const [id, run] of Object.entries(PLAN)) {
  const r = await get(id);
  if (!run || r.preparer?.trim() || r.completed?.length) { done.push({ id, seeded: false }); continue; }
  await run(id);
  done.push({ id, seeded: true });
}
const log = await call("/api/log");
console.log(JSON.stringify({ base, reports: done, audit_valid: log.valid, log_entries: log.entries.length }, null, 2));
