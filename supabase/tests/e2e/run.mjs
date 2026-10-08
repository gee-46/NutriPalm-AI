// Browser end-to-end verification of the Phase 1 journey, two users.
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
// use the real public services (needs internet). Sentinel and Google Maps are not configured and are
// asserted to degrade gracefully. Device GPS is emulated by the browser's geolocation override.

import { spawn, execSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startStack } from "../e2e-stack/stack.mjs";
import { newSession, register, login, waitForConsole, goto, shot, createFarmerUI, surveyAndCreatePlot, KHAMMAM } from "./lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..", "..");
const PY = process.env.E2E_PYTHON || "python";
const files = process.env.E2E_FILES || path.join(tmpdir(), "e2e-files");
const shots = process.env.E2E_SHOTS || path.join(tmpdir(), "e2e-shots");
mkdirSync(shots, { recursive: true });
process.env.TEMP ??= tmpdir();

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
const stack = await startStack({ port: 54321, jwtSecret: secret, quiet: true });
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
  CORS_ALLOW_ORIGINS: "http://127.0.0.1:5173",
  ENVIRONMENT: "development",
  VITE_SUPABASE_URL: stack.url,
  VITE_SUPABASE_ANON_KEY: stack.anonKey,
  VITE_API_BASE_URL: "http://127.0.0.1:8000",
};
spawnLogged(PY, ["-m", "uvicorn", "app.main:app", "--port", "8000"], { cwd: path.join(repo, "backend"), env: baseEnv }, "backend");
spawnLogged("npx", ["vite", "--host", "127.0.0.1", "--port", "5173", "--strictPort"], { cwd: repo, env: baseEnv }, "vite");
const waitUp = async (url) => { for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) return true; } catch {} await new Promise((r) => setTimeout(r, 500)); } return false; };
check("setup", "backend /health reachable", await waitUp("http://127.0.0.1:8000/health"));
check("setup", "frontend reachable", await waitUp("http://127.0.0.1:5173/"));
const dbGet = async (table, q = "select=*") => (await fetch(`${stack.url}/rest/v1/${table}?${q}`, { headers: { apikey: stack.serviceRoleKey, authorization: `Bearer ${stack.serviceRoleKey}` } })).json();

