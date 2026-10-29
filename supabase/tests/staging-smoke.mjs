// End-to-end smoke test of the retained workflow over HTTP (no browser):
//
//   authenticated farmer -> owned plot -> soil-report upload -> OCR -> review -> verified soil report
//   -> recommendation (cited, or honestly 'insufficient_data') -> Digital Twin history -> second farmer cannot see any of it
//
//   # against a STAGING / disposable deployment (writes data; creates and deletes two throwaway users):
//   STAGING_CONFIRM=NON_PRODUCTION STAGING_API_URL=https://api.staging.example \
//   STAGING_SUPABASE_URL=https://<ref>.supabase.co STAGING_SUPABASE_ANON_KEY=... [STAGING_SUPABASE_SERVICE_ROLE_KEY=...] \
//   [STAGING_REPORT_PDF=/path/to/real-report.pdf]  node staging-smoke.mjs
//
//   # self-test of this script against the LOCAL emulator + local backend (proves the script, not a deployment):
//   E2E_PYTHON=<python with backend deps> node staging-smoke.mjs --selftest
//
// With STAGING_SUPABASE_SERVICE_ROLE_KEY the two users are created through the admin API (email pre-confirmed) and deleted at the
// end; without it the script uses public sign-up (works only if the project does not require email confirmation) and cannot delete them.
// The report you supply is uploaded as-is. If the pipeline cannot read a required value, the script STOPS and says so: it never types
// a value on the farmer's behalf. It never prints tokens or keys. Results are labelled with the environment they ran against.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { readFileSync, mkdirSync } from "node:fs";
import { spawn, execSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..");
const selftest = process.argv.includes("--selftest");
const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass: !!pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${pass ? "" : "  -> " + String(detail).slice(0, 300)}`);
};

let cfg, cleanup = async () => {}, environmentLabel;
if (selftest) {
  const { startStack } = await import("./e2e-stack/stack.mjs");
  const PY = process.env.E2E_PYTHON || "python";
  const files = path.join(tmpdir(), "np-staging-selftest");
  mkdirSync(files, { recursive: true });
  execSync(`"${PY}" "${path.join(here, "e2e", "make_fixtures.py")}" "${files}"`, { cwd: path.join(repo, "backend"), stdio: "ignore", env: { ...process.env, PYTHONPATH: path.join(repo, "backend") } });
  const secret = randomBytes(32).toString("hex");
  const stack = await startStack({ port: 54323, jwtSecret: secret, quiet: true });
  const api = spawn(PY, ["-m", "uvicorn", "app.main:app", "--port", "8010"], {
    cwd: path.join(repo, "backend"), stdio: "ignore",
    env: { ...process.env, SUPABASE_URL: stack.url, SUPABASE_SERVICE_ROLE_KEY: stack.serviceRoleKey, SUPABASE_JWT_SECRET: secret, CORS_ALLOW_ORIGINS: "http://127.0.0.1:5173", ENVIRONMENT: "development", RULE_PACK_PATH: path.join(files, "test_schedule_rule_pack.json"), SENTINEL_HUB_CLIENT_ID: "", SENTINEL_HUB_CLIENT_SECRET: "" },
  });
  for (let i = 0; i < 60; i++) { try { if ((await fetch("http://127.0.0.1:8010/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }
  cfg = { api: "http://127.0.0.1:8010", url: stack.url, anon: stack.anonKey, service: undefined, report: path.join(files, "soil_full.pdf"), partial: path.join(files, "soil_partial.pdf") };
  environmentLabel = "LOCAL EMULATOR (PGlite + GoTrue/PostgREST subset) + local backend - NOT a managed Supabase project, NOT a hosted deployment";
  cleanup = async () => { try { if (process.platform === "win32") execSync(`taskkill /PID ${api.pid} /T /F`, { stdio: "ignore" }); else api.kill(); } catch {} await stack.close(); };
} else {
  const need = ["STAGING_API_URL", "STAGING_SUPABASE_URL", "STAGING_SUPABASE_ANON_KEY"];
  const missing = need.filter((k) => !process.env[k]);
  if (missing.length || process.env.STAGING_CONFIRM !== "NON_PRODUCTION") {
    console.error(`Refusing to run. Set ${missing.join(", ") || "(all present)"} and STAGING_CONFIRM=NON_PRODUCTION (this script writes data). Use --selftest to exercise the script locally.`);
    process.exit(2);
  }
  cfg = { api: process.env.STAGING_API_URL.replace(/\/+$/, ""), url: process.env.STAGING_SUPABASE_URL, anon: process.env.STAGING_SUPABASE_ANON_KEY, service: process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY, report: process.env.STAGING_REPORT_PDF, partial: process.env.STAGING_PARTIAL_REPORT_PDF };
  environmentLabel = `STAGING deployment at ${cfg.api} with Supabase ${new URL(cfg.url).host} (results are valid for that environment only)`;
}
console.log(`Environment: ${environmentLabel}\n`);

const tag = `smoke-${randomBytes(3).toString("hex")}`;
const PLANTED = `${new Date().getUTCFullYear() - 5}-01-01`;   // five-plus years old: the open-ended "year 3 and above" band, whatever today's date
const created = [];
const admin = cfg.service ? createClient(cfg.url, cfg.service, { auth: { persistSession: false } }) : null;
async function makeUser(label) {
  const email = `${tag}-${label}@nutripalm-smoke.invalid`, password = randomBytes(18).toString("base64url");
  const client = createClient(cfg.url, cfg.anon, { auth: { persistSession: false } });
  if (admin) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Smoke ${label}` } });
    if (error) throw new Error(`createUser ${label}: ${error.message}`);
    created.push(data.user.id);
    const { error: e2 } = await client.auth.signInWithPassword({ email, password });
    if (e2) throw new Error(`signIn ${label}: ${e2.message}`);
  } else {
    const { data, error } = await client.auth.signUp({ email, password, options: { data: { full_name: `Smoke ${label}` } } });
    if (error || !data.session) throw new Error(`signUp ${label}: ${error?.message ?? "no session (email confirmation is required; supply STAGING_SUPABASE_SERVICE_ROLE_KEY)"}`);
  }
  const { data } = await client.auth.getSession();
  return { client, token: data.session.access_token, id: data.session.user.id, label };
}
const call = async (u, method, p, body, isForm) => {
  const r = await fetch(`${cfg.api}${p}`, { method, headers: { Authorization: `Bearer ${u.token}`, ...(body && !isForm ? { "Content-Type": "application/json" } : {}) }, body: isForm ? body : body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await r.json(); } catch {}
  return { status: r.status, body: json };
};
const upload = (u, plotId, bytes, name = "report.pdf") => { const fd = new FormData(); fd.append("plot_id", plotId); fd.append("file", new Blob([bytes], { type: "application/pdf" }), name); return call(u, "POST", "/api/soil-reports/upload", fd, true); };

try {
  const health = await fetch(`${cfg.api}/health/ready`).then((r) => r.json().then((j) => ({ s: r.status, j }))).catch(() => ({ s: 0, j: {} }));
  check("backend /health/ready reports ready (config + OCR binaries)", health.s === 200, JSON.stringify(health.j.required ?? health));

  const A = await makeUser("a"), B = await makeUser("b");
  check("two farmers authenticate", !!A.token && !!B.token && A.id !== B.id);

  // ---- A: owned plot
  const poly = { type: "Polygon", coordinates: [[[75.0, 13.0], [75.002, 13.0], [75.002, 13.002], [75.0, 13.002], [75.0, 13.0]]] };
  const farmer = (await A.client.from("farmers").insert({ owner_id: A.id, name: "Smoke Farmer" }).select().single()).data;
  const plot = (await A.client.from("plots").insert({ owner_id: A.id, farmer_id: farmer?.id, name: "Smoke Plot", crop: "Oil Palm", area: 2, area_unit: "hectare", planting_date: PLANTED, plant_count: 300, state: "Karnataka", boundary: poly, latitude: 13.001, longitude: 75.001, boundary_mapped: true }).select().single()).data;
  check("farmer A creates an owned plot through row-level security", !!plot?.id);

  // ---- failed OCR can never create a verified report
  const corrupt = await upload(A, plot.id, Buffer.from("%PDF-1.4 truncated nonsense"));
  check("a corrupt document reports status 'failed' and stores nothing", corrupt.status === 200 && corrupt.body.status === "failed" && corrupt.body.extraction_id === null, JSON.stringify(corrupt.body).slice(0, 200));
  check("...and no soil report or extraction exists", (await A.client.from("soil_reports").select("id")).data.length === 0 && (await A.client.from("soil_report_extractions").select("id")).data.length === 0);
  const wrongType = await call(A, "POST", "/api/soil-reports/upload", (() => { const fd = new FormData(); fd.append("plot_id", plot.id); fd.append("file", new Blob(["hello"], { type: "text/plain" }), "x.txt"); return fd; })(), true);
  check("an unsupported file type is refused (415)", wrongType.status === 415);

  // ---- review path (only when a deliberately incomplete report is supplied)
  if (cfg.partial) {
    const part = await upload(A, plot.id, readFileSync(cfg.partial), "partial.pdf");
    check("an incomplete report waits for review and creates NO soil report", part.body.status === "needs_review" && part.body.persisted === false && (await A.client.from("soil_reports").select("id")).data.length === 0, JSON.stringify(part.body).slice(0, 160));
    const refuse = await call(A, "POST", `/api/soil-reports/extractions/${part.body.extraction_id}/confirm`, { corrections: {}, confirmed: [] });
    check("confirming without the missing values is refused (422) and still creates nothing", refuse.status === 422 && (await A.client.from("soil_reports").select("id")).data.length === 0);
  }

  // ---- the real report
  if (!cfg.report) { console.log("\nNo STAGING_REPORT_PDF given: stopping after the failure-path checks. Supply a real, authorized report to run the full workflow."); }
  else {
    const up = await upload(A, plot.id, readFileSync(cfg.report), path.basename(cfg.report));
    check("the report is read (status needs_review or completed, never failed)", ["needs_review", "completed"].includes(up.body.status), JSON.stringify(up.body).slice(0, 200));
    let soilId = up.body.soil_report_id;
    if (up.body.status === "needs_review") {
      const required = ["nitrogen", "phosphorus", "potassium", "ph", "organic_carbon"];
      const unreadable = required.filter((k) => up.body[k].value === null || up.body[k].validation === "unusable");
      if (unreadable.length) {
        console.log(`\nSTOP: the pipeline could not read ${unreadable.join(", ")} from this report. A person must supply those values in the app; this script will not invent them.`);
        check("workflow stopped honestly at the review step (nothing fabricated)", (await A.client.from("soil_reports").select("id")).data.length === 0);
      } else {
        // accept exactly what was read: the script plays the farmer who checked every value against the paper report
        const conf = await call(A, "POST", `/api/soil-reports/extractions/${up.body.extraction_id}/confirm`, { corrections: {}, confirmed: required.filter((k) => up.body[k].validation === "review") });
        check("the farmer confirms the values as read -> a verified soil report exists", conf.status === 200 && conf.body.status === "completed", JSON.stringify(conf.body).slice(0, 200));
        soilId = conf.body.soil_report_id;
      }
    }
    if (soilId) {
      const soil = (await A.client.from("soil_reports").select("*").eq("id", soilId).single()).data;
      check("the stored soil report is verified, linked to its extraction, owned by A and on A's plot", !!soil.verification_status && !!soil.extraction_id && soil.owner_id === A.id && soil.plot_id === plot.id, JSON.stringify({ v: soil?.verification_status }));
      const again = await upload(A, plot.id, readFileSync(cfg.report), "again.pdf");
      check("uploading the same document again reuses the stored extraction (no second OCR, no second report)", again.body.reused === true && (await A.client.from("soil_reports").select("id")).data.length === 1);

      const rec = await call(A, "POST", "/api/recommendations", { plot_id: plot.id, soil_report_id: soilId });
      const generated = rec.status === 201 && rec.body.state === "generated";
      const insufficient = rec.status === 200 && rec.body.state === "insufficient_data";
      check("the recommendation endpoint answers with either a cited recommendation or an explicit insufficient_data", generated || insufficient, JSON.stringify(rec.body).slice(0, 200));
      console.log(`      -> outcome: ${generated ? `generated (engine ${rec.body.engine_version}, rule ${rec.body.provenance?.rule?.rule_version})` : insufficient ? "insufficient_data: " + rec.body.reasons.map((r) => r.code).join(",") : "unexpected"}`);
      if (generated) check("a generated recommendation carries its rule citation, soil values used and engine version", !!rec.body.provenance?.rule?.source?.locator && !!rec.body.provenance.soil_values_used && !!rec.body.engine_version);
      if (generated && rec.body.provenance?.schedule) {
        // Independent arithmetic (not the engine's code): 300 palms on 2 ha, fixture band 1000/500/1000 g N/P2O5/K2O per palm per year.
        const s = rec.body.provenance.schedule, plan = Object.fromEntries(rec.body.fertilizer_plan.map((d) => [d.product_code, d]));
        const perHa = { n: 1000 * 300 / 1000 / 2, p: 500 * 300 / 1000 / 2, k: 1000 * 300 / 1000 / 2 };   // 150 / 75 / 150 kg per ha
        const dap = perHa.p / 0.46, mop = perHa.k / 0.60, urea = (perHa.n - dap * 0.18) / 0.46;
        const near = (a, b, tol) => Math.abs(a - b) <= tol;
        check("schedule recommendation: palm age year, palm count and per-palm dose come from the plot and the rule", s.age_year >= 3 && s.plant_count === 300 && s.per_palm_g_per_year.n === 1000 && s.per_palm_g_per_year.p === 500 && s.nutrient_basis.p === "oxide", JSON.stringify(s));
        check("schedule recommendation: product quantities equal the hand-worked values (DAP from P2O5 at 46 %, DAP nitrogen credited, MOP at 60 % K2O)", near(plan.dap?.quantity_kg_per_ha, dap, 0.02) && near(plan.mop?.quantity_kg_per_ha, mop, 0.02) && near(plan.urea?.quantity_kg_per_ha, urea, 0.1) && near(plan.dap?.quantity_kg_total, dap * 2, 0.05), JSON.stringify(rec.body.fertilizer_plan));
        const stored = (await A.client.from("recommendations").select("*").eq("id", rec.body.recommendation_id).single()).data;
        check("the stored row keeps the rule kind, version, engine version, schedule arithmetic and soil values used", stored?.engine_version === rec.body.engine_version && stored.provenance?.rule?.rule_kind === "published_schedule" && stored.provenance?.schedule?.age_year === s.age_year && !!stored.provenance?.soil_values_used && (stored.fertilizer_plan ?? []).length === 3, JSON.stringify({ e: stored?.engine_version }));
      }
      if (selftest) check("self-test: the schedule fixture and a plot with age and palm count produce a recommendation", generated, JSON.stringify(rec.body).slice(0, 200));
      if (insufficient) check("insufficient_data saved nothing", (await A.client.from("recommendations").select("id")).data.length === 0);

      check("a recommendation never appears as an application", (await A.client.from("fertilizer_applications").select("id")).data.length === 0);
      const app = await A.client.from("fertilizer_applications").insert({ owner_id: A.id, plot_id: plot.id, applied_on: "2026-01-01", product_name: "Urea", quantity: 50, quantity_unit: "kg" }).select().single();
      check("the farmer records what was actually applied (a separate record)", !app.error, app.error?.message);

      // ---- Digital Twin history for the plot, as the farmer sees it
      const hist = {
        soil: (await A.client.from("soil_reports").select("id").eq("plot_id", plot.id).not("verification_status", "is", null)).data.length,
        recs: (await A.client.from("recommendations").select("id").eq("plot_id", plot.id).not("engine_version", "is", null)).data.length,
        apps: (await A.client.from("fertilizer_applications").select("id").eq("plot_id", plot.id)).data.length,
      };
      check("the plot's history shows 1 verified soil test, the recommendation(s) generated, and 1 recorded application", hist.soil === 1 && hist.apps === 1 && hist.recs === (generated ? 1 : 0), JSON.stringify(hist));

      // ---- second farmer
      const bx = {
        ext: await call(B, "GET", `/api/soil-reports/extractions/${again.body.extraction_id}`),
        list: await call(B, "GET", `/api/soil-reports/extractions?plot_id=${plot.id}`),
        confirm: await call(B, "POST", `/api/soil-reports/extractions/${again.body.extraction_id}/confirm`, { corrections: {}, confirmed: [] }),
        rec: await call(B, "POST", "/api/recommendations", { plot_id: plot.id, soil_report_id: soilId }),
        up: await upload(B, plot.id, readFileSync(cfg.report)),
        twin: await call(B, "GET", `/api/plots/${plot.id}/twin/live`),
      };
      check("farmer B cannot read, list, confirm, recommend on, upload to or view the twin of A's plot (all 404)", Object.values(bx).every((r) => r.status === 404), JSON.stringify(Object.fromEntries(Object.entries(bx).map(([k, v]) => [k, v.status]))));
      const rest = {
        soil: (await B.client.from("soil_reports").select("id")).data.length,
        ext: (await B.client.from("soil_report_extractions").select("id")).data.length,
        apps: (await B.client.from("fertilizer_applications").select("id")).data.length,
        plots: (await B.client.from("plots").select("id")).data.length,
      };
      check("through row-level security B sees none of A's rows", Object.values(rest).every((n) => n === 0), JSON.stringify(rest));
      check("B cannot forge a verified soil report or an application on A's plot", !!(await B.client.from("soil_reports").insert({ owner_id: B.id, plot_id: plot.id, nitrogen_kg_ha: 1, phosphorus_kg_ha: 1, potassium_kg_ha: 1, organic_carbon_percent: 1, ph: 7, verification_status: "user_confirmed" })).error && !!(await B.client.from("fertilizer_applications").insert({ owner_id: B.id, plot_id: plot.id, applied_on: "2026-01-01", product_name: "x", quantity: 1, quantity_unit: "kg" })).error);
      check("A's data is unchanged after B's attempts", (await A.client.from("soil_reports").select("id")).data.length === 1 && (await A.client.from("fertilizer_applications").select("id")).data.length === 1);

      // ---- a plot without palm facts must be refused with the missing facts named (runs last: it adds a second plot and soil report)
      if (selftest || (generated && rec.body.provenance?.schedule)) {
        const plot2 = (await A.client.from("plots").insert({ owner_id: A.id, farmer_id: farmer?.id, name: "Smoke Plot 2", crop: "Oil Palm", area: 1, boundary: poly, latitude: 13.001, longitude: 75.001, boundary_mapped: true }).select().single()).data;
        const up2 = await upload(A, plot2.id, readFileSync(cfg.report), "report-plot2.pdf");
        const before = (await A.client.from("recommendations").select("id")).data.length;
        const rec2 = await call(A, "POST", "/api/recommendations", { plot_id: plot2.id, soil_report_id: up2.body.soil_report_id });
        const codes = (rec2.body?.reasons ?? []).map((r) => r.code).sort().join(",");
        check("a plot with no planting date or palm count gets insufficient_data naming both, and nothing is saved", rec2.status === 200 && rec2.body.state === "insufficient_data" && codes === "plant_count_missing,planting_date_missing" && (await A.client.from("recommendations").select("id")).data.length === before, JSON.stringify(rec2.body).slice(0, 200));
      }
    }
  }
} catch (e) {
  check("script completed without an exception", false, e.stack || e.message);
} finally {
  if (admin) for (const id of created) await admin.auth.admin.deleteUser(id);
  await cleanup();
}
const failed = results.filter((r) => !r.pass);
console.log(`\nSMOKE TOTAL: ${results.length - failed.length}/${results.length} passed${failed.length ? `, ${failed.length} FAILED` : ""}   [${selftest ? "self-test on local emulator" : "staging"}]`);
process.exit(failed.length ? 1 : 0);
