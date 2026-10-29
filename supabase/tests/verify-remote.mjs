// Two-user RLS verification against a REAL, DISPOSABLE (scratch) Supabase project,
// through the same PostgREST path the app uses. NOT RUN by the audit (no scratch
// project was available) -- see docs/SCRATCH_SUPABASE_VERIFICATION.md.
//
// Prerequisite: migrations 001..013 already applied to the scratch project (013 adds the verified-extraction workflow).
//
// THIS SCRIPT WRITES TO THE PROJECT. It creates two throwaway auth users (@nutripalm-scratch.invalid), inserts farmers, plots,
// soil reports, recommendations, extractions, applications and a digital-twin row for them, attempts forbidden updates/deletes,
// and finally deletes both users (rows cascade). It refuses to start if any checked table already has rows or any other auth user exists.
//
// Required environment (set in YOUR shell; never paste keys into chat or commit them):
//   SCRATCH_SUPABASE_URL                 https://<scratch-ref>.supabase.co
//   SCRATCH_SUPABASE_ANON_KEY            public/anon (publishable) key
//   SCRATCH_SUPABASE_SERVICE_ROLE_KEY    used ONLY to create/delete the two test users and
//                                        to seed backend-written tables (digital_twins, NDVI ...).
//                                        All user-level access uses the users' own sessions.
//   SCRATCH_CONFIRM=DISPOSABLE_PROJECT   explicit acknowledgement
//
// Safety: refuses to run if the project already contains rows that do not belong to
// this script's throwaway users (so it cannot be pointed at a project with real data).

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const need = ["SCRATCH_SUPABASE_URL", "SCRATCH_SUPABASE_ANON_KEY", "SCRATCH_SUPABASE_SERVICE_ROLE_KEY"];
const missing = need.filter((k) => !process.env[k]);
if (missing.length || process.env.SCRATCH_CONFIRM !== "DISPOSABLE_PROJECT") {
  console.error(
    `Refusing to run. Set ${missing.length ? missing.join(", ") + " and " : ""}SCRATCH_CONFIRM=DISPOSABLE_PROJECT.\n` +
      "Use a dedicated scratch Supabase project only (see docs/SCRATCH_SUPABASE_VERIFICATION.md)."
  );
  process.exit(2);
}

const url = process.env.SCRATCH_SUPABASE_URL;
const anon = process.env.SCRATCH_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SCRATCH_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const tag = `rls-${randomBytes(4).toString("hex")}`;
const results = [];
const record = (group, name, pass, detail = "") => {
  results.push({ group, name, pass, detail });
  if (!pass) console.log(`  FAIL [${group}] ${name} ${detail}`);
};

// ---- safety: nothing but our own throwaway data may exist
for (const t of ["plots", "farmers", "soil_reports", "recommendations", "digital_twins", "disease_assessments", "soil_report_extractions", "fertilizer_applications"]) {
  const { count, error } = await admin.from(t).select("*", { count: "exact", head: true });
  if (error) { console.error(`Cannot read ${t}: ${error.message}. Are migrations 001..013 applied?`); process.exit(2); }
  if (count > 0) { console.error(`Refusing: ${t} already has ${count} rows. This script only runs on an empty scratch project.`); process.exit(2); }
}
const { data: existingUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 50 });
if ((existingUsers?.users ?? []).some((u) => !String(u.email).endsWith("@nutripalm-scratch.invalid"))) {
  console.error("Refusing: the project contains non-test auth users.");
  process.exit(2);
}