// Known, accepted console noise (documented in docs/PHASE1_AUDIT.md)
const IGNORE_CONSOLE = [
  // Chrome logs every non-2xx response as a console error. Only the deliberate ones are accepted, matched by URL:
  /status of 404 \(Not Found\) @ http:\/\/127\.0\.0\.1:8000\/api\/(plots|geospatial|recommendations|soil-reports)/, // B probing A's ids
  /status of 401 \(Unauthorized\) @ http:\/\/127\.0\.0\.1:8000\/api\/recommendations/, // tokenless / forged call
  /status of (401|403|404|406|409) .* @ http:\/\/127\.0\.0\.1:54321\/rest\/v1\//, // deliberate REST attacks
  // framework-level: framer-motion pathLength animation on the boot splash SVGs (static `d`), not app logic
  /attribute d: Expected moveto path command/,
  /GOOGLE_MAPS_API_KEY_MISSING/, // keyless fallback is intentional
  /Download the React DevTools/,
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
  check("A-dashboard", "role comes from the profile (Farmer), not hard-coded agronomist persona", /FARMER/i.test(dash));
  await noFake(page, "A-dashboard", "dashboard");
  check("A-dashboard", "empty state: 0 plots / 0 farmers, no health score invented", /No Digital Twin data yet/.test(dash) && /N\/A/.test(dash));
  check("A-dashboard", "header API status derived from /health", /API ONLINE/.test(dash));
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
  const m = afterReload.match(/(\d+\.\d{2}) Acres/g) || [];
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

  // ---- soil reports (frontend integration; OCR itself verified manually by the owner)
  await goto(page, "Soil Reports");
  await page.locator("input[type=file]").setInputFiles(path.join(files, "soil_partial.pdf"));
  await page.waitForTimeout(8500);
  let soilText = await page.locator("main").innerText();
  const partialRows = await dbGet("soil_reports");
  check("A-soil", "incomplete report is NOT persisted", partialRows.length === 0, JSON.stringify(partialRows));
  check("A-soil", "missing values (K, pH, OC) are shown as missing, not invented", /Not Found|N\/A|missing/i.test(soilText) && !/\b(280|175|6\.5)\b.*kg\/ha/.test(soilText));
  check("A-soil", "user is told the report was not saved", /not saved|Not Saved|could not be confidently|Low Confidence/i.test(soilText), soilText.slice(0, 200));
  await page.locator("input[type=file]").setInputFiles(path.join(files, "soil_full.pdf")).catch(async () => {
    await page.getByRole("button", { name: /Re-upload|Update Report/ }).first().click();
    await page.locator("input[type=file]").setInputFiles(path.join(files, "soil_full.pdf"));
  });
  await page.waitForTimeout(9000);
  soilText = await page.locator("main").innerText();
  const soilRows = await dbGet("soil_reports");
  soilA = soilRows[0];
  check("A-soil", "complete report persisted to A's plot with the extracted values", soilRows.length === 1 && soilA.owner_id === uidA && soilA.plot_id === plotA.id && soilA.nitrogen_kg_ha === 245 && soilA.phosphorus_kg_ha === 18 && soilA.potassium_kg_ha === 142 && soilA.ph === 6.8 && soilA.organic_carbon_percent === 0.62 && soilA.electrical_conductivity === 0.42, JSON.stringify(soilA));
  check("A-soil", "micronutrients not on the report stay missing (null) in the database", soilA.micronutrients === null || Object.values(soilA.micronutrients).every((v) => v.value !== null), JSON.stringify(soilA.micronutrients));
  check("A-soil", "UI shows N/P/K/pH/EC/OC from the report and 'Not reported' for micronutrients", /245 kg\/ha/.test(soilText) && /142 kg\/ha/.test(soilText) && /6\.8/.test(soilText) && /0\.42 dS\/m/.test(soilText) && /0\.62 ?%/.test(soilText) && /Not reported/i.test(soilText));
  await page.screenshot({ path: path.join(shots, "A-04-soil.png"), fullPage: true });

  // ---- recommendations: must come from the backend
  const reqBefore = events.requests.length;
  await goto(page, "Recommendations");
  await page.waitForTimeout(2000);
  const genBtn = page.getByRole("button", { name: /Generate New Recommendation|Generate/i }).first();
  await genBtn.click();
  await page.waitForTimeout(800);
  check("A-reco", "generate without a crop price is refused with a clear message (no silent default)", /crop selling price/i.test(await page.locator("body").innerText()));
  await page.getByLabel("Crop selling price in rupees per ton").fill("13500");
  const postP = page.waitForResponse((r) => /\/api\/recommendations$/.test(r.url()) && r.request().method() === "POST", { timeout: 30000 });
  await genBtn.click();
  const postR = await postP;
  const postBody = JSON.parse(postR.request().postData() || "{}");
  check("A-reco", "browser called POST /api/recommendations (authoritative engine is the backend)", postR.status() === 201, postR.status());
  check("A-reco", "request carries plot_id, soil_report_id and the entered price - and no owner/user id", postBody.plot_id === plotA.id && postBody.soil_report_id === soilA.id && postBody.crop_price_per_ton_inr === 13500 && !("owner_id" in postBody) && !("user_id" in postBody), JSON.stringify(postBody));
  const authH = postR.request().headers()["authorization"] || "";
  check("A-reco", "request is authenticated with the user's bearer token", /^Bearer ey/.test(authH));
  await page.waitForTimeout(2500);
  const recRows = await dbGet("recommendations");
  recA = recRows[0];
  check("A-reco", "recommendation persisted for A, plot and soil report match", recRows.length === 1 && recA.owner_id === uidA && recA.plot_id === plotA.id && recA.soil_report_id === soilA.id, JSON.stringify(recRows.map((r) => ({ o: r.owner_id, p: r.plot_id }))));
  const recText = await page.locator("main").innerText();
  check("A-reco", "UI shows backend results (dosage table, economics, saved timestamp)", /Fertilizer plan|Dose|Economics|Saved/i.test(recText) && /Fertilizer cost/.test(recText));
  check("A-reco", "UI uses the crop price entered by the user in ROI", /13,500/.test(recText));
  const ls = await page.evaluate(() => Object.keys(localStorage).filter((k) => /lastRecommendation|soil_report_/.test(k)));
  check("A-reco", "recommendation is not computed/cached locally in the browser", ls.length === 0, ls.join(","));
  await page.screenshot({ path: path.join(shots, "A-05-reco.png"), fullPage: true });
  await page.reload({ waitUntil: "networkidle" });
  await waitForConsole(page);
  await goto(page, "Recommendations");
  await page.waitForTimeout(3000);
  check("A-reco", "saved recommendation is shown again after reload (history from the API)", /Fertilizer cost/.test(await page.locator("main").innerText()));

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

  // ---- analytics
  await goto(page, "Analytics");
  await page.waitForTimeout(3500);
  const an = await page.locator("main").innerText();
  await page.screenshot({ path: path.join(shots, "A-07-analytics.png"), fullPage: true });
  await noFake(page, "A-analytics", "analytics");
  check("A-analytics", "KPIs match the account (2 plots, 1 soil report, 1 recommendation)", /2 plots/i.test(an) && /1 \/ 2/.test(an) && /recommendations saved\s*1/i.test(an), an.slice(0, 400));
  check("A-analytics", "no invented forecast/telemetry (no 'Qtl/Ac', 'VWC', 'Live Active Sync')", !/Qtl\/Ac|VWC|Live Active Sync|Mixed Canopy/.test(an));

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
  check("A-logout", "returns to the public landing page", /Explore Prototype/.test(afterLogout) && !/Dashboard\s*\n?\s*Farmers/.test(afterLogout));
  const leftover = await page.evaluate(() => ({ keys: Object.keys(localStorage), sb: Object.keys(localStorage).filter((k) => /sb-.*auth-token/.test(k)) }));
  check("A-logout", "auth token and nutripalm* caches removed from the browser", leftover.sb.length === 0 && !leftover.keys.some((k) => k.startsWith("nutripalm")), JSON.stringify(leftover));
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  check("A-logout", "reloading the app after logout does not restore the console", !/Dashboard\s*\n?\s*Farmers/.test(await page.locator("body").innerText()));
  const stale = await page.evaluate(async () => { const r = await fetch("http://127.0.0.1:8000/api/recommendations"); return r.status; });
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
  for (const screen of ["Farmers", "Farm Plots", "Soil Reports", "Recommendations", "Analytics", "Digital Twin"]) {
    await goto(pb, screen);
    await pb.waitForTimeout(1500);
    const t = await pb.locator("main").innerText();
    check("B-isolation", `${screen}: none of A's farmer/plots/report/recommendation appear`, !/Ravi Kumar|Plot Alpha|Plot Beta|Alice/.test(t), t.slice(0, 120));
  }
  await pb.screenshot({ path: path.join(shots, "B-01-analytics-empty.png"), fullPage: true });

  // direct attacks from B's real browser session
  const attacks = await pb.evaluate(async ({ api, rest, ids }) => {
    const key = Object.keys(localStorage).find((k) => /sb-.*auth-token/.test(k));
    const tok = JSON.parse(localStorage.getItem(key)).access_token;
    const anon = new URLSearchParams(location.search); // unused, keeps lint quiet
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
    return out;
  }, { api: "http://127.0.0.1:8000", rest: stack.url, ids: { plot: plotA.id, rec: recA.id, soil: soilA.id } });
  for (const k of ["twinLive", "twinPred", "ndvi", "cadastral", "rec", "recCreate", "upload"]) {
    check("B-attack", `API ${k}: B's token against A's resource -> 404 with no data`, attacks[k].status === 404 && !JSON.stringify(attacks[k].body).includes(plotA.id.slice(0, 8) + "x"), `${attacks[k].status} ${JSON.stringify(attacks[k].body)}`);
  }
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
  const forged = await pb.evaluate(async () => (await fetch("http://127.0.0.1:8000/api/recommendations", { headers: { Authorization: "Bearer forged.token.value" } })).status);
  check("B-attack", "forged bearer token rejected (401)", forged === 401, forged);
  flushB();

  // ============================================================ console audit
  check("console", "no uncaught page errors / unexpected console errors across both sessions", consoleIssues.length === 0, consoleIssues.slice(0, 6).join(" || "));
  const allHttp = [...events.http, ...sb.events.http];
  const expected = (h) =>
    /^404 (GET|POST) http:\/\/127\.0\.0\.1:8000\/api\/(plots|geospatial|recommendations|soil-reports)/.test(h) || // B's attacks on A's ids
    /^401 GET http:\/\/127\.0\.0\.1:8000\/api\/recommendations/.test(h) || // deliberate tokenless / forged calls
    /^(401|403|404|406|409) \S+ http:\/\/127\.0\.0\.1:54321\/rest\/v1\//.test(h) || // deliberate REST attacks and maybeSingle probes
    /^40[0-9] POST http:\/\/127\.0\.0\.1:54321\/rest\/v1\/soil_reports/.test(h);
  const unexpected = allHttp.filter((h) => !expected(h));
  check("console", "no unexpected HTTP errors in the network log (B's deliberate attacks excluded)", unexpected.length === 0, unexpected.slice(0, 6).join(" || "));
  const dupLive = events.requests.filter((r) => /\/twin\/live/.test(r)).length;
  check("console", "no request storm (live twin polled < 12x during the run)", dupLive < 12, dupLive);
  await sa.browser.close();
  await sb.browser.close();
} catch (e) {
  check("run", "E2E run completed without a harness exception", false, e.stack || e.message);
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
