// Repeatable migration + row-level-security verification.
//
//   cd supabase/tests && npm install && npm run verify
//
// Runs on a throwaway in-process PostgreSQL (PGlite = real Postgres compiled to
// WASM) with a tiny Supabase auth shim (supabase_shim.sql). It does NOT touch any
// Supabase project and needs no credentials. A real scratch-project run is in
// verify-remote.mjs.
//
// Users are exercised through `SET ROLE authenticated` plus the PostgREST JWT
// GUCs -- the same mechanism Supabase uses -- never as a superuser.

import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "..", "migrations");

const results = [];
const record = (group, name, pass, detail = "") => {
  results.push({ group, name, pass, detail });
  if (!pass) console.log(`  FAIL [${group}] ${name} ${detail}`);
};

const db = new PGlite();

// ---------------------------------------------------------------- helpers
async function asRole(role, uid, fn) {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', $2, false)", [
    uid ?? "",
    role,
  ]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub','',false), set_config('request.jwt.claim.role','',false)");
  }
}
const asUser = (uid, fn) => asRole("authenticated", uid, fn);
const asService = (fn) => asRole("service_role", null, fn);
const asAnon = (fn) => asRole("anon", null, fn);

async function attempt(role, uid, query, params = []) {
  try {
    const r = await asRole(role, uid, () => db.query(query, params));
    return { ok: true, rows: r.rows, affected: r.affectedRows ?? r.rows.length };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}
const RLS_OR_PERM = /row-level security|permission denied|violates|not allowed/i;

async function expectNoRows(group, name, uid, query, params = []) {
  const r = await attempt("authenticated", uid, query, params);
  record(group, name, (r.ok && r.rows.length === 0) || (!r.ok && RLS_OR_PERM.test(r.error)), r.ok ? `returned ${r.rows.length} rows` : r.error);
}
async function expectUntouched(group, name, uid, query, params = []) {
  // UPDATE/DELETE ... RETURNING id : must affect nothing (or be rejected outright)
  const r = await attempt("authenticated", uid, query, params);
  record(group, name, (r.ok && r.rows.length === 0) || (!r.ok && RLS_OR_PERM.test(r.error)), r.ok ? `affected ${r.rows.length} rows` : r.error);
}
async function expectRejected(group, name, uid, query, params = []) {
  const r = await attempt("authenticated", uid, query, params);
  record(group, name, !r.ok && RLS_OR_PERM.test(r.error), r.ok ? "statement SUCCEEDED (should be denied)" : r.error);
}
async function expectAllowed(group, name, uid, query, params = []) {
  const r = await attempt("authenticated", uid, query, params);
  record(group, name, r.ok, r.ok ? "" : r.error);
  return r;
}

// ------------------------------------------------------------ 1. migrations
console.log("== 1. Applying migrations to a clean database");
await db.exec(readFileSync(path.join(here, "supabase_shim.sql"), "utf8"));
const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
let migrationsOk = true;
for (const f of files) {
  try {
    await db.exec(readFileSync(path.join(migrationsDir, f), "utf8"));
    record("migrations", `apply ${f}`, true);
  } catch (e) {
    record("migrations", `apply ${f}`, false, String(e.message));
    migrationsOk = false;
    break; // later migrations depend on this one; diagnose before continuing
  }
}
record("migrations", "files are consecutively numbered 001..N", files.every((f, i) => f.startsWith(String(i + 1).padStart(3, "0"))), files.join(","));

if (migrationsOk) {
  // 011 claims to be idempotent: re-running it must not error or duplicate policies.
  const policiesBefore = (await db.query("select count(*)::int c from pg_policies where schemaname='public'")).rows[0].c;
  try {
    await db.exec(readFileSync(path.join(migrationsDir, files[files.length - 1]), "utf8"));
    const policiesAfter = (await db.query("select count(*)::int c from pg_policies where schemaname='public'")).rows[0].c;
    record("migrations", "latest migration is idempotent (re-run, same policy count)", policiesBefore === policiesAfter, `${policiesBefore} -> ${policiesAfter}`);
  } catch (e) {
    record("migrations", "latest migration is idempotent (re-run)", false, String(e.message));
  }
}

if (process.env.WEAKEN === "1" && migrationsOk) {
  console.log("!! WEAKEN=1: re-creating the pre-migration-011 policies (mutation test; failures are EXPECTED)");
  await db.exec(`
    drop policy "Users can update their own plot" on public.plots;
    create policy "Users can update their own plot" on public.plots for update using (auth.uid() = owner_id);
    drop policy "Users can insert their own soil reports" on public.soil_reports;
    create policy "Users can insert their own soil reports" on public.soil_reports for insert with check (auth.uid() = owner_id);
    drop policy "Users can update their own soil reports" on public.soil_reports;
    create policy "Users can update their own soil reports" on public.soil_reports for update using (auth.uid() = owner_id);
    drop policy "Users can insert their own recommendations" on public.recommendations;
    create policy "Users can insert their own recommendations" on public.recommendations for insert with check (auth.uid() = owner_id);
    drop policy "Users can update their own recommendations" on public.recommendations;
    create policy "Users can update their own recommendations" on public.recommendations for update using (auth.uid() = owner_id);
  `);
}

// -------------------------------------------------------- 2. schema vs app
console.log("== 2. Schema inspection vs what the application uses");
const expected = {
  profiles: ["id", "email", "full_name", "phone_number", "user_role", "district", "state", "village", "preferred_language", "organization_name", "updated_at"],
  farmers: ["id", "owner_id", "name", "village", "district", "contact", "email", "crop", "area", "status", "created_at"],
  plots: ["id", "owner_id", "farmer_id", "name", "crop", "area", "area_unit", "boundary", "latitude", "longitude", "village", "taluk", "district", "state", "country", "planting_date", "plantation_age", "plant_count", "irrigation_type", "elevation", "soil", "stage", "status", "boundary_mapped", "soil_report_attached", "created_at"],
  soil_reports: ["id", "plot_id", "owner_id", "nitrogen_kg_ha", "phosphorus_kg_ha", "potassium_kg_ha", "organic_carbon_percent", "ph", "electrical_conductivity", "micronutrients", "validation_summary", "status", "created_at"],
  recommendations: ["id", "owner_id", "plot_id", "soil_report_id", "crop", "deficiencies", "fertilizer_plan", "yield_prediction", "roi", "explanation", "status", "created_at", "updated_at"],
  digital_twins: ["id", "plot_id", "analysis_date", "crop_health_score", "water_stress_score", "nutrient_health_score", "growth_stage", "yield_prediction", "risk_level", "model_version", "confidence_score", "ndvi", "disease_name", "disease_probability", "disease_explanation", "recommended_action", "advisory_reason", "temperature_c", "humidity_pct", "rainfall_mm", "soil_health_index", "foliar_health_score", "data_completeness", "is_synthetic"],
  ndvi_readings: ["id", "plot_id", "captured_date", "ndvi_mean", "ndvi_min", "ndvi_max", "cloud_cover_pct", "source", "is_synthetic"],
  weather_observations: ["id", "plot_id", "observed_date", "temperature_c", "humidity_pct", "rainfall_mm", "wind_kph", "solar_radiation", "source", "is_synthetic"],
  field_observations: ["id", "plot_id", "observed_at", "observation_type", "payload", "logged_by"],
};
if (migrationsOk) {
  for (const [table, cols] of Object.entries(expected)) {
    const have = (await db.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1", [table])).rows.map((r) => r.column_name);
    const missing = cols.filter((c) => !have.includes(c));
    record("schema", `table ${table} has every column the app uses`, have.length > 0 && missing.length === 0, have.length ? `missing: ${missing.join(",")}` : "table missing");
  }
  const tables = (await db.query("select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'")).rows;
  for (const t of tables) record("schema", `RLS enabled on public.${t.relname}`, t.relrowsecurity === true);
  const noPolicy = (await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r' and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname)`)).rows;
  record("schema", "every public table has at least one policy", noPolicy.length === 0, noPolicy.map((r) => r.relname).join(","));
  const dup = (await db.query("select tablename, policyname, count(*) c from pg_policies where schemaname='public' group by 1,2 having count(*)>1")).rows;
  record("schema", "no duplicate policy names", dup.length === 0);
  // Every UPDATE policy must carry a WITH CHECK (otherwise rows can be handed to another owner)
  const noCheck = (await db.query("select tablename, policyname from pg_policies where schemaname='public' and cmd in ('UPDATE','ALL') and with_check is null")).rows;
  record("schema", "every UPDATE policy has WITH CHECK", noCheck.length === 0, noCheck.map((r) => `${r.tablename}.${r.policyname}`).join(","));
  const fks = (await db.query("select conrelid::regclass::text t, conname, confdeltype from pg_constraint where contype='f' and connamespace='public'::regnamespace")).rows;
  record("schema", "foreign keys present", fks.length >= 12, `${fks.length} FKs`);
  const farms = tables.find((t) => t.relname === "farms");
  record("schema", "NOTE: a separate `farms` table is not part of the schema (farmers own plots directly)", true, farms ? "farms exists" : "no farms table -- 'farm' == farmer record");
}

// -------------------------------------------------- 3. two-user security test
if (migrationsOk) {
  console.log("== 3. Two-user ownership / RLS attack matrix");
  const users = {};
  for (const [key, email] of [["A", "user-a@example.test"], ["B", "user-b@example.test"]]) {
    const id = randomUUID();
    await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1,$2,$3)", [id, email, JSON.stringify({ full_name: `User ${key}` })]);
    users[key] = { id, ids: {} };
  }
  const prof = (await db.query("select id, full_name, user_role from public.profiles order by email")).rows;
  record("auth", "signup trigger creates a profile per auth user", prof.length === 2 && prof.every((p) => p.full_name), JSON.stringify(prof));

  const square = (lng, lat) => JSON.stringify({ type: "Polygon", coordinates: [[[lng, lat], [lng + 0.002, lat], [lng + 0.002, lat + 0.002], [lng, lat + 0.002], [lng, lat]]] });
  for (const [key, u] of Object.entries(users)) {
    const lng = key === "A" ? 78.4 : 76.1;
    const r1 = await asUser(u.id, () => db.query("insert into public.farmers (owner_id, name, village) values ($1,$2,'v') returning id", [u.id, `Farmer ${key}`]));
    u.ids.farmer = r1.rows[0].id;
    const r2 = await asUser(u.id, () => db.query("insert into public.plots (owner_id, farmer_id, name, crop, area, boundary, latitude, longitude, boundary_mapped) values ($1,$2,$3,'Oil Palm',2.5,$4::jsonb,17.4,$5,true) returning id", [u.id, u.ids.farmer, `Plot ${key}`, square(lng, 17.4), lng + 0.001]));
    u.ids.plot = r2.rows[0].id;
    const r3 = await asUser(u.id, () => db.query("insert into public.soil_reports (plot_id, owner_id, nitrogen_kg_ha, phosphorus_kg_ha, potassium_kg_ha, organic_carbon_percent, ph, electrical_conductivity, micronutrients) values ($1,$2,200,20,250,0.7,6.1,0.5,'{\"zinc\":{\"value\":0.8}}'::jsonb) returning id", [u.ids.plot, u.id]));
    u.ids.soil = r3.rows[0].id;
    const r4 = await asUser(u.id, () => db.query("insert into public.recommendations (owner_id, plot_id, soil_report_id, crop, deficiencies, fertilizer_plan, yield_prediction, roi, explanation) values ($1,$2,$3,'oil_palm','[]','[]','{}','{}','{}') returning id", [u.id, u.ids.plot, u.ids.soil]));
    u.ids.rec = r4.rows[0].id;
    // Backend-written tables: only service_role may write
    await asService(async () => {
      u.ids.twin = (await db.query("insert into public.digital_twins (plot_id, analysis_date, crop_health_score) values ($1, now(), 80) returning id", [u.ids.plot])).rows[0].id;
      u.ids.ndvi = (await db.query("insert into public.ndvi_readings (plot_id, captured_date, ndvi_mean) values ($1, current_date, 0.6) returning id", [u.ids.plot])).rows[0].id;
      u.ids.weather = (await db.query("insert into public.weather_observations (plot_id, observed_date, temperature_c) values ($1, current_date, 30) returning id", [u.ids.plot])).rows[0].id;
      u.ids.field = (await db.query("insert into public.field_observations (plot_id, observed_at, observation_type) values ($1, now(), 'other') returning id", [u.ids.plot])).rows[0].id;
    });
  }
  record("seed", "each user created farmer, plot(+boundary), soil report, recommendation via the authenticated path; twin/NDVI/weather/field rows via service role", true);

  const readTables = [
    ["farmers", "id", "farmer"],
    ["plots", "id", "plot"],
    ["soil_reports", "id", "soil"],
    ["recommendations", "id", "rec"],
    ["digital_twins", "id", "twin"],
    ["ndvi_readings", "id", "ndvi"],
    ["weather_observations", "id", "weather"],
    ["field_observations", "id", "field"],
  ];

  for (const [atk, vic] of [["A", "B"], ["B", "A"]]) {
    const a = users[atk], v = users[vic];
    const g = `${atk}->${vic}`;

    // --- positive: own data
    for (const [t, col, k] of readTables) {
      const r = await attempt("authenticated", a.id, `select ${col} from public.${t} where ${col}=$1`, [a.ids[k]]);
      record(`own-access ${atk}`, `${atk} reads own ${t}`, r.ok && r.rows.length === 1, r.ok ? "" : r.error);
      const all = await attempt("authenticated", a.id, `select count(*)::int c from public.${t}`);
      record(`own-access ${atk}`, `${atk} sees exactly 1 row in ${t} (no leakage)`, all.ok && all.rows[0].c === 1, all.ok ? `sees ${all.rows[0].c}` : all.error);
    }
    await expectAllowed(`own-access ${atk}`, `${atk} updates own plot`, a.id, "update public.plots set name='renamed' where id=$1 returning id", [a.ids.plot]);
    await expectAllowed(`own-access ${atk}`, `${atk} updates own farmer`, a.id, "update public.farmers set village='v2' where id=$1 returning id", [a.ids.farmer]);
    await expectAllowed(`own-access ${atk}`, `${atk} updates own soil report`, a.id, "update public.soil_reports set ph=6.3 where id=$1 returning id", [a.ids.soil]);
    await expectAllowed(`own-access ${atk}`, `${atk} updates own profile`, a.id, "update public.profiles set full_name='X' where id=$1 returning id", [a.id]);
    await expectAllowed(`own-access ${atk}`, `${atk} creates a second plot`, a.id, "insert into public.plots (owner_id, name, crop, area) values ($1,'extra','Rice',1) returning id", [a.id]);
    await expectAllowed(`own-access ${atk}`, `${atk} can unlink own plot from a farmer`, a.id, "update public.plots set farmer_id=null where id=$1 returning id", [a.ids.plot]);
    await expectAllowed(`own-access ${atk}`, `${atk} can re-link own plot to own farmer`, a.id, "update public.plots set farmer_id=$2 where id=$1 returning id", [a.ids.plot, a.ids.farmer]);

    // --- attacks: reading the victim's data
    for (const [t, col, k] of readTables) {
      await expectNoRows(g, `${atk} cannot read ${vic}'s ${t}`, a.id, `select * from public.${t} where ${col}=$1`, [v.ids[k]]);
    }
    await expectNoRows(g, `${atk} cannot read ${vic}'s profile`, a.id, "select * from public.profiles where id=$1", [v.id]);
    await expectNoRows(g, `${atk} cannot read ${vic}'s soil reports by plot_id`, a.id, "select * from public.soil_reports where plot_id=$1", [v.ids.plot]);
    await expectNoRows(g, `${atk} cannot read ${vic}'s boundary via plots`, a.id, "select boundary from public.plots where owner_id=$1", [v.id]);
    await expectRejected(g, `${atk} cannot read auth.users`, a.id, "select * from auth.users");

    // --- attacks: update / delete
    await expectUntouched(g, `${atk} cannot update ${vic}'s plot`, a.id, "update public.plots set name='pwned' where id=$1 returning id", [v.ids.plot]);
    await expectUntouched(g, `${atk} cannot update ${vic}'s boundary`, a.id, "update public.plots set boundary=null where id=$1 returning id", [v.ids.plot]);
    await expectUntouched(g, `${atk} cannot update ${vic}'s farmer`, a.id, "update public.farmers set name='pwned' where id=$1 returning id", [v.ids.farmer]);
    await expectUntouched(g, `${atk} cannot update ${vic}'s soil report`, a.id, "update public.soil_reports set ph=1 where id=$1 returning id", [v.ids.soil]);
    await expectUntouched(g, `${atk} cannot update ${vic}'s recommendation`, a.id, "update public.recommendations set status='x' where id=$1 returning id", [v.ids.rec]);
    await expectUntouched(g, `${atk} cannot update ${vic}'s profile`, a.id, "update public.profiles set full_name='pwned' where id=$1 returning id", [v.id]);
    for (const [t, , k] of readTables.slice(0, 4)) {
      await expectUntouched(g, `${atk} cannot delete ${vic}'s ${t}`, a.id, `delete from public.${t} where id=$1 returning id`, [v.ids[k]]);
    }
    // The victim's rows must still be intact (checked as the victim)
    for (const [t, col, k] of readTables) {
      const r = await attempt("authenticated", v.id, `select ${col} from public.${t} where ${col}=$1`, [v.ids[k]]);
      record(g, `${vic}'s ${t} row still intact after ${atk}'s attacks`, r.ok && r.rows.length === 1);
    }
    const intact = await attempt("authenticated", v.id, "select name, ph from public.plots p join public.soil_reports s on s.plot_id=p.id where p.id=$1", [v.ids.plot]);
    record(g, `${vic}'s data values unchanged`, intact.ok && intact.rows[0]?.name !== "pwned" && Number(intact.rows[0]?.ph) !== 1, JSON.stringify(intact.rows));

    // --- attacks: inserting records that claim someone else's ownership / plot
    await expectRejected(g, `${atk} cannot insert a farmer owned by ${vic}`, a.id, "insert into public.farmers (owner_id, name) values ($1,'x')", [v.id]);
    await expectRejected(g, `${atk} cannot insert a plot owned by ${vic}`, a.id, "insert into public.plots (owner_id, name, crop, area) values ($1,'x','Rice',1)", [v.id]);
    await expectRejected(g, `${atk} cannot attach own new plot to ${vic}'s farmer`, a.id, "insert into public.plots (owner_id, farmer_id, name, crop, area) values ($1,$2,'x','Rice',1)", [a.id, v.ids.farmer]);
    await expectRejected(g, `${atk} cannot insert a soil report for ${vic}'s plot (own owner_id)`, a.id, "insert into public.soil_reports (plot_id, owner_id, nitrogen_kg_ha, phosphorus_kg_ha, potassium_kg_ha, organic_carbon_percent, ph) values ($1,$2,1,1,1,1,7)", [v.ids.plot, a.id]);
    await expectRejected(g, `${atk} cannot insert a soil report claiming ${vic} as owner`, a.id, "insert into public.soil_reports (plot_id, owner_id, nitrogen_kg_ha, phosphorus_kg_ha, potassium_kg_ha, organic_carbon_percent, ph) values ($1,$2,1,1,1,1,7)", [a.ids.plot, v.id]);
    await expectRejected(g, `${atk} cannot insert a recommendation for ${vic}'s plot (own owner_id, own report)`, a.id, "insert into public.recommendations (owner_id, plot_id, soil_report_id, crop, deficiencies, fertilizer_plan, yield_prediction, roi, explanation) values ($1,$2,$3,'oil_palm','[]','[]','{}','{}','{}')", [a.id, v.ids.plot, a.ids.soil]);
    await expectRejected(g, `${atk} cannot insert a recommendation using ${vic}'s soil report`, a.id, "insert into public.recommendations (owner_id, plot_id, soil_report_id, crop, deficiencies, fertilizer_plan, yield_prediction, roi, explanation) values ($1,$2,$3,'oil_palm','[]','[]','{}','{}','{}')", [a.id, a.ids.plot, v.ids.soil]);
    await expectRejected(g, `${atk} cannot insert a recommendation claiming ${vic} as owner`, a.id, "insert into public.recommendations (owner_id, plot_id, soil_report_id, crop, deficiencies, fertilizer_plan, yield_prediction, roi, explanation) values ($1,$2,$3,'oil_palm','[]','[]','{}','{}','{}')", [v.id, a.ids.plot, a.ids.soil]);
    await expectRejected(g, `${atk} cannot write a digital twin for ${vic}'s plot`, a.id, "insert into public.digital_twins (plot_id, analysis_date) values ($1, now())", [v.ids.plot]);
    await expectRejected(g, `${atk} cannot write a digital twin even for own plot (service role only)`, a.id, "insert into public.digital_twins (plot_id, analysis_date) values ($1, now())", [a.ids.plot]);
    await expectRejected(g, `${atk} cannot write NDVI for ${vic}'s plot`, a.id, "insert into public.ndvi_readings (plot_id, captured_date) values ($1, current_date)", [v.ids.plot]);
    await expectRejected(g, `${atk} cannot write weather for ${vic}'s plot`, a.id, "insert into public.weather_observations (plot_id, observed_date) values ($1, current_date)", [v.ids.plot]);
    await expectRejected(g, `${atk} cannot write field observations for ${vic}'s plot`, a.id, "insert into public.field_observations (plot_id, observed_at) values ($1, now())", [v.ids.plot]);

    // --- attacks: tampering with ownership fields of one's OWN rows (migration 011 WITH CHECK)
    await expectRejected(g, `${atk} cannot hand own plot to ${vic} (owner_id swap)`, a.id, "update public.plots set owner_id=$2 where id=$1 returning id", [a.ids.plot, v.id]);
    await expectRejected(g, `${atk} cannot hand own farmer to ${vic}`, a.id, "update public.farmers set owner_id=$2 where id=$1 returning id", [a.ids.farmer, v.id]);
    await expectRejected(g, `${atk} cannot hand own soil report to ${vic}`, a.id, "update public.soil_reports set owner_id=$2 where id=$1 returning id", [a.ids.soil, v.id]);
    await expectRejected(g, `${atk} cannot re-point own soil report at ${vic}'s plot`, a.id, "update public.soil_reports set plot_id=$2 where id=$1 returning id", [a.ids.soil, v.ids.plot]);
    await expectRejected(g, `${atk} cannot hand own recommendation to ${vic}`, a.id, "update public.recommendations set owner_id=$2 where id=$1 returning id", [a.ids.rec, v.id]);
    await expectRejected(g, `${atk} cannot re-point own recommendation at ${vic}'s plot`, a.id, "update public.recommendations set plot_id=$2 where id=$1 returning id", [a.ids.rec, v.ids.plot]);
    await expectRejected(g, `${atk} cannot re-point own recommendation at ${vic}'s soil report`, a.id, "update public.recommendations set soil_report_id=$2 where id=$1 returning id", [a.ids.rec, v.ids.soil]);
    await expectRejected(g, `${atk} cannot link own plot to ${vic}'s farmer via UPDATE`, a.id, "update public.plots set farmer_id=$2 where id=$1 returning id", [a.ids.plot, v.ids.farmer]);
    await expectRejected(g, `${atk} cannot rewrite own profile id to ${vic}'s`, a.id, "update public.profiles set id=$2 where id=$1 returning id", [a.id, v.id]);
    await expectRejected(g, `${atk} cannot insert a profile for ${vic}`, a.id, "insert into public.profiles (id, email) values ($1,'x@y.z')", [v.id]);
  }

  // --- data-integrity rule inside one account: a recommendation's soil report must belong to its plot
  {
    const a = users.A;
    const second = await asUser(a.id, () => db.query("insert into public.plots (owner_id, name, crop, area) values ($1,'second','Rice',1) returning id", [a.id]));
    await expectRejected("integrity", "recommendation cannot pair plot X with a soil report of plot Y (same owner)", a.id, "insert into public.recommendations (owner_id, plot_id, soil_report_id, crop, deficiencies, fertilizer_plan, yield_prediction, roi, explanation) values ($1,$2,$3,'rice','[]','[]','{}','{}','{}')", [a.id, second.rows[0].id, a.ids.soil]);
  }

  // --- anonymous (no JWT) access
  for (const [t] of readTables) {
    const r = await attempt("anon", null, `select * from public.${t}`);
    record("anon", `anon sees no rows in ${t}`, (r.ok && r.rows.length === 0) || (!r.ok && RLS_OR_PERM.test(r.error)), r.ok ? `${r.rows.length} rows` : r.error);
  }
  for (const [t] of [["plots"], ["farmers"], ["soil_reports"]]) {
    const r = await attempt("anon", null, `insert into public.${t} (owner_id, name) values ('${randomUUID()}','x')`);
    record("anon", `anon cannot insert into ${t}`, !r.ok, r.ok ? "SUCCEEDED" : r.error);
  }
  const r0 = await attempt("anon", null, "select * from public.profiles");
  record("anon", "anon sees no profiles", (r0.ok && r0.rows.length === 0) || !r0.ok);

  // --- triggers and cascades
  {
    const a = users.A;
    const before = (await attempt("authenticated", a.id, "select updated_at from public.plots where id=$1", [a.ids.plot])).rows[0].updated_at;
    await new Promise((r) => setTimeout(r, 15));
    await asUser(a.id, () => db.query("update public.plots set crop='Coconut' where id=$1", [a.ids.plot]));
    const after = (await attempt("authenticated", a.id, "select updated_at from public.plots where id=$1", [a.ids.plot])).rows[0].updated_at;
    record("triggers", "plots.updated_at trigger fires on update", new Date(after) > new Date(before));
    const recBefore = (await attempt("authenticated", a.id, "select updated_at from public.recommendations where id=$1", [a.ids.rec])).rows[0].updated_at;
    await new Promise((r) => setTimeout(r, 15));
    await asUser(a.id, () => db.query("update public.recommendations set status='reviewed' where id=$1", [a.ids.rec]));
    const recAfter = (await attempt("authenticated", a.id, "select updated_at from public.recommendations where id=$1", [a.ids.rec])).rows[0].updated_at;
    record("triggers", "recommendations.updated_at trigger fires on update", new Date(recAfter) > new Date(recBefore));

    await asUser(a.id, () => db.query("delete from public.farmers where id=$1", [a.ids.farmer]));
    const fk = (await attempt("authenticated", a.id, "select farmer_id from public.plots where id=$1", [a.ids.plot])).rows[0];
    record("cascade", "deleting a farmer leaves the plot (farmer_id -> NULL)", fk && fk.farmer_id === null, JSON.stringify(fk));
    await asUser(a.id, () => db.query("delete from public.plots where id=$1", [a.ids.plot]));
    const orphans = (await db.query("select (select count(*)::int from public.soil_reports where plot_id=$1) s, (select count(*)::int from public.recommendations where plot_id=$1) r, (select count(*)::int from public.digital_twins where plot_id=$1) t, (select count(*)::int from public.ndvi_readings where plot_id=$1) n", [a.ids.plot])).rows[0];
    record("cascade", "deleting a plot cascades to reports, recommendations, twins, NDVI", Object.values(orphans).every((n) => n === 0), JSON.stringify(orphans));
    await db.query("delete from auth.users where id=$1", [users.B.id]);
    const left = (await db.query("select (select count(*)::int from public.profiles where id=$1) p, (select count(*)::int from public.plots where owner_id=$1) pl", [users.B.id])).rows[0];
    record("cascade", "deleting an auth user removes their profile and plots", left.p === 0 && left.pl === 0, JSON.stringify(left));
  }
}

// ------------------------------------------------------------------ report
const groups = [...new Set(results.map((r) => r.group))];
const failed = results.filter((r) => !r.pass);
console.log("\n== Summary");
for (const g of groups) {
  const rs = results.filter((r) => r.group === g);
  console.log(`  ${rs.every((r) => r.pass) ? "PASS" : "FAIL"}  ${g.padEnd(22)} ${rs.filter((r) => r.pass).length}/${rs.length}`);
}
console.log(`\nTOTAL: ${results.length - failed.length}/${results.length} passed${failed.length ? `, ${failed.length} FAILED` : ""}`);
writeFileSync(path.join(here, "last-run.json"), JSON.stringify({ engine: "PGlite (PostgreSQL 17) + Supabase auth shim", results }, null, 2));
process.exit(failed.length ? 1 : 0);
