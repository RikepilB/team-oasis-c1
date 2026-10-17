import { readFile } from "node:fs/promises";
import pg from "pg";
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL on the server before migrating.");
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
try { await pool.query(await readFile(new URL("../database/migrations/001_runtime.sql",import.meta.url),"utf8")); console.log("Synapse runtime schema ready."); } finally { await pool.end(); }
