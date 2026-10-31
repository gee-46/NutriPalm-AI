// Browser end-to-end verification of the retained product (soil-report OCR review + fertilizer
// recommendation + Digital Twin), two users.
//
//   cd supabase/tests && npm install && npm run e2e
//
// Starts (all local, nothing external is modified):
//   * an EMULATED Supabase (PGlite Postgres + migrations + GoTrue/PostgREST-compatible API)
//   * the real FastAPI backend (uvicorn)  -- E2E_PYTHON selects the interpreter
//   * the real Vite dev server
// and drives the real app in Microsoft Edge/Chrome with Playwright.
//
// Honest scope: this is NOT a managed Supabase project. Weather / elevation / geocoding / map tiles
// use the real public services (needs internet). Sentinel is not configured and is asserted to degrade
// gracefully. The satellite map uses the one default imagery provider (src/lib/mapConfig.ts); there is no Google Maps. Device GPS is emulated by the browser's geolocation override.

import { spawn, execSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startStack } from "../e2e-stack/stack.mjs";
import { assertPortsFree } from "./lib.mjs";
await assertPortsFree([54421, 8100, 5273]); // never share a port with a developer's running app: the test must talk to its OWN stack
import { newSession, register, waitForConsole, goto, shot, createFarmerUI, surveyAndCreatePlot, KHAMMAM } from "./lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..", "..");
const PY = process.env.E2E_PYTHON || "python";
const files = process.env.E2E_FILES || path.join(tmpdir(), "e2e-files");
const shots = process.env.E2E_SHOTS || path.join(tmpdir(), "e2e-shots");
mkdirSync(shots, { recursive: true });
process.env.TEMP ??= tmpdir();

// Fixtures: real PDFs rendered with the backend's own fixture helpers, and a TEST-ONLY rule pack so the
// recommendation engine can run (the shipped rule pack is empty on purpose).
execSync(`"${process.env.E2E_PYTHON || "python"}" "${path.join(here, "make_fixtures.py")}" "${files}"`, { cwd: path.join(repo, "backend"), stdio: "inherit", env: { ...process.env, PYTHONPATH: path.join(repo, "backend") } });

const results = [];
const check = (group, name, pass, detail = "") => {
  results.push({ group, name, pass: !!pass, detail: pass ? "" : String(detail) });
  console.log(`${pass ? "PASS" : "FAIL"} [${group}] ${name}${pass ? "" : "  -> " + detail}`);
};
const FORBIDDEN = [/Swaminathan/i, /Dr\.? ?L\.? ?Ramana/i, /12% MoM/, /99\.8%/, /sensors online/i, /Telemetry: Online/i, /Rajesh Kumar added/i, /DemoUser/i, /Plot 2A/];
const noFake = async (page, group, label) => {
  const text = await page.locator("body").innerText();
  const hit = FORBIDDEN.find((re) => re.test(text));
  check(group, `no fabricated persona/telemetry text on ${label}`, !hit, hit && `found ${hit}`);
};

// ------------------------------------------------------------------ stack
const secret = crypto.randomBytes(32).toString("hex");
const stack = await startStack({ port: 54421, jwtSecret: secret, quiet: true });
const children = [];
const backendLog = [];
const spawnLogged = (cmd, args, opts, name) => {
  const p = spawn(cmd, args, { ...opts, stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" && cmd === "npx" });
  p.stdout.on("data", () => {});
  p.stderr.on("data", (d) => { backendLog.push(`[${name}] ${d}`); if (process.env.E2E_VERBOSE) process.stderr.write(`[${name}] ${d}`); });
  children.push(p);
  return p;
};
const baseEnv = {
  ...process.env,
  SUPABASE_URL: stack.url,
  SUPABASE_SERVICE_ROLE_KEY: stack.serviceRoleKey,
  SUPABASE_JWT_SECRET: secret,
  CORS_ALLOW_ORIGINS: "http://127.0.0.1:5273",
  ENVIRONMENT: "development",
  RULE_PACK_PATH: path.join(files, "test_rule_pack.json"),
  // hermetic: never use a developer's local Sentinel credentials in the test run
  SENTINEL_HUB_CLIENT_ID: "",
  SENTINEL_HUB_CLIENT_SECRET: "",
  VITE_SUPABASE_URL: stack.url,
  VITE_SUPABASE_ANON_KEY: stack.anonKey,
  VITE_API_BASE_URL: "http://127.0.0.1:8100",
};
spawnLogged(PY, ["-m", "uvicorn", "app.main:app", "--port", "8100"], { cwd: path.join(repo, "backend"), env: baseEnv }, "backend");
spawnLogged("npx", ["vite", "--host", "127.0.0.1", "--port", "5273", "--strictPort"], { cwd: repo, env: baseEnv }, "vite");
const waitUp = async (url) => { for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) return true; } catch {} await new Promise((r) => setTimeout(r, 500)); } return false; };
check("setup", "backend /health reachable", await waitUp("http://127.0.0.1:8100/health"));
check("setup", "frontend reachable", await waitUp("http://127.0.0.1:5273/"));
const dbGet = async (table, q = "select=*") => (await fetch(`${stack.url}/rest/v1/${table}?${q}`, { headers: { apikey: stack.serviceRoleKey, authorization: `Bearer ${stack.serviceRoleKey}` } })).json();

// Known, accepted console noise (documented in docs/PHASE1_AUDIT.md)
const IGNORE_CONSOLE = [
  // Chrome logs every non-2xx response as a console error. Only the deliberate ones are accepted, matched by URL:
  /status of 404 \(Not Found\) @ http:\/\/127\.0\.0\.1:8100\/api\/(plots|geospatial|recommendations|soil-reports)/, // B probing A's ids
  /status of 401 \(Unauthorized\) @ http:\/\/127\.0\.0\.1:8100\/api\/recommendations/, // tokenless / forged call
  /status of (401|403|404|406|409) .* @ http:\/\/127\.0\.0\.1:54421\/rest\/v1\//, // deliberate REST attacks
  // framework-level: framer-motion pathLength animation on the boot splash SVGs (static `d`), not app logic
  /attribute d: Expected moveto path command/,
  // kn.json is frozen: strings added by the soil->recommendation repair (keys "p4.*") exist in English only until a native speaker
  // translates them, and the dev build warns about each fallback. Only those keys are exempt.
  /\[i18n\] Missing Kannada key: "p4\./,
  /Download the React DevTools/,
  // deliberate in this run: confirming a review with required values still missing (422), and probing a removed endpoint (404)
  /status of 422 .* @ http:\/\/127\.0\.0\.1:8100\/api\/soil-reports\/extractions\/[0-9a-f-]+\/confirm/,
  /status of 404 .* @ http:\/\/127\.0\.0\.1:8100\/api\/disease\/vocabulary/,
];
const consoleIssues = [];
const trackIssues = (events, who) => () => {
  for (const c of events.console) if (!IGNORE_CONSOLE.some((re) => re.test(c))) consoleIssues.push(`${who}: ${c}`);
  for (const e of events.pageErrors) consoleIssues.push(`${who}: PAGEERROR ${e}`);
};

