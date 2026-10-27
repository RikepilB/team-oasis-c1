// Checks that live AI works before a demo: reads .env.local, sends one tiny request, prints the result.
// Run: npm run ai:check   (needs ANTHROPIC_API_KEY in .env.local; SYNAPSE_MODEL is optional)
import Anthropic from "@anthropic-ai/sdk";

const model = process.env.SYNAPSE_MODEL?.trim() || "claude-haiku-5-5";
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("✕ No ANTHROPIC_API_KEY found. Add a line ANTHROPIC_API_KEY=... to .env.local in the project folder, then run this again.");
  process.exit(1);
}
try {
  const client = new Anthropic();
  const started = Date.now();
  const res = await client.messages.create({
    model,
    max_tokens: 64,
    messages: [{ role: "user", content: "Translate to Canadian French, reply with the translation only: 80% of water points were working." }],
  });
  const text = res.content.filter(b => b.type === "text").map(b => b.text).join("").trim();
  console.log(`✓ Live AI works. Model: ${res.model} · ${Date.now() - started} ms`);
  console.log(`  Sample answer: ${text}`);
  console.log(`  Next: set AI_MODE=live in .env.local and restart Synapse to use it in the app.`);
} catch (e) {
  const status = e?.status ? ` (HTTP ${e.status})` : "";
  console.error(`✕ The call failed${status}: ${e?.message ?? e}`);
  if (e?.status === 401) console.error("  The key was rejected. Check you copied the whole key into .env.local.");
  if (e?.status === 404) console.error(`  The model "${model}" was not found for this key. Check SYNAPSE_MODEL.`);
  process.exit(1);
}