const created = [];
async function makeUser(label) {
  const email = `${tag}-${label}@nutripalm-scratch.invalid`;
  const password = randomBytes(18).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Scratch ${label}` } });
  if (error) throw new Error(`createUser ${label}: ${error.message}`);
  created.push(data.user.id);
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { error: signErr } = await client.auth.signInWithPassword({ email, password });
  if (signErr) throw new Error(`signIn ${label}: ${signErr.message}`);
  return { id: data.user.id, client, ids: {} };
}

const denied = (r) => !!r.error || (Array.isArray(r.data) && r.data.length === 0) || r.data === null;

try {
  const users = { A: await makeUser("a"), B: await makeUser("b") };
  const poly = (lng) => ({ type: "Polygon", coordinates: [[[lng, 17.4], [lng + 0.002, 17.4], [lng + 0.002, 17.402], [lng, 17.402], [lng, 17.4]]] });

  for (const [k, u] of Object.entries(users)) {
    const c = u.client;
    let r = await c.from("farmers").insert({ owner_id: u.id, name: `Farmer ${k}` }).select().single();
    record("seed", `${k} creates farmer`, !r.error, r.error?.message); u.ids.farmer = r.data?.id;
    r = await c.from("plots").insert({ owner_id: u.id, farmer_id: u.ids.farmer, name: `Plot ${k}`, crop: "Oil Palm", area: 2, boundary: poly(k === "A" ? 78.4 : 76.1), latitude: 17.401, longitude: k === "A" ? 78.401 : 76.101, boundary_mapped: true }).select().single();
    record("seed", `${k} creates plot with boundary`, !r.error, r.error?.message); u.ids.plot = r.data?.id;
    r = await c.from("soil_reports").insert({ owner_id: u.id, plot_id: u.ids.plot, nitrogen_kg_ha: 200, phosphorus_kg_ha: 20, potassium_kg_ha: 250, organic_carbon_percent: 0.7, ph: 6.1 }).select().single();
    record("seed", `${k} creates soil report`, !r.error, r.error?.message); u.ids.soil = r.data?.id;
    r = await c.from("recommendations").insert({ owner_id: u.id, plot_id: u.ids.plot, soil_report_id: u.ids.soil, crop: "oil_palm", deficiencies: [], fertilizer_plan: [], yield_prediction: {}, roi: {}, explanation: {} }).select().single();
    record("seed", `${k} creates recommendation`, !r.error, r.error?.message); u.ids.rec = r.data?.id;
    r = await admin.from("digital_twins").insert({ plot_id: u.ids.plot, analysis_date: new Date().toISOString(), crop_health_score: 80 }).select().single();
    record("seed", `service role seeds digital twin for ${k}`, !r.error, r.error?.message); u.ids.twin = r.data?.id;
  }

  for (const [atk, vic] of [["A", "B"], ["B", "A"]]) {
    const a = users[atk], v = users[vic], c = a.client, g = `${atk}->${vic}`;
    for (const [t, id] of [["farmers", v.ids.farmer], ["plots", v.ids.plot], ["soil_reports", v.ids.soil], ["recommendations", v.ids.rec], ["digital_twins", v.ids.twin]]) {
      record(g, `cannot read ${vic}'s ${t}`, denied(await c.from(t).select("*").eq("id", id)));
    }
    record(g, `cannot read ${vic}'s profile`, denied(await c.from("profiles").select("*").eq("id", v.id)));
    for (const [t, id, patch] of [["plots", v.ids.plot, { name: "pwned" }], ["farmers", v.ids.farmer, { name: "pwned" }], ["soil_reports", v.ids.soil, { ph: 1 }], ["recommendations", v.ids.rec, { status: "x" }], ["profiles", v.id, { full_name: "pwned" }]]) {
      record(g, `cannot update ${vic}'s ${t}`, denied(await c.from(t).update(patch).eq("id", id).select()));
    }
    for (const [t, id] of [["plots", v.ids.plot], ["farmers", v.ids.farmer], ["soil_reports", v.ids.soil], ["recommendations", v.ids.rec]]) {
      record(g, `cannot delete ${vic}'s ${t}`, denied(await c.from(t).delete().eq("id", id).select()));
    }
    record(g, `cannot insert a plot owned by ${vic}`, !!(await c.from("plots").insert({ owner_id: v.id, name: "x", crop: "Rice", area: 1 })).error);
    record(g, `cannot attach own plot to ${vic}'s farmer`, !!(await c.from("plots").insert({ owner_id: a.id, farmer_id: v.ids.farmer, name: "x", crop: "Rice", area: 1 })).error);
    record(g, `cannot insert a soil report on ${vic}'s plot`, !!(await c.from("soil_reports").insert({ owner_id: a.id, plot_id: v.ids.plot, nitrogen_kg_ha: 1, phosphorus_kg_ha: 1, potassium_kg_ha: 1, organic_carbon_percent: 1, ph: 7 })).error);
    record(g, `cannot insert a recommendation on ${vic}'s plot`, !!(await c.from("recommendations").insert({ owner_id: a.id, plot_id: v.ids.plot, soil_report_id: a.ids.soil, crop: "x", deficiencies: [], fertilizer_plan: [], yield_prediction: {}, roi: {}, explanation: {} })).error);
    record(g, `cannot write a digital twin (any plot)`, !!(await c.from("digital_twins").insert({ plot_id: a.ids.plot, analysis_date: new Date().toISOString() })).error);
    record(g, `cannot hand own plot to ${vic} (owner_id)`, !!(await c.from("plots").update({ owner_id: v.id }).eq("id", a.ids.plot).select()).error);
    record(g, `cannot re-point own soil report at ${vic}'s plot`, !!(await c.from("soil_reports").update({ plot_id: v.ids.plot }).eq("id", a.ids.soil).select()).error);
    record(g, `cannot re-point own recommendation at ${vic}'s plot`, !!(await c.from("recommendations").update({ plot_id: v.ids.plot }).eq("id", a.ids.rec).select()).error);
    record(g, `cannot link own plot to ${vic}'s farmer`, !!(await c.from("plots").update({ farmer_id: v.ids.farmer }).eq("id", a.ids.plot).select()).error);
    // victim's data still intact (checked as the victim)
    const intact = await v.client.from("plots").select("name").eq("id", v.ids.plot).single();
    record(g, `${vic}'s plot unchanged after attacks`, intact.data?.name === `Plot ${vic}`);
    // own access still works
    const own = await c.from("plots").select("id");
    record(`own ${atk}`, `${atk} sees exactly their own plot`, own.data?.length === 1 && own.data[0].id === a.ids.plot);
    record(`own ${atk}`, `${atk} can update own plot`, !(await c.from("plots").update({ name: `Renamed ${atk}` }).eq("id", a.ids.plot).select()).error);
  }


  // ---- 013: verified soil extraction workflow, engine provenance, fertilizer applications (same checks as verify.mjs, over PostgREST)
  const FIELDS = { nitrogen: { value: 200, unit: "kg/ha", validation: "valid" } };
  const sha = (n) => String(n).repeat(64).slice(0, 64);
  for (const [k, u] of Object.entries(users)) {
    let r = await admin.from("soil_report_extractions").insert({ owner_id: u.id, plot_id: u.ids.plot, status: "needs_review", source_sha256: sha(k === "A" ? 1 : 2), pipeline_version: "ocr-2.0", fields: FIELDS }).select().single();
    record("013 seed", `service role writes ${k}'s extraction`, !r.error, r.error?.message); u.ids.ext = r.data?.id;
    r = await admin.from("soil_reports").insert({ owner_id: u.id, plot_id: u.ids.plot, nitrogen_kg_ha: 200, phosphorus_kg_ha: 20, potassium_kg_ha: 250, organic_carbon_percent: 0.7, ph: 6.1, extraction_id: u.ids.ext, verification_status: "user_confirmed", verified_at: new Date().toISOString() }).select().single();
    record("013 seed", `service role writes ${k}'s verified soil report`, !r.error, r.error?.message); u.ids.vsoil = r.data?.id;
    r = await admin.from("recommendations").insert({ owner_id: u.id, plot_id: u.ids.plot, soil_report_id: u.ids.vsoil, crop: "oil_palm", deficiencies: [], fertilizer_plan: [], yield_prediction: {}, roi: {}, explanation: {}, engine_version: "rec-2.2", generated_at: new Date().toISOString(), provenance: {} }).select().single();
    record("013 seed", `service role writes ${k}'s engine-stamped recommendation`, !r.error, r.error?.message); u.ids.vrec = r.data?.id;
  }
  const soilRow = (a, plot, extra = {}) => ({ owner_id: a.id, plot_id: plot, nitrogen_kg_ha: 1, phosphorus_kg_ha: 1, potassium_kg_ha: 1, organic_carbon_percent: 1, ph: 7, ...extra });
  for (const [atk, vic] of [["A", "B"], ["B", "A"]]) {
    const a = users[atk], v = users[vic], c = a.client, g = `013 ${atk}->${vic}`;
    record(g, `${atk} cannot insert an extraction (backend-only table)`, !!(await c.from("soil_report_extractions").insert({ owner_id: a.id, plot_id: a.ids.plot, status: "needs_review", source_sha256: sha(9), pipeline_version: "x", fields: {} })).error);
    record(g, `${atk} cannot update own extraction`, denied(await c.from("soil_report_extractions").update({ status: "completed" }).eq("id", a.ids.ext).select()));
    record(g, `${atk} cannot read ${vic}'s extraction`, denied(await c.from("soil_report_extractions").select("*").eq("id", v.ids.ext)));
    record(g, `${atk} cannot delete ${vic}'s extraction`, denied(await c.from("soil_report_extractions").delete().eq("id", v.ids.ext).select()));
    record(`013 own ${atk}`, `${atk} can read own extraction`, (await c.from("soil_report_extractions").select("id").eq("id", a.ids.ext)).data?.length === 1);
    record(g, `${atk} cannot INSERT a soil report claiming verification_status`, !!(await c.from("soil_reports").insert(soilRow(a, a.ids.plot, { verification_status: "user_confirmed" }))).error);
    record(g, `${atk} cannot INSERT a soil report pointing at an extraction`, !!(await c.from("soil_reports").insert(soilRow(a, a.ids.plot, { extraction_id: a.ids.ext }))).error);
    record(g, `${atk} cannot edit the values of a verified soil report in place`, !!(await c.from("soil_reports").update({ nitrogen_kg_ha: 999 }).eq("id", a.ids.vsoil).select()).error);
    record(g, `${atk} cannot INSERT a recommendation stamped with engine_version`, !!(await c.from("recommendations").insert({ owner_id: a.id, plot_id: a.ids.plot, soil_report_id: a.ids.vsoil, crop: "x", deficiencies: [], fertilizer_plan: [], yield_prediction: {}, roi: {}, explanation: {}, engine_version: "rec-2.2" })).error);
    record(g, `${atk} cannot rewrite an engine-generated recommendation`, !!(await c.from("recommendations").update({ fertilizer_plan: [{ x: 1 }] }).eq("id", a.ids.vrec).select()).error);
    const app = { owner_id: a.id, plot_id: a.ids.plot, applied_on: "2026-01-01", product_name: "Urea", quantity: 50, quantity_unit: "kg" };
    const mine = await c.from("fertilizer_applications").insert({ ...app, recommendation_id: a.ids.vrec }).select().single();
    record(`013 own ${atk}`, `${atk} records an application on own plot linked to own recommendation`, !mine.error, mine.error?.message); a.ids.app = mine.data?.id;
    record(g, `${atk} cannot record an application on ${vic}'s plot`, !!(await c.from("fertilizer_applications").insert({ ...app, plot_id: v.ids.plot })).error);
    record(g, `${atk} cannot record an application claiming ${vic} as owner`, !!(await c.from("fertilizer_applications").insert({ ...app, owner_id: v.id })).error);
    record(g, `${atk} cannot link an application to ${vic}'s recommendation`, !!(await c.from("fertilizer_applications").insert({ ...app, recommendation_id: v.ids.vrec })).error);
    record(g, `${atk} cannot record a zero quantity or an unknown unit`, !!(await c.from("fertilizer_applications").insert({ ...app, quantity: 0 })).error && !!(await c.from("fertilizer_applications").insert({ ...app, quantity_unit: "tons" })).error);
  }
  for (const [atk, vic] of [["A", "B"], ["B", "A"]]) {
    const a = users[atk], v = users[vic], c = a.client, g = `013 ${atk}->${vic}`;
    record(g, `${atk} cannot read ${vic}'s fertilizer applications`, denied(await c.from("fertilizer_applications").select("*").eq("plot_id", v.ids.plot)));
    record(g, `${atk} cannot update ${vic}'s fertilizer application`, denied(await c.from("fertilizer_applications").update({ quantity: 1 }).eq("id", v.ids.app).select()));
    record(g, `${atk} cannot delete ${vic}'s fertilizer application`, denied(await c.from("fertilizer_applications").delete().eq("id", v.ids.app).select()));
    record(g, `${atk} cannot hand own application to ${vic}`, !!(await c.from("fertilizer_applications").update({ owner_id: v.id }).eq("id", a.ids.app).select()).error);
  }
  for (const t of ["soil_report_extractions", "fertilizer_applications", "disease_assessments"]) {
    record("013 anon", `anon sees no rows in ${t}`, denied(await createClient(url, anon, { auth: { persistSession: false } }).from(t).select("*")));
  }

  // anon (no session)
  const anonClient = createClient(url, anon, { auth: { persistSession: false } });
  for (const t of ["plots", "farmers", "soil_reports", "recommendations", "digital_twins", "profiles"]) {
    record("anon", `anon sees no rows in ${t}`, denied(await anonClient.from(t).select("*")));
  }
} finally {
  for (const id of created) await admin.auth.admin.deleteUser(id); // cascades profiles/plots/...
}

const failed = results.filter((r) => !r.pass);
console.log(`\nTOTAL: ${results.length - failed.length}/${results.length} passed${failed.length ? `, ${failed.length} FAILED` : ""}`);
process.exit(failed.length ? 1 : 0);
