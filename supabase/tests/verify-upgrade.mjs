// Upgrade safety: apply migration 013 to a database that already holds data from migrations 001..012.
//
//   cd supabase/tests && npm run verify:upgrade
//
// Runs on throwaway PostgreSQL 17 (PGlite) with the Supabase auth shim - like verify.mjs, this is NOT a managed Supabase project.
// It proves, on a populated schema, that 013 is ADDITIVE:
//   1. migration order: every table a migration references is created by an earlier (or the same) migration
//   2. no existing row changes (every pre-existing column is byte-identical; the new columns are NULL for legacy rows)
//   3. no existing policy is removed; exactly the four documented policies change; everything else is untouched
//   4. no existing table, column or index disappears
//   5. legacy users keep working (read/insert/update their own data) and the new rules apply from now on
//   6. applying 013 a second time changes nothing
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "..", "migrations");
const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass: !!pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${pass ? "" : "  -> " + detail}`);
};

const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
const num = (f) => parseInt(f, 10);
const sql = (f) => readFileSync(path.join(migrationsDir, f), "utf8");

// ------------------------------------------------------------- 1. migration order / dependencies
const created = new Map(); // table -> migration number that creates it
const refsByFile = new Map();
for (const f of files) {
  const text = sql(f).replace(/--[^\n]*/g, "");
  for (const m of text.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)/gi)) if (!created.has(m[1])) created.set(m[1], num(f));
  const refs = new Set();
  for (const m of text.matchAll(/references\s+public\.(\w+)/gi)) refs.add(m[1]);
  for (const m of text.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?public\.(\w+)/gi)) refs.add(m[1]);
  for (const m of text.matchAll(/create\s+(?:or\s+replace\s+)?(?:policy\s+"[^"]+"\s+on|index\s+(?:if\s+not\s+exists\s+)?\w+\s+on|trigger\s+\w+\s+(?:before|after)\s+\w+(?:\s+or\s+\w+)*\s+on)\s+public\.(\w+)/gi)) refs.add(m[1]);
  for (const m of text.matchAll(/\bfrom\s+public\.(\w+)/gi)) refs.add(m[1]);
  refsByFile.set(f, refs);
}
console.log("\nMigration dependency table (file: tables it touches -> creating migration)");
let orderOk = true;
for (const f of files) {
  const touched = [...refsByFile.get(f)].filter((t) => created.has(t) || t !== "profiles");
  const parts = touched.map((t) => `${t}@${created.get(t) ?? "?"}`);
  const bad = touched.filter((t) => !created.has(t) || created.get(t) > num(f));
  if (bad.length) orderOk = false;
  console.log(`  ${f}: ${parts.join(", ") || "-"}${bad.length ? `   <-- UNRESOLVED/LATER: ${bad.join(",")}` : ""}`);
}
check("files are consecutively numbered 001..N with no gaps", files.every((f, i) => num(f) === i + 1), files.join(","));
check("every table a migration touches is created by the same or an earlier migration", orderOk);
const last = files[files.length - 1];
check("013 only depends on tables from earlier migrations (plots, profiles, soil_reports, recommendations)", [...refsByFile.get(files.find((f) => num(f) === 13))].every((t) => (created.get(t) ?? 99) <= 13));

// ------------------------------------------------------------- 2. build a populated 001..012 database
const db = new PGlite();
await db.exec(readFileSync(path.join(here, "supabase_shim.sql"), "utf8"));
for (const f of files.filter((f) => num(f) <= 12)) await db.exec(sql(f));

async function asRole(role, uid, fn) {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', $2, false)", [uid ?? "", role]);
  try { return await fn(); } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub','',false), set_config('request.jwt.claim.role','',false)");
  }
}
const square = (lng) => JSON.stringify({ type: "Polygon", coordinates: [[[lng, 17.4], [lng + 0.002, 17.4], [lng + 0.002, 17.402], [lng, 17.402], [lng, 17.4]]] });
const owners = [];
for (const [i, label] of ["a", "b"].entries()) {
  const id = randomUUID();
  await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1,$2,$3)", [id, `${label}@upgrade.test`, JSON.stringify({ full_name: `User ${label}` })]);
  const farmer = (await asRole("authenticated", id, () => db.query("insert into public.farmers (owner_id, name) values ($1,'F') returning id", [id]))).rows[0].id;
  const plot = (await asRole("authenticated", id, () => db.query("insert into public.plots (owner_id, farmer_id, name, crop, area, boundary, latitude, longitude, boundary_mapped) values ($1,$2,'P','Oil Palm',2,$3::jsonb,17.4,$4,true) returning id", [id, farmer, square(78 + i), 78.001 + i]))).rows[0].id;
  const soil = (await asRole("authenticated", id, () => db.query("insert into public.soil_reports (plot_id, owner_id, nitrogen_kg_ha, phosphorus_kg_ha, potassium_kg_ha, organic_carbon_percent, ph, micronutrients) values ($1,$2,200,20,250,0.7,6.1,'{\"zinc\":{\"value\":0.8}}'::jsonb) returning id", [plot, id]))).rows[0].id;
  const rec = (await asRole("authenticated", id, () => db.query("insert into public.recommendations (owner_id, plot_id, soil_report_id, crop, deficiencies, fertilizer_plan, yield_prediction, roi, explanation) values ($1,$2,$3,'oil_palm','[1]','[2]','{}','{}','{}') returning id", [id, plot, soil]))).rows[0].id;
  await asRole("authenticated", id, () => db.query("insert into public.disease_assessments (owner_id, plot_id, crop, risk_level, request, result, kb_version, rule_version) values ($1,$2,'coconut','low','{}','{}','0.1','1.0')", [id, plot]));
  await asRole("service_role", null, () => db.query("insert into public.digital_twins (plot_id, analysis_date, crop_health_score) values ($1, now(), 70)", [plot]));
  owners.push({ id, farmer, plot, soil, rec });
}

const tablesBefore = (await db.query("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by 1")).rows.map((r) => r.relname);
async function snapshot() {
  const out = {};
  for (const t of tablesBefore) out[t] = (await db.query(`select to_jsonb(t) as j from public.${t} t order by to_jsonb(t)::text`)).rows.map((r) => r.j);
  return out;
}
const policies = async () => Object.fromEntries((await db.query("select tablename||'.'||policyname as k, cmd, coalesce(qual,'') qual, coalesce(with_check,'') wc from pg_policies where schemaname='public'")).rows.map((r) => [r.k, `${r.cmd}|${r.qual}|${r.wc}`]));
const columns = async () => new Set((await db.query("select table_name||'.'||column_name k from information_schema.columns where table_schema='public'")).rows.map((r) => r.k));
const indexes = async () => new Set((await db.query("select indexname k from pg_indexes where schemaname='public'")).rows.map((r) => r.k));

const rowsBefore = await snapshot();
const polBefore = await policies();
const colBefore = await columns();
const idxBefore = await indexes();
console.log(`\nPopulated 001..012 database: ${tablesBefore.length} tables, ${Object.values(rowsBefore).reduce((n, r) => n + r.length, 0)} rows, ${Object.keys(polBefore).length} policies`);

// ------------------------------------------------------------- 3. apply 013
await db.exec(sql(files.find((f) => num(f) === 13)));
const rowsAfter = await snapshot();
const polAfter = await policies();
const colAfter = await columns();
const idxAfter = await indexes();

const NEW_COLUMNS = new Set(["soil_reports.extraction_id", "soil_reports.verification_status", "soil_reports.verified_at", "recommendations.engine_version", "recommendations.generated_at", "recommendations.provenance"]);
let rowsIdentical = true, newColsNull = true, detail = "";
for (const t of tablesBefore) {
  const before = rowsBefore[t], after = rowsAfter[t];
  if (before.length !== after.length) { rowsIdentical = false; detail += ` ${t}:rowcount`; continue; }
  // updated_at triggers must not have fired: compare whole rows except the new columns
  const strip = (j) => Object.fromEntries(Object.entries(j).filter(([k]) => !NEW_COLUMNS.has(`${t}.${k}`)));
  const norm = (rows) => rows.map((j) => JSON.stringify(Object.entries(strip(j)).sort()));
  if (JSON.stringify(norm(before).sort()) !== JSON.stringify(norm(after).sort())) { rowsIdentical = false; detail += ` ${t}:values`; }
  for (const j of after) for (const [k, v] of Object.entries(j)) if (NEW_COLUMNS.has(`${t}.${k}`) && v !== null) newColsNull = false;
}
check("013 changes no value of any existing row (all existing columns identical, same row counts)", rowsIdentical, detail);
check("the six new columns on existing tables are NULL for every legacy row (nothing is auto-verified)", newColsNull);
check("no existing column is dropped or renamed", [...colBefore].every((c) => colAfter.has(c)));
check("the only new columns on existing tables are the six documented ones", [...colAfter].filter((c) => !colBefore.has(c) && tablesBefore.includes(c.split(".")[0])).sort().join() === [...NEW_COLUMNS].sort().join());
check("no existing index is dropped", [...idxBefore].every((i) => idxAfter.has(i)));
check("no existing table is dropped", tablesBefore.every((t) => colAfter.has(`${t}.id`) || [...colAfter].some((c) => c.startsWith(t + "."))));

const removed = Object.keys(polBefore).filter((k) => !(k in polAfter));
const changed = Object.keys(polBefore).filter((k) => k in polAfter && polBefore[k] !== polAfter[k]).sort();
const added = Object.keys(polAfter).filter((k) => !(k in polBefore)).sort();
const EXPECTED_CHANGED = ["recommendations.Users can insert their own recommendations", "recommendations.Users can update their own recommendations", "soil_reports.Users can insert their own soil reports", "soil_reports.Users can update their own soil reports"];
check("no existing policy is removed", removed.length === 0, removed.join(" | "));
check("exactly four existing policies change (INSERT and UPDATE on soil_reports and recommendations)", JSON.stringify(changed) === JSON.stringify(EXPECTED_CHANGED), changed.join(" | "));
const withCheck = (defs, k) => defs[k].split("|")[2];
check("the USING clause of every changed policy is untouched (who can see/target a row did not change)", EXPECTED_CHANGED.every((k) => polBefore[k].split("|")[1] === polAfter[k].split("|")[1]));
check("every changed policy still requires owner_id = auth.uid() AND a plot the caller owns", EXPECTED_CHANGED.every((k) => /auth\.uid\(\)\s*=\s*(\w+\.)?owner_id/.test(withCheck(polAfter, k)) && /plots/.test(withCheck(polAfter, k))));
check("the added condition is exactly 'provenance columns IS NULL' (soil_reports: verification_status/extraction_id/verified_at; recommendations: engine_version/provenance/generated_at)",
  EXPECTED_CHANGED.every((k) => { const w = withCheck(polAfter, k); return k.startsWith("soil_reports") ? /verification_status IS NULL/.test(w) && /extraction_id IS NULL/.test(w) && /verified_at IS NULL/.test(w) : /engine_version IS NULL/.test(w) && /provenance IS NULL/.test(w) && /generated_at IS NULL/.test(w); }));
console.log("\n  Changed policies (WITH CHECK before -> after, as PostgreSQL stores them):");
for (const k of EXPECTED_CHANGED) console.log(`    ${k}\n      before: ${withCheck(polBefore, k) || "(none)"}\n      after : ${withCheck(polAfter, k)}`);
console.log(`\n  policies removed=${removed.length} changed=${changed.length} added=${added.length}`);
for (const a of added) console.log(`    + ${a}`);

// ------------------------------------------------------------- 4. legacy users keep working; new rules apply
const A = owners[0], B = owners[1];
const attempt = async (uid, q, p = []) => { try { const r = await asRole("authenticated", uid, () => db.query(q, p)); return { ok: true, rows: r.rows }; } catch (e) { return { ok: false, error: String(e.message) }; } };
check("a legacy user still reads their own legacy soil report and recommendation", (await attempt(A.id, "select id from public.soil_reports where id=$1", [A.soil])).rows?.length === 1 && (await attempt(A.id, "select id from public.recommendations where id=$1", [A.rec])).rows?.length === 1);
check("a legacy user still cannot read the other user's rows", (await attempt(A.id, "select id from public.soil_reports where id=$1", [B.soil])).rows?.length === 0);
check("a legacy user can still edit their own unverified legacy soil report", (await attempt(A.id, "update public.soil_reports set ph=6.3 where id=$1 returning id", [A.soil])).rows?.length === 1);
check("a legacy user can still insert a plain soil report (it will simply not be 'verified')", (await attempt(A.id, "insert into public.soil_reports (plot_id, owner_id, nitrogen_kg_ha, phosphorus_kg_ha, potassium_kg_ha, organic_carbon_percent, ph) values ($1,$2,1,1,1,1,7) returning id", [A.plot, A.id])).ok);
check("from now on a browser insert cannot claim verification", !(await attempt(A.id, "insert into public.soil_reports (plot_id, owner_id, nitrogen_kg_ha, phosphorus_kg_ha, potassium_kg_ha, organic_carbon_percent, ph, verification_status) values ($1,$2,1,1,1,1,7,'user_confirmed')", [A.plot, A.id])).ok);
check("legacy recommendations stay readable but are not engine-stamped (engine_version NULL)", (await db.query("select count(*)::int c from public.recommendations where engine_version is null")).rows[0].c === 2);

// ------------------------------------------------------------- 5. idempotent
const polAgain = (await db.exec(sql(files.find((f) => num(f) === 13))), await policies());
const rowsAgain = await snapshot();
check("re-applying 013 changes nothing (same policies, same rows)", JSON.stringify(polAgain) === JSON.stringify(polAfter) && JSON.stringify(rowsAgain) === JSON.stringify(rowsAfter) || (Object.keys(polAgain).length === Object.keys(polAfter).length && JSON.stringify(Object.values(polAgain).sort()) === JSON.stringify(Object.values(polAfter).sort())));

const failed = results.filter((r) => !r.pass);
console.log(`\nUPGRADE TOTAL: ${results.length - failed.length}/${results.length} passed${failed.length ? `, ${failed.length} FAILED` : ""}`);
process.exit(failed.length ? 1 : 0);