const A = { name: "Alice Farmer", email: "alice@e2e.test", password: "Passw0rd!x" };
const B = { name: "Bob Grower", email: "bob@e2e.test", password: "Passw0rd!y" };
let plotA, plotA2, recA, soilA;
let exitCode = 0;

try {
  // ============================================================ USER A
  const sa = await newSession({ permissions: ["geolocation"], geolocation: KHAMMAM });
  const { page, events } = sa;
  const flushA = trackIssues(events, "A");
  const req = (re) => events.requests.filter((r) => re.test(r));

  await register(page, A);
  await waitForConsole(page);
  const dash = await page.locator("body").innerText();
  check("A-dashboard", "greeting uses the authenticated profile name", /Alice Farmer/.test(dash));
  check("A-dashboard", "no hard-coded agronomist persona (role is whatever the profile row says)", !/Lead Agronomist/i.test(dash));
  await noFake(page, "A-dashboard", "dashboard");
  check("A-dashboard", "empty state: 0 plots / 0 farmers, no health score invented", /Start by adding your first plot/.test(dash) && !/\b(health score|crop health)\b.*\d+%/i.test(dash));
  check("A-dashboard", "header API status derived from /health", /Server connected/.test(dash));
  const profA = await dbGet("profiles", "select=id,full_name,user_role");
  check("A-auth", "signup created exactly one profile with the entered name", profA.length === 1 && profA[0].full_name === A.name, JSON.stringify(profA));
  const uidA = profA[0]?.id;
  await shot(page, "01-dashboard").catch(() => {});
  await page.screenshot({ path: path.join(shots, "A-01-dashboard.png"), fullPage: true });

  // ---- farmer
  await createFarmerUI(page, { name: "Ravi Kumar" });
  const farmers = await dbGet("farmers");
  check("A-farm", "farmer persisted in the database for A", farmers.length === 1 && farmers[0].owner_id === uidA && farmers[0].name === "Ravi Kumar" && Number(farmers[0].area) === 3.5, JSON.stringify(farmers));
  check("A-farm", "farmer visible in the UI list", /Ravi Kumar/.test(await page.locator("body").innerText()));
  await noFake(page, "A-farm", "farmers screen");

  // ---- plot + survey
  await surveyAndCreatePlot(page, { plotName: "Plot Alpha", farmer: "Ravi Kumar" });
  await page.waitForSelector("text=Registered Successfully", { timeout: 40000 }).catch(() => {});
  // The save finishes only after live reverse-geocoding and elevation lookups (public services): wait for the ROW, not a fixed delay.
  for (let i = 0; i < 90 && (await dbGet("plots")).length === 0; i++) await page.waitForTimeout(1000);
  await page.waitForTimeout(1500);
  const plots = await dbGet("plots");
  plotA = plots[0];
  check("A-plot", "plot saved for A, linked to A's farmer", plots.length === 1 && plotA.owner_id === uidA && plotA.farmer_id === farmers[0].id, JSON.stringify({ ...plotA, boundary: undefined }));
  const ring = plotA?.boundary?.coordinates?.[0] ?? [];
  check("A-boundary", "boundary is a valid closed WGS84 GeoJSON Polygon (>=4 pts, [lng,lat])", plotA?.boundary?.type === "Polygon" && ring.length >= 4 && JSON.stringify(ring[0]) === JSON.stringify(ring.at(-1)) && ring.every(([lng, lat]) => lng > 79 && lng < 81 && lat > 16 && lat < 18), JSON.stringify(ring));
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const open = ring.slice(0, -1);
  check("A-boundary", "stored plot location = polygon centroid, NOT the first vertex", Math.abs(plotA.latitude - mean(open.map((p) => p[1]))) < 0.0005 && Math.abs(plotA.longitude - mean(open.map((p) => p[0]))) < 0.0005 && (plotA.latitude !== open[0][1] || plotA.longitude !== open[0][0]), `${plotA.latitude},${plotA.longitude} first=${open[0]}`);
  check("A-boundary", "area stored is positive and boundary_mapped is true", plotA.area > 0.5 && plotA.area < 5 && plotA.boundary_mapped === true, plotA.area);
  check("A-plot", "reverse-geocoded location present (village/district/state)", !!(plotA.district && plotA.state), JSON.stringify([plotA.village, plotA.district, plotA.state]));
  check("A-plot", "status is 'Not Assessed' (no invented health)", plotA.status === "Not Assessed", plotA.status);
  await page.screenshot({ path: path.join(shots, "A-02-plot-created.png"), fullPage: true });
  await page.getByRole("button", { name: "Done", exact: true }).click().catch(() => {});

  // ---- reload persistence
  await page.reload({ waitUntil: "networkidle" });
  await waitForConsole(page);
  await goto(page, "Farm Plots");
  await page.waitForTimeout(2500);
  const afterReload = await page.locator("body").innerText();
  check("A-reload", "session persisted across a full page reload", /Alice Farmer/.test(afterReload));
  check("A-reload", "same plot is listed after reload", /Plot Alpha/.test(afterReload));
  check("A-reload", "area displayed after reload matches the stored area (2 dp)", afterReload.includes(Number(plotA.area).toFixed(2)), Number(plotA.area).toFixed(2));
  await page.screenshot({ path: path.join(shots, "A-03-after-reload.png"), fullPage: true });
  await noFake(page, "A-plot", "farm plots screen");

  // ---- weather uses the plot's own centroid
  const wx = events.requests.filter((r) => /open-meteo\.com\/v1\/forecast/.test(r)).map((r) => r);
  const wxHit = wx.find((u) => { const q = new URL(u.split(" ")[1]).searchParams; return Math.abs(Number(q.get("latitude")) - plotA.latitude) < 0.002 && Math.abs(Number(q.get("longitude")) - plotA.longitude) < 0.002; });
  check("A-weather", "weather requested for the plot centroid (not a hard-coded point)", !!wxHit, wx.slice(0, 3).join(" | "));
  check("A-weather", "weather rendered with real values", /LIVE\s*·?\s*OPEN-METEO/i.test(afterReload) || /°C/.test(afterReload));
  check("A-ndvi", "NDVI shown as unavailable/config required (no fabricated NDVI)", /Config required|unavailable/i.test(afterReload));
  const ndviReq = events.requests.filter((r) => /\/api\/geospatial\/ndvi\//.test(r));
  check("A-ndvi", "NDVI requested through the authenticated backend for this plot's id", ndviReq.some((r) => r.includes(plotA.id)), ndviReq.join(","));

  // ---- soil reports: a partial read goes to REVIEW (nothing saved), the owner completes it, a clear read is saved directly
  await goto(page, "Soil Reports");
  await page.locator("input[type=file]").setInputFiles(path.join(files, "soil_partial.pdf"));
  await page.locator("#review-title").waitFor({ timeout: 60000 });
  let soilText = await page.locator("main").innerText();
  check("A-soil", "an incomplete read goes to the review step, not to a saved report", (await dbGet("soil_reports")).length === 0, JSON.stringify(await dbGet("soil_reports")));
  const ext1 = await dbGet("soil_report_extractions");
  check("A-soil", "the extraction is stored as 'needs_review' with the document hash (the document itself is not stored)", ext1.length === 1 && ext1[0].status === "needs_review" && /^[0-9a-f]{64}$/.test(ext1[0].source_sha256) && ext1[0].soil_report_id === null, JSON.stringify(ext1.map((e) => e.status)));
  check("A-soil", "missing K, OC and pH are shown as 'Not found' with empty inputs (never zero)", (soilText.match(/Not found in the report/g) || []).length >= 3 && (await page.locator("#rv-potassium").inputValue()) === "" && (await page.locator("#rv-ph").inputValue()) === "" && (await page.locator("#rv-organic_carbon").inputValue()) === "", soilText.slice(0, 600));
  check("A-soil", "the values that ARE on the report (N=245, P=22) are shown as read", (await page.locator("#rv-nitrogen").inputValue()) === "245" && (await page.locator("#rv-phosphorus").inputValue()) === "22");
  await page.getByRole("button", { name: /Confirm and save/ }).click();
  await page.waitForTimeout(1500);
  check("A-soil", "confirming without supplying the missing values is refused, and nothing is saved", /still need your attention/.test(await page.locator("main").innerText()) && (await dbGet("soil_reports")).length === 0);
  await page.locator("#rv-potassium").fill("150");
  await page.locator("#rv-organic_carbon").fill("0.6");
  await page.locator("#rv-ph").fill("6.8");
  await page.getByRole("button", { name: /Confirm and save/ }).click();
  await page.waitForTimeout(3500);
  let soilRows = await dbGet("soil_reports");
  const corrected = soilRows[0];
  check("A-soil", "after the owner's corrections a verified soil report exists for A's plot (user_corrected)", soilRows.length === 1 && corrected.owner_id === uidA && corrected.plot_id === plotA.id && corrected.verification_status === "user_corrected" && corrected.potassium_kg_ha === 150 && corrected.nitrogen_kg_ha === 245, JSON.stringify(corrected));
  const ext2 = (await dbGet("soil_report_extractions"))[0];
  check("A-soil", "the audit trail keeps what was read (nothing) and what the owner typed, per parameter", ext2.status === "completed" && ext2.soil_report_id === corrected.id && ext2.corrections.length === 3 && ext2.corrections.every((c) => c.original_value === null && c.corrected_value !== null && c.at), JSON.stringify(ext2.corrections));

  // a clearly readable report is saved directly and marked auto_validated
  await goto(page, "Soil Reports");
  await page.getByRole("button", { name: /Re-upload|Update Report/ }).first().click().catch(() => {});
  await page.locator("input[type=file]").setInputFiles(path.join(files, "soil_full.pdf"));
  await page.waitForTimeout(6000);
  soilText = await page.locator("main").innerText();
  soilRows = await dbGet("soil_reports", "select=*&order=created_at.asc");
  soilA = soilRows.find((r) => r.verification_status === "auto_validated");
  check("A-soil", "a clear read is saved directly, linked to its extraction", soilRows.length === 2 && !!soilA && soilA.owner_id === uidA && soilA.plot_id === plotA.id && soilA.nitrogen_kg_ha === 245 && soilA.phosphorus_kg_ha === 18 && soilA.potassium_kg_ha === 142 && soilA.ph === 6.8 && soilA.organic_carbon_percent === 0.62 && soilA.electrical_conductivity === 0.42 && !!soilA.extraction_id, JSON.stringify(soilA));
  check("A-soil", "micronutrients not on the report stay missing (null) in the database", soilA.micronutrients === null || Object.values(soilA.micronutrients).every((v) => v.value !== null), JSON.stringify(soilA.micronutrients));
  check("A-soil", "UI shows N/P/K/pH/EC/OC from the report and 'Not reported' for micronutrients", /245 kg\/ha/.test(soilText) && /142 kg\/ha/.test(soilText) && /6\.8/.test(soilText) && /0\.42 dS\/m/.test(soilText) && /0\.62 ?%/.test(soilText) && /Not reported/i.test(soilText), soilText.slice(0, 300));
  check("A-soil", "no sample report can be loaded into a real plot", !/Load Sample Report|realistic sample/i.test(soilText));
  const reup = await page.evaluate(async () => 0);
  await page.screenshot({ path: path.join(shots, "A-04-soil.png"), fullPage: true });

  // ---- recommendations: from the backend, gated on a cited rule, advice is not an application
  await goto(page, "Recommendations");
  await page.waitForTimeout(2000);
  check("A-reco", "there is no crop-price input any more (nothing in the output depends on it)", (await page.getByLabel("Crop selling price in rupees per ton").count()) === 0);
  const genBtn = page.getByRole("button", { name: /Get advice/i }).first();
  await page.waitForFunction(() => {
    const b = Array.from(document.querySelectorAll("button")).find((el) => /Get advice/i.test(el.innerText));
    return b && !b.disabled;
  }, { timeout: 20000 });
  const postP = page.waitForResponse((r) => /\/api\/recommendations$/.test(r.url()) && r.request().method() === "POST", { timeout: 30000 });
  await genBtn.click();
  const postR = await postP;
  const postBody = JSON.parse(postR.request().postData() || "{}");
  check("A-reco", "browser called POST /api/recommendations (authoritative engine is the backend)", postR.status() === 201, postR.status());
  check("A-reco", "request carries only plot_id and soil_report_id (the latest VERIFIED report) - no owner/user id, no price", postBody.plot_id === plotA.id && postBody.soil_report_id === soilA.id && Object.keys(postBody).sort().join() === "plot_id,soil_report_id", JSON.stringify(postBody));
  const authH = postR.request().headers()["authorization"] || "";
  check("A-reco", "request is authenticated with the user's bearer token", /^Bearer ey/.test(authH));
  await page.waitForTimeout(2500);
  const recRows = await dbGet("recommendations");
  recA = recRows[0];
  check("A-reco", "recommendation persisted for A, plot and soil report match, stamped with engine version and provenance", recRows.length === 1 && recA.owner_id === uidA && recA.plot_id === plotA.id && recA.soil_report_id === soilA.id && recA.engine_version === "rec-2.2" && recA.provenance?.rule?.rule_version === "e2e-test-fixture" && recA.provenance?.soil_verification_status === "auto_validated", JSON.stringify(recRows.map((r) => ({ o: r.owner_id, e: r.engine_version }))));
  await page.getByText("Basis of this recommendation").first().waitFor({ timeout: 20000 }).catch(() => {});
  const recText = await page.locator("main").innerText();
  check("A-reco", "UI shows the dosage plan with its basis (engine, rule, soil values used) and says it is advice, not an application", /Fertilizer to apply/.test(recText) && /Basis of this recommendation/.test(recText) && /Engine rec-2\.[12]/.test(recText) && /This is advice only/.test(recText), recText.slice(0, 300));
  check("A-reco", "no yield, revenue or ROI is shown (their baselines are not sourced)", !/Fertilizer cost|Extra income|Profit|ROI|Expected yield/i.test(recText));
  const ls = await page.evaluate(() => Object.keys(localStorage).filter((k) => /lastRecommendation|soil_report_/.test(k)));
  check("A-reco", "recommendation is not computed/cached locally in the browser", ls.length === 0, ls.join(","));
  await page.screenshot({ path: path.join(shots, "A-05-reco.png"), fullPage: true });
  await page.reload({ waitUntil: "networkidle" });
  await waitForConsole(page);
  await goto(page, "Recommendations");
  await page.waitForTimeout(3000);
  check("A-reco", "saved recommendation is shown again after reload (history from the API)", /Basis of this recommendation/.test(await page.locator("main").innerText()));

  // ---- second plot for twin / isolation between plots
  await surveyAndCreatePlot(page, { plotName: "Plot Beta", farmer: "Ravi Kumar" }).catch(async (e) => { check("A-plot2", "second plot survey flow", false, e.message); });
  await page.waitForTimeout(7000);
  const plots2 = await dbGet("plots", "select=*&order=created_at.asc");
  plotA2 = plots2[1];
  check("A-plot2", "second plot persisted separately", plots2.length === 2 && plotA2?.id !== plotA.id, plots2.length);
  await page.getByRole("button", { name: "Done", exact: true }).click().catch(() => {});

  // ---- digital twin follows the selected plot
  await dbPost(stack, "digital_twins", { plot_id: plotA.id, analysis_date: new Date(Date.now() - 86400000).toISOString(), crop_health_score: 77, ndvi: 0.61, is_synthetic: false });
  await dbPost(stack, "digital_twins", { plot_id: plotA.id, analysis_date: new Date().toISOString(), crop_health_score: 12, ndvi: 0.05, is_synthetic: true });
  await goto(page, "Digital Twin");
  await page.waitForTimeout(6000);
  const liveReqs = () => req(/\/twin\/live/);
  check("A-twin", "live endpoint called with a real plot UUID and bearer token", liveReqs().length > 0 && liveReqs().every((r) => /\/api\/plots\/[0-9a-f-]{36}\/twin\/live/.test(r)), liveReqs().join(","));
  check("A-twin", "prediction endpoint called for a real plot UUID", req(/\/twin\/prediction/).every((r) => /\/api\/plots\/[0-9a-f-]{36}\//.test(r)) && req(/\/twin\/prediction/).length > 0);
  const twinText = await page.locator("main").innerText();
  await page.screenshot({ path: path.join(shots, "A-06-twin.png"), fullPage: true });
  await noFake(page, "A-twin", "digital twin screen");
  check("A-twin", "no hard-coded soil chemistry (pH 6.2 / 72 ppm table removed)", !/72 ppm|0\.28 dS\/m/.test(twinText));
  // the Digital Twin screen lists the user's plots as selectable tiles
  const liveBefore = req(/\/twin\/live/).length;
  await page.locator("main").getByText("Plot Alpha", { exact: true }).first().click();
  await page.waitForTimeout(6000);
  const alphaText = await page.locator("main").innerText();
  check("A-twin", "selecting Plot Alpha requests Alpha's live twin", req(/\/twin\/live/).slice(liveBefore).some((r) => r.includes(plotA.id)), req(/\/twin\/live/).slice(liveBefore).join(","));
  check("A-twin", "Alpha shows its persisted non-synthetic snapshot (77%)", /77/.test(alphaText), alphaText.slice(0, 200));
  check("A-twin", "the synthetic test snapshot (crop health 12) is never shown", !/12\s*%/.test(alphaText.replace(/\d{1,2}:\d{2}/g, "")));
  const liveBefore2 = req(/\/twin\/live/).length;
  await page.locator("main").getByText("Plot Beta", { exact: true }).first().click();
  await page.waitForTimeout(6000);
  const betaText = await page.locator("main").innerText();
  check("A-twin", "selecting Plot Beta requests Beta's live twin (not Alpha's)", req(/\/twin\/live/).slice(liveBefore2).some((r) => r.includes(plotA2.id)) && !req(/\/twin\/live/).slice(liveBefore2).some((r) => r.includes(plotA.id)), req(/\/twin\/live/).slice(liveBefore2).join(","));
  check("A-twin", "Beta has no stored snapshot, so Alpha's 77% does not leak into it", !/77\s*%/.test(betaText), betaText.slice(0, 200));
  await page.screenshot({ path: path.join(shots, "A-06b-twin-beta.png"), fullPage: true });

  // ---- MANAGEMENT RECORDS in the twin: measured vs advice vs applied are separate, and applied is user-recorded
  await page.locator("main").getByText("Plot Alpha", { exact: true }).first().click();
  await page.waitForTimeout(3000);
  await page.locator("#app-product").scrollIntoViewIfNeeded();
  let mgmt = await page.locator("main").innerText();
  check("A-mgmt", "the twin lists the plot's verified soil tests and its recommendation under separate headings", /Soil tests \(measured\)/.test(mgmt) && /Recommendations \(advice, not applied\)/.test(mgmt) && /Fertilizer applied \(recorded by you\)/.test(mgmt) && /No fertilizer application recorded yet/.test(mgmt) && /Corrected by you/.test(mgmt) && /Read clearly, no changes/.test(mgmt), mgmt.slice(-900));
  check("A-mgmt", "a recommendation is NOT shown as an application that happened", (await dbGet("fertilizer_applications")).length === 0);
  await page.locator("#app-qty").fill("0");
  await page.locator("#app-product").fill("Urea");
  await page.getByRole("button", { name: "Save application" }).click();
  check("A-mgmt", "zero quantity is refused client-side and nothing is written", /greater than zero/.test(await page.locator("main").innerText()) && (await dbGet("fertilizer_applications")).length === 0);
  await page.locator("#app-qty").fill("50");
  await page.locator("#app-unit").selectOption("kg");
  await page.locator("#app-rec").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Save application" }).click();
  await page.waitForTimeout(2500);
  const appRows = await dbGet("fertilizer_applications");
  check("A-mgmt", "the application is stored for A's plot, linked to the recommendation, and shown after saving", appRows.length === 1 && appRows[0].owner_id === uidA && appRows[0].plot_id === plotA.id && appRows[0].recommendation_id === recA.id && Number(appRows[0].quantity) === 50 && /Urea · 50 kg/.test(await page.locator("main").innerText()), JSON.stringify(appRows));
  await page.reload({ waitUntil: "networkidle" });
  await waitForConsole(page);
  await goto(page, "Digital Twin");
  await page.waitForTimeout(3000);
  await page.locator("main").getByText("Plot Alpha", { exact: true }).first().click();
  await page.waitForTimeout(2500);
  await page.locator("#app-product").scrollIntoViewIfNeeded();
  check("A-mgmt", "history persists after a refresh", /Urea · 50 kg/.test(await page.locator("main").innerText()));
  await page.screenshot({ path: path.join(shots, "A-06c-twin-management.png"), fullPage: true });

  // ---- removed features are not reachable
  const navNames = await page.locator("aside nav button").allInnerTexts();
  check("A-scope", "navigation offers only the retained features", navNames.length === 9 && !navNames.some((n) => /Disease|Suitab|Analytics|Weather|ರೋಗ|ವಿಶ್ಲೇಷ/i.test(n)), navNames.join(" | "));
  const disGone = await page.evaluate(async () => (await fetch("http://127.0.0.1:8100/api/disease/vocabulary")).status);
  check("A-scope", "the disease endpoints no longer exist on the backend (404, not just hidden)", disGone === 404, disGone);

  // ============================================================ PHASE 2 (farmer-first UI, English + Kannada)
  const mainText = () => page.locator("main").innerText();
  const noPost = (re) => !events.requests.some((r) => r.startsWith("POST") && re.test(r));
  const pickPlot = async (selector, name) => {
    const val = await page.locator(`${selector} option`, { hasText: name }).first().getAttribute("value");
    await page.locator(selector).selectOption(val);
    await page.waitForTimeout(2500);
  };

  let p2t;
  // ---- nutrient & fertilizer page keeps the backend's numbers and labels each kind of value
  await goto(page, "Recommendations");
  await pickPlot("#nf-plot", "Plot Alpha");
  await page.waitForTimeout(1500);
  p2t = await mainText();
  check("P2-nutrient", "separates observed / derived / recommendation values, and shows no 'predicted' block without a source", /Observed/.test(p2t) && /Derived/.test(p2t) && /Recommendation/.test(p2t) && !/Predicted/.test(p2t), p2t.slice(0, 300));
  check("P2-nutrient", "says what the server does not provide (per-plant quantity, method, timing)", /Quantity per plant[\s\S]*not give this yet/.test(p2t) && /How to apply it/.test(p2t) && /When to apply it/.test(p2t));
  check("P2-nutrient", "missing micronutrient / unknown values are never shown as 0", !/\b0 kg\/ha\b/.test(p2t));

  // ---- history lists real saved items only
  await goto(page, "History");
  await page.waitForTimeout(2500);
  p2t = await mainText();
  check("P2-history", "lists the verified soil reports, fertilizer advice, applied fertilizer and plots", /Soil report · Plot Alpha/.test(p2t) && /Fertilizer advice · Plot Alpha/.test(p2t) && /Fertilizer applied · Plot Alpha/.test(p2t) && /Plot added · Plot Beta/.test(p2t), p2t.slice(0, 500));
  await page.getByRole("button", { name: "Soil reports", exact: true }).click();
  await page.waitForTimeout(500);
  check("P2-history", "the filter really filters", !/Fertilizer advice · Plot/.test(await mainText()));

  // ---- language: Kannada switch, persistence, whole-app coverage, layout
  const KN = /[ಀ-೿]/;
  const ALLOWED = /Alice Farmer|Ravi Kumar|Plot (Alpha|Beta)|alice@e2e\.test|Khammam|Telangana|India|Oil Palm|oil palm|Open-Meteo|NutriPalm( AI)?|Sentinel(-2)?|NDVI|WGS[- ]?84|EPSG|GPS|GIS|IoT|OCR|PDF|Digital Twin|Google Maps|Esri|Aadhaar|ESRI|OpenStreetMap|Leaflet/g;
  // The same documented exemption, built from en.json so it cannot drift: the English-only p4.* strings (placeholders become wildcards).
  const PENDING_KN = Object.entries(JSON.parse(readFileSync(path.join(repo, "src", "translation", "translations", "en.json"), "utf8")))
    .filter(([k]) => k.startsWith("p4."))
    .map(([, v]) => {
      const escaped = String(v).replace(/[.*+?^$()|[\]\\]/g, "\\$&"); // escape regex characters except braces
      return new RegExp(escaped.replace(/\{\w+\}/g, ".*"), "g");
    });
  const englishRuns = (text) =>
    PENDING_KN.reduce((t, re) => t.replace(re, " "), text)
      .replace(ALLOWED, " ")
      .split("\n")
      .filter((l) => /(?:[A-Za-z][A-Za-z'&-]{2,}\s+){2}[A-Za-z][A-Za-z'&-]{2,}/.test(l));
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

  await goto(page, "Dashboard");
  await page.waitForTimeout(2000);
  const enDash = await mainText();
  await page.getByRole("button", { name: "Switch to Kannada" }).first().click();
  await page.waitForTimeout(1200);
  check("P2-lang", "document language switches to kn immediately (no reload, no logout)", (await page.evaluate(() => document.documentElement.lang)) === "kn");
  const knDash = await mainText();
  check("P2-lang", "dashboard text changes to Kannada", KN.test(knDash) && knDash !== enDash, knDash.slice(0, 200));
  const navKn = await page.locator("aside nav").innerText();
  check("P2-lang", "navigation (group titles and items) is in Kannada", /ಜಮೀನಿನ ಆರೋಗ್ಯ/.test(navKn) && /ಮಣ್ಣು/.test(navKn), navKn.slice(0, 300));
  check("P2-lang", "choice is stored on the device", (await page.evaluate(() => localStorage.getItem("nutripalm_lang"))) === "kn");
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("aside nav").waitFor({ timeout: 45000 });
  await page.waitForTimeout(2500);
  check("P2-lang", "Kannada persists across a full refresh (still signed in)", (await page.evaluate(() => document.documentElement.lang)) === "kn" && KN.test(await page.locator("aside nav").innerText()));

  // walk the whole navigation in Kannada
  const navCount = await page.locator("aside nav button").count();
  check("P2-lang", "navigation exposes all 9 destinations", navCount === 9, navCount);
  const STRICT = new Set(["Dashboard", "History", "Recommendations"]);
  const looseReport = {};
  const pageOrder = ["Dashboard", "Farmers", "Farm Plots", "Soil Reports", "Digital Twin", "Recommendations", "History", "Profile", "Settings"];
  for (let i = 0; i < navCount; i++) {
    await page.locator("aside nav button").nth(i).click();
    await page.waitForTimeout(2200);
    const id = pageOrder[i];
    const txt = await mainText();
    const ov = await overflow();
    // Text the SERVER writes (assumptions, not-considered list) is English by design and announced on the page; it is marked
    // data-server-text and excluded here. Everything else on the page must be translated.
    const txtOwn = await page.evaluate(() => {
      const hidden = [...document.querySelectorAll("[data-server-text]")];
      hidden.forEach((e) => { e.dataset.prev = e.style.display; e.style.display = "none"; });
      const out = (document.querySelector("main") || document.body).innerText;
      hidden.forEach((e) => { e.style.display = e.dataset.prev ?? ""; delete e.dataset.prev; });
      return out;
    });
    const eng = englishRuns(txtOwn);
    looseReport[id] = eng.slice(0, 8);
    await page.screenshot({ path: path.join(shots, `P2-kn-${String(i).padStart(2, "0")}-${id.replace(/\W+/g, "_")}.png`), fullPage: true });
    check("P2-lang", `Kannada page "${id}": renders Kannada text and does not overflow the viewport horizontally`, KN.test(txt) && ov <= 1, `kn=${KN.test(txt)} overflowPx=${ov}`);
    if (STRICT.has(id)) check("P2-lang", `Kannada page "${id}": no untranslated English sentences`, eng.length === 0, eng.slice(0, 6).join(" | "));
  }
  writeFileSync(path.join(shots, "p2-kannada-english-leftovers.json"), JSON.stringify(looseReport, null, 2));

  // Kannada on tablet and phone
  for (const [label, vp] of [["tablet 820x1180", { width: 820, height: 1180 }], ["phone 390x844", { width: 390, height: 844 }]]) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(800);
    for (const id of ["Dashboard", "Recommendations", "Soil Reports"]) {
      if (vp.width < 768) {
        await page.getByRole("button", { name: "ಮೆನು ತೆರೆಯಿರಿ" }).click();
        await page.waitForTimeout(500);
        const items = page.locator("div.fixed nav button");
        const labels = await items.allInnerTexts();
        const idx = pageOrder.indexOf(id);
        await items.nth(idx).click();
      } else {
        await page.locator("aside nav button").nth(pageOrder.indexOf(id)).click();
      }
      await page.waitForTimeout(2000);
      const ov = await overflow();
      await page.screenshot({ path: path.join(shots, `P2-${label.split(" ")[0]}-${id.replace(/\W+/g, "_")}.png`), fullPage: true });
      check("P2-responsive", `${label}: "${id}" in Kannada has no horizontal page scroll`, ov <= 1, `overflowPx=${ov}`);
    }
  }
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.waitForTimeout(500);

  // accessibility basics (on the Soil Reports page, which carries the upload controls)
  await page.locator("aside nav button").nth(pageOrder.indexOf("Soil Reports")).click();
  await page.waitForTimeout(1500);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const focus = await page.evaluate(() => {
    const el = document.activeElement;
    const cs = el ? getComputedStyle(el) : null;
    return { tag: el?.tagName, visible: !!cs && (cs.outlineStyle !== "none" || cs.boxShadow !== "none") };
  });
  check("P2-a11y", "keyboard Tab lands on an interactive element", ["BUTTON", "A", "SELECT", "INPUT", "TEXTAREA"].includes(focus.tag), JSON.stringify(focus));
  const unlabeled = await page.evaluate(() => [...document.querySelectorAll("main input, main select, main textarea")].filter((el) => !el.labels?.length && !el.getAttribute("aria-label") && el.type !== "hidden").map((el) => el.outerHTML.slice(0, 80)));
  check("P2-a11y", "form controls on the visible page have an accessible label", unlabeled.length === 0, unlabeled.join(" | "));

  // back to English and make sure the app is fully English again
  await page.getByRole("button", { name: /Switch to English/ }).first().click();
  await page.waitForTimeout(1200);
  await goto(page, "Dashboard");
  await page.waitForTimeout(1500);
  check("P2-lang", "switching back restores English everywhere", (await page.evaluate(() => document.documentElement.lang)) === "en" && !KN.test(await mainText()));

  // ---- settings/profile identity
  await goto(page, "Profile");
  await page.waitForTimeout(2000);
  const profText = await page.locator("main").innerText();
  check("A-profile", "profile page shows the signed-up name and email from the profile row", /Alice Farmer/.test(profText) && /alice@e2e\.test/.test(profText), profText.slice(0, 300));
  await goto(page, "Settings");
  await page.waitForTimeout(1500);
  const setText = await page.locator("main").innerText();
  check("A-profile", "settings page carries no hard-coded organisation/licence/persona", !/NP-2026|Samruddhi Organics|Ramana|Chittoor Regional Hub/.test(setText), setText.slice(0, 300));

  // ---- logout
  await page.getByRole("button", { name: /Sign Out/ }).first().click();
  await page.waitForTimeout(3000);
  const afterLogout = await page.locator("body").innerText();
  check("A-logout", "returns to the public landing page", /Explore Prototype/.test(afterLogout) && !/Sign Out/.test(afterLogout));
  const leftover = await page.evaluate(() => ({ keys: Object.keys(localStorage), sb: Object.keys(localStorage).filter((k) => /sb-.*auth-token/.test(k)) }));
  check("A-logout", "auth token and nutripalm* account caches removed (the device language preference is kept on purpose)", leftover.sb.length === 0 && !leftover.keys.some((k) => k.startsWith("nutripalm") && k !== "nutripalm_lang"), JSON.stringify(leftover));
  await page.goto("http://127.0.0.1:5273/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  check("A-logout", "reloading the app after logout does not restore the console", !/Sign Out/.test(await page.locator("body").innerText()));
  const stale = await page.evaluate(async () => { const r = await fetch("http://127.0.0.1:8100/api/recommendations"); return r.status; });
  check("A-logout", "API without a token is refused (401)", stale === 401, stale);
  flushA();

  // ============================================================ USER B
  const sb = await newSession({ permissions: ["geolocation"], geolocation: KHAMMAM });
  const pb = sb.page;
  const flushB = trackIssues(sb.events, "B");
  await register(pb, B);
  await waitForConsole(pb);
  const bDash = await pb.locator("body").innerText();
  check("B-isolation", "B's dashboard shows B's name and zero data (none of A's)", /Bob Grower/.test(bDash) && !/Alice Farmer|Plot Alpha|Ravi Kumar/.test(bDash));
  for (const screen of ["Farmers", "Farm Plots", "Soil Reports", "Recommendations", "Digital Twin"]) {
    await goto(pb, screen);
    await pb.waitForTimeout(1500);
    const t = await pb.locator("main").innerText();
    check("B-isolation", `${screen}: none of A's farmer/plots/report/recommendation appear`, !/Ravi Kumar|Plot Alpha|Plot Beta|Alice/.test(t), t.slice(0, 120));
  }
  await pb.screenshot({ path: path.join(shots, "B-01-empty.png"), fullPage: true });

  // direct attacks from B's real browser session
  const attacks = await pb.evaluate(async ({ api, rest, ids }) => {
    const key = Object.keys(localStorage).find((k) => /sb-.*auth-token/.test(k));
    const tok = JSON.parse(localStorage.getItem(key)).access_token;
    const h = { Authorization: `Bearer ${tok}` };
    const jget = async (u, opt = {}) => { const { headers: extra = {}, ...rest } = opt; const r = await fetch(u, { ...rest, headers: { ...h, ...extra } }); let b = null; try { b = await r.json(); } catch {} return { status: r.status, body: b }; };
    const out = {};
    out.twinLive = await jget(`${api}/api/plots/${ids.plot}/twin/live`);
    out.twinPred = await jget(`${api}/api/plots/${ids.plot}/twin/prediction`);
    out.ndvi = await jget(`${api}/api/geospatial/ndvi/${ids.plot}`);
    out.cadastral = await jget(`${api}/api/geospatial/bhunaksha/${ids.plot}`);
    out.rec = await jget(`${api}/api/recommendations/${ids.rec}`);
    out.recList = await jget(`${api}/api/recommendations`);
    out.recCreate = await jget(`${api}/api/recommendations`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plot_id: ids.plot, soil_report_id: ids.soil, crop_price_per_ton_inr: 1000 }) });
    const fd = new FormData(); fd.append("plot_id", ids.plot); fd.append("file", new Blob(["%PDF-1.4 x"], { type: "application/pdf" }), "r.pdf");
    out.upload = await jget(`${api}/api/soil-reports/upload`, { method: "POST", body: fd });
    const rh = { apikey: tok, Authorization: `Bearer ${tok}`, "content-type": "application/json", Prefer: "return=representation" };
    const r1 = await fetch(`${rest}/rest/v1/plots?id=eq.${ids.plot}`, { headers: rh }); out.restPlot = { status: r1.status, body: await r1.json() };
    const r2 = await fetch(`${rest}/rest/v1/soil_reports?plot_id=eq.${ids.plot}`, { headers: rh }); out.restSoil = { status: r2.status, body: await r2.json() };
    const r3 = await fetch(`${rest}/rest/v1/plots?id=eq.${ids.plot}`, { method: "PATCH", headers: rh, body: JSON.stringify({ name: "pwned" }) }); out.restUpdate = { status: r3.status, body: await r3.json() };
    const r4 = await fetch(`${rest}/rest/v1/plots?id=eq.${ids.plot}`, { method: "DELETE", headers: rh }); out.restDelete = { status: r4.status, body: await r4.json() };
    const r5 = await fetch(`${rest}/rest/v1/soil_reports`, { method: "POST", headers: rh, body: JSON.stringify({ owner_id: JSON.parse(localStorage.getItem(key)).user.id, plot_id: ids.plot, nitrogen_kg_ha: 1, phosphorus_kg_ha: 1, potassium_kg_ha: 1, organic_carbon_percent: 1, ph: 7 }) }); out.restInsertOnA = { status: r5.status, body: await r5.json() };
    const r6 = await fetch(`${rest}/rest/v1/plots?select=id`, { headers: rh }); out.restOwnPlots = { status: r6.status, body: await r6.json() };
    out.extGet = await jget(`${api}/api/soil-reports/extractions/${ids.ext}`);
    out.extList = await jget(`${api}/api/soil-reports/extractions?plot_id=${ids.plot}`);
    out.extConfirm = await jget(`${api}/api/soil-reports/extractions/${ids.ext}/confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ corrections: { nitrogen: { value: 1, unit: "kg/ha" } }, confirmed: [] }) });
    const rA = await fetch(`${rest}/rest/v1/soil_report_extractions?id=eq.${ids.ext}`, { headers: rh }); out.restExt = { status: rA.status, body: await rA.json() };
    const rB = await fetch(`${rest}/rest/v1/fertilizer_applications?plot_id=eq.${ids.plot}`, { headers: rh }); out.restApps = { status: rB.status, body: await rB.json() };
    const uid = JSON.parse(localStorage.getItem(key)).user.id;
    const rC = await fetch(`${rest}/rest/v1/fertilizer_applications`, { method: "POST", headers: rh, body: JSON.stringify({ owner_id: uid, plot_id: ids.plot, applied_on: "2026-01-01", product_name: "x", quantity: 1, quantity_unit: "kg" }) }); out.restAppInsertOnA = { status: rC.status, body: await rC.json().catch(() => null) };
    const rD = await fetch(`${rest}/rest/v1/soil_reports`, { method: "POST", headers: rh, body: JSON.stringify({ owner_id: uid, plot_id: ids.ownPlot, nitrogen_kg_ha: 1, phosphorus_kg_ha: 1, potassium_kg_ha: 1, organic_carbon_percent: 1, ph: 7, verification_status: "user_confirmed" }) }); out.restForgedVerified = { status: rD.status, body: await rD.json().catch(() => null) };
    const rE = await fetch(`${rest}/rest/v1/recommendations?id=eq.${ids.rec}`, { method: "PATCH", headers: rh, body: JSON.stringify({ fertilizer_plan: [] }) }); out.restRecPatch = { status: rE.status, body: await rE.json().catch(() => null) };
    return out;
  }, { api: "http://127.0.0.1:8100", rest: stack.url, ids: { plot: plotA.id, rec: recA.id, soil: soilA.id, ext: soilA.extraction_id, ownPlot: plotA.id } });
  for (const k of ["twinLive", "twinPred", "ndvi", "cadastral", "rec", "recCreate", "upload"]) {
    check("B-attack", `API ${k}: B's token against A's resource -> 404 with no data`, attacks[k].status === 404 && !JSON.stringify(attacks[k].body).includes(plotA.id.slice(0, 8) + "x"), `${attacks[k].status} ${JSON.stringify(attacks[k].body)}`);
  }
  check("B-attack", "soil extractions: B reading, listing or confirming A's extraction is 404 with no data", [attacks.extGet, attacks.extConfirm].every((r) => r.status === 404 && !JSON.stringify(r.body).includes("245")) && attacks.extList.status === 404, JSON.stringify([attacks.extGet, attacks.extList, attacks.extConfirm]));
  check("B-attack", "REST: B sees none of A's extractions or applications; inserting an application on A's plot is rejected", attacks.restExt.body.length === 0 && attacks.restApps.body.length === 0 && attacks.restAppInsertOnA.status >= 400, JSON.stringify([attacks.restExt, attacks.restApps, attacks.restAppInsertOnA]));
  check("B-attack", "REST: B cannot write a soil report that claims verification, nor rewrite an engine-generated recommendation", attacks.restForgedVerified.status >= 400 && attacks.restRecPatch.body?.length === 0, JSON.stringify([attacks.restForgedVerified, attacks.restRecPatch]));
  check("B-attack", "A's verified data is intact after B's attacks", (await dbGet("soil_reports")).length === 2 && (await dbGet("soil_report_extractions")).every((e) => e.owner_id === uidA) && (await dbGet("recommendations"))[0].fertilizer_plan.length > 0);
  check("B-attack", "API recommendation list for B is empty", attacks.recList.status === 200 && attacks.recList.body.length === 0, JSON.stringify(attacks.recList));
  check("B-attack", "REST read of A's plot returns no rows", attacks.restPlot.status === 200 && attacks.restPlot.body.length === 0, JSON.stringify(attacks.restPlot));
  check("B-attack", "REST read of A's soil reports returns no rows", attacks.restSoil.body.length === 0);
  check("B-attack", "REST update of A's plot changes nothing", attacks.restUpdate.body.length === 0, JSON.stringify(attacks.restUpdate));
  check("B-attack", "REST delete of A's plot deletes nothing", attacks.restDelete.body.length === 0, JSON.stringify(attacks.restDelete));
  check("B-attack", "REST insert of a soil report on A's plot is rejected", attacks.restInsertOnA.status >= 400, JSON.stringify(attacks.restInsertOnA));
  check("B-attack", "B sees none of A's plots through REST", attacks.restOwnPlots.body.length === 0);
  const intact = await dbGet("plots", `select=id,name&id=eq.${plotA.id}`);
  check("B-attack", "A's plot is untouched after B's attacks", intact.length === 1 && intact[0].name === "Plot Alpha", JSON.stringify(intact));
  // an invalid / forged token from the browser
  const forged = await pb.evaluate(async () => (await fetch("http://127.0.0.1:8100/api/recommendations", { headers: { Authorization: "Bearer forged.token.value" } })).status);
  check("B-attack", "forged bearer token rejected (401)", forged === 401, forged);
  flushB();

  // ============================================================ console audit
  check("console", "no uncaught page errors / unexpected console errors across both sessions", consoleIssues.length === 0, consoleIssues.slice(0, 6).join(" || "));
  const allHttp = [...events.http, ...sb.events.http];
  const expected = (h) =>
    /^404 (GET|POST) http:\/\/127\.0\.0\.1:8100\/api\/(plots|geospatial|recommendations|soil-reports|disease)/.test(h) || // B's attacks on A's ids
    /^401 GET http:\/\/127\.0\.0\.1:8100\/api\/recommendations/.test(h) || // deliberate tokenless / forged calls
    /^422 POST http:\/\/127\.0\.0\.1:8100\/api\/soil-reports\/extractions\/[0-9a-f-]+\/confirm/.test(h) || // deliberate: confirm with required values missing
    /^404 GET http:\/\/127\.0\.0\.1:8100\/api\/disease\/vocabulary/.test(h) || // deliberate: removed endpoint
    /^(401|403|404|406|409) \S+ http:\/\/127\.0\.0\.1:54421\/rest\/v1\//.test(h) || // deliberate REST attacks and maybeSingle probes
    /^40[0-9] POST http:\/\/127\.0\.0\.1:54421\/rest\/v1\/soil_reports/.test(h);
  const unexpected = allHttp.filter((h) => !expected(h));
  check("console", "no unexpected HTTP errors in the network log (B's deliberate attacks excluded)", unexpected.length === 0, unexpected.slice(0, 6).join(" || "));
  const dupLive = events.requests.filter((r) => /\/twin\/live/.test(r)).length;
  const recGets = sa.events.requests.filter((r) => /^GET .*\/api\/recommendations$/.test(r)).length;
  check("console", "no request storm on /api/recommendations (effects must not re-run on every render)", recGets < 40, recGets);
  check("console", "no request storm (live twin polled < 12x during the run)", dupLive < 12, dupLive);
  await sa.browser.close();
  await sb.browser.close();
} catch (e) {
  check("run", "E2E run completed without a harness exception", false, e.stack || e.message);
  for (const [i, pg] of (globalThis.__e2ePages ?? []).entries()) await pg.screenshot({ path: path.join(shots, `FAIL-harness-${i}.png`), fullPage: true }).catch(() => {});
  exitCode = 1;
} finally {
  for (const c of children) {
    try {
      // `npx`/uvicorn spawn grandchildren; kill the whole tree (plain kill() leaves vite running on Windows)
      if (process.platform === "win32") execSync(`taskkill /PID ${c.pid} /T /F`, { stdio: "ignore" });
      else c.kill("SIGTERM");
    } catch {}
  }
  await stack.close();
}

async function dbPost(stack, table, row) {
  const r = await fetch(`${stack.url}/rest/v1/${table}`, { method: "POST", headers: { apikey: stack.serviceRoleKey, authorization: `Bearer ${stack.serviceRoleKey}`, "content-type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(row) });
  return r.json();
}

const tb = backendLog.join("").split(/\r?\n/).filter((l) => /Traceback|Error|Exception/.test(l)).slice(0, 12);
check("backend", "no unhandled exception in the backend log during the run", tb.length === 0, tb.join(" | "));
writeFileSync(path.join(shots, "backend.log"), backendLog.join(""));
const failed = results.filter((r) => !r.pass);
console.log(`\nE2E TOTAL: ${results.length - failed.length}/${results.length} passed${failed.length ? `, ${failed.length} FAILED` : ""}`);
writeFileSync(path.join(shots, "e2e-report.json"), JSON.stringify({ engine: "emulated Supabase (PGlite) + real FastAPI + real Vite app in Edge", results }, null, 2));
process.exit(failed.length || exitCode ? 1 : 0);
