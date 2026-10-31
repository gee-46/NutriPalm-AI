// End-to-end: the Leaflet-only farm-boundary survey (location, imagery, draw/edit, save, re-survey) in a REAL browser against an
// EMULATED Supabase (PGlite). Satellite tiles are served locally by a route (a solid-colour PNG), so the run is hermetic and can
// count exactly which hosts the app asks for imagery; the failure case aborts those requests. No real map service is contacted
// for imagery.
//
//   cd supabase/tests && npm run e2e:survey
//
// Honest scope: this drives desktop Edge (Chromium) with touch enabled and a narrowed viewport. It is NOT a test of the Android
// package (there is none in this repository yet) and it does not prove native location permission handling.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import crypto from "node:crypto";
import zlib from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startStack } from "../e2e-stack/stack.mjs";

process.env.E2E_APP_URL = "http://127.0.0.1:5253";
const lib = await import("./lib.mjs");
const { newSession, register, login, waitForConsole, goto, createFarmerUI, openSurveyor, assertPortsFree, KHAMMAM } = lib;
await assertPortsFree([54361, 8040, 5253]);

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..", "..");
const shots = process.env.E2E_SHOTS || path.join(tmpdir(), "e2e-survey-shots");
mkdirSync(shots, { recursive: true });
process.env.TEMP ??= tmpdir();

const results = [];
const check = (group, name, pass, detail = "") => {
  results.push({ pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"} [${group}] ${name}${pass ? "" : "  -> " + String(detail).slice(0, 500)}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (page, n) => page.screenshot({ path: path.join(shots, n + ".png"), fullPage: false }).catch(() => {});

// ---- a 256x256 solid PNG, so the imagery layer has real tiles to load without contacting any map service
function solidPng(r, g, b) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const x of buf) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(256, 0); ihdr.writeUInt32BE(256, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(256 * 3).map((_, i) => [r, g, b][i % 3])]);
  const raw = Buffer.concat(Array.from({ length: 256 }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const TILE = solidPng(70, 110, 60);

// ---- stack
const secret = crypto.randomBytes(32).toString("hex");
const stack = await startStack({ port: 54361, jwtSecret: secret, quiet: true });
const kids = [];
const env = { ...process.env, VITE_SUPABASE_URL: stack.url, VITE_SUPABASE_ANON_KEY: stack.anonKey, VITE_API_BASE_URL: "http://127.0.0.1:8040" };
for (const k of Object.keys(env)) if (k.startsWith("VITE_MAP_")) delete env[k]; // the development default provider, as a fresh checkout has it
// The real backend too, so the Digital Twin screen is exercised against real responses (hermetic: no Sentinel credentials)
const PY = process.env.E2E_PYTHON || "python";
kids.push(spawn(PY, ["-m", "uvicorn", "app.main:app", "--port", "8040"], {
  cwd: path.join(repo, "backend"), stdio: "ignore",
  env: { ...process.env, SUPABASE_URL: stack.url, SUPABASE_SERVICE_ROLE_KEY: stack.serviceRoleKey, SUPABASE_JWT_SECRET: secret, CORS_ALLOW_ORIGINS: "http://127.0.0.1:5253", ENVIRONMENT: "development", SENTINEL_HUB_CLIENT_ID: "", SENTINEL_HUB_CLIENT_SECRET: "" },
}));
// node directly (no npx/shell wrapper), so killing the child at the end really stops Vite and no dev server is left listening
kids.push(spawn(process.execPath, [path.join(repo, "node_modules", "vite", "bin", "vite.js"), "--host", "127.0.0.1", "--port", "5253", "--strictPort"], { cwd: repo, env, stdio: "ignore" }));
const up = async (u) => { for (let i = 0; i < 80; i++) { try { if ((await fetch(u)).ok) return true; } catch {} await wait(500); } return false; };
check("setup", "emulated stack, backend and the app are up", (await up("http://127.0.0.1:5253/")) && (await up("http://127.0.0.1:8040/health")));

// ---- tile service control: "ok" serves the local PNG, "fail" aborts like a dead network
const tiles = { mode: "ok", served: [], aborted: 0 };
async function routeTiles(ctx) {
  await ctx.route(/^https:\/\/server\.arcgisonline\.com\//, (route) => {
    const m = route.request().url().match(/\/tile\/(\d+)\/(\d+)\/(\d+)/);
    if (tiles.mode === "fail") { tiles.aborted++; return route.abort("failed"); }
    if (m) tiles.served.push({ z: +m[1], y: +m[2], x: +m[3] });
    return route.fulfill({ status: 200, contentType: "image/png", body: TILE });
  });
}
const tileXY = (lat, lng, z) => {
  const n = 2 ** z, r = (lat * Math.PI) / 180;
  return { x: Math.floor(((lng + 180) / 360) * n), y: Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n) };
};

// A controllable stand-in for the device location: "real" passes through to the browser (Playwright's emulated fix).
const GEO_SHIM = () => {
  const g = navigator.geolocation;
  if (!g) return;
  window.__geoMode = "real";
  window.__geoAcc = 20;
  const realWatch = g.watchPosition.bind(g), realClear = g.clearWatch.bind(g);
  const timers = new Map();
  let next = 9000;
  g.watchPosition = (ok, err, opts) => {
    const m = window.__geoMode;
    if (m === "real") return realWatch(ok, err, opts);
    const id = next++;
    timers.set(id, setTimeout(() => {
      if (m === "fix") ok({ coords: { latitude: 17.2473, longitude: 80.1514, accuracy: window.__geoAcc }, timestamp: Date.now() });
      else err({ code: { denied: 1, unavailable: 2, timeout: 3 }[m], message: m, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
    }, 60));
    return id;
  };
  g.clearWatch = (id) => { if (timers.has(id)) { clearTimeout(timers.get(id)); timers.delete(id); } else realClear(id); };
};
const setGeo = (page, mode, acc) => page.evaluate(([m, a]) => { window.__geoMode = m; if (a) window.__geoAcc = a; }, [mode, acc]);

const dbGet = (table, query = "select=*") => fetch(`${stack.url}/rest/v1/${table}?${query}`, { headers: { apikey: stack.serviceRoleKey, authorization: `Bearer ${stack.serviceRoleKey}` } }).then((r) => r.json());
// text / buttons of the full-screen surveyor only (the sidebar behind it has its own "Satellite ..." entries)
const surveyRoot = (page) => page.locator("xpath=//div[contains(@class,'survey-map')]/ancestor::body/*[.//div[contains(@class,'survey-map')]]").last();
// the saved plot stays selected on Farm Plots; fall back to picking it from the list if it is not
async function openResurvey(page) {
  await goto(page, "Farm Plots");
  const btn = page.getByRole("button", { name: /Re-Survey Boundary/ }).first();
  if (!(await btn.isVisible().catch(() => false))) { await page.getByText("Survey Plot A").last().click({ force: true }); await wait(1000); }
  await btn.click();
  await page.getByRole("button", { name: "Use My Current Location" }).first().waitFor({ timeout: 20000 });
}
const body = async (page) => (await page.locator("body").innerText()).replace(/[ \t]+/g, " ");
const vertices = (page) => page.locator(".survey-vertex").count();
const midpoints = (page) => page.locator(".survey-midpoint").count();
const centre = async (loc) => { const b = await loc.boundingBox(); return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height } : null; };

let exit = 0;
let A_events;
try {
  // =========================================================================================================== session A
  const A = await newSession({ permissions: ["geolocation"], geolocation: KHAMMAM, hasTouch: true });
  const { page, ctx, events } = A;
  A_events = events;
  page.setDefaultTimeout(30000);
  await routeTiles(ctx);
  await ctx.addInitScript(GEO_SHIM);
  await register(page, { name: "Survey Farmer", email: "survey@e2e.test", password: "Passw0rd!x" });
  await waitForConsole(page);
  await createFarmerUI(page, { name: "Ravi Kumar" });

  // ---------------------------------------------------------------- 1. opens on the one configured provider
  await openSurveyor(page, { plotName: "Survey Plot A", farmer: "Ravi Kumar" });
  await wait(1500);
  let t = await body(page);
  const attribution = (await page.locator(".survey-map .leaflet-control-attribution").first().innerText().catch(() => "")).replace(/\s+/g, " ");
  check("imagery", "the surveyor opens with imagery from the configured provider, loaded through its tile URL", tiles.served.length > 0, JSON.stringify(tiles));
  check("imagery", "the provider's attribution is on screen", /Esri/.test(attribution) && /Leaflet/.test(attribution), attribution);
  check("imagery", "the provider is named in the survey header, and no basemap switcher or API-key control remains", /Esri World Imagery/i.test(t) && !/API key/i.test(await surveyRoot(page).innerText()) && !(await surveyRoot(page).getByRole("button", { name: /Satellite|Street|Hybrid|OSM/i }).count()), t.slice(0, 300));
  check("imagery", "no map tile is asked for from any other host (no OSM/MapTiler/Google) and no Google Maps request is made", !A.events.requests.some((r) => /maps\.googleapis|maps\.gstatic|google\.com\/maps|khms\d|mt[0-3]\.google|openstreetmap\.org\/\d|tile\.openstreetmap|maptiler/i.test(r)), A.events.requests.filter((r) => /google|openstreetmap|maptiler/i.test(r)).join("\n"));
  check("imagery", "the Google Maps script is not on the page", !(await page.evaluate(() => !!window.google?.maps || document.querySelector("script[src*='maps.googleapis']") !== null)));
  await shot(page, "01-opened");

  // ---------------------------------------------------------------- 2. location: success, radius, centring
  // Playwright stamps its emulated fix when it is set; set it again so the position is fresh, as a real device's is.
  await ctx.setGeolocation(KHAMMAM);
  await page.getByRole("button", { name: "Use My Current Location" }).first().click();
  await page.getByText(/Accuracy radius: about 12 m/).first().waitFor({ timeout: 25000 });
  t = await body(page);
  check("location", "success shows the accuracy radius in metres", /Accuracy radius: about 12 m/.test(t), t.slice(0, 300));
  check("location", "success states that phone GPS is not survey-grade (and never claims it is)", /not survey-grade/i.test(t) && !/survey-grade accuracy achieved|survey grade accuracy/i.test(t));
  await wait(1500);
  const want = (z) => tileXY(KHAMMAM.latitude, KHAMMAM.longitude, z);
  check("location", "the map centred on the fix (tiles around the device position were requested at survey zoom)", tiles.served.some((s) => s.z >= 16 && s.x === want(s.z).x && s.y === want(s.z).y), JSON.stringify(tiles.served.slice(-6)));
  await shot(page, "02-located");

  // ---------------------------------------------------------------- 3. location: failure states and retry
  for (const [mode, re, label] of [
    ["denied", /Location permission was denied/, "denied"],
    ["unavailable", /could not work out its location/, "unavailable"],
    ["timeout", /took too long/, "timed out"],
  ]) {
    await setGeo(page, mode);
    await page.getByRole("button", { name: "Use My Current Location" }).first().click().catch(async () => { await page.getByTitle(/Refresh your current location|Refresh location/i).first().click(); });
    await page.getByText(re).first().waitFor({ timeout: 15000 }).catch(() => {});
    t = await body(page);
    check("location", `${label}: a specific message is shown, with a retry`, re.test(t) && (await page.getByRole("button", { name: "Try Again", exact: true }).count()) > 0, t.slice(0, 300));
    check("location", `${label}: the previous fix is not left on screen as if current`, !/Accuracy radius: about 12 m/.test(t));
    if (mode === "timeout") {
      await setGeo(page, "fix", 18);
      await page.getByRole("button", { name: "Try Again", exact: true }).first().click();
      await page.getByText(/Accuracy radius: about 18 m/).first().waitFor({ timeout: 15000 }).catch(() => {});
      t = await body(page);
      check("location", "retry after a failure acquires a new fix and clears the error", /Accuracy radius: about 18 m/.test(t) && (await page.getByRole("button", { name: "Try Again", exact: true }).count()) === 0, t.slice(-400));
    }
  }
  // unsupported: the API is absent -> message, no retry button
  await page.evaluate(() => Object.defineProperty(navigator, "geolocation", { value: undefined, configurable: true }));
  await page.getByTitle(/Refresh your current location|Refresh location/i).first().click().catch(() => {});
  await page.getByText(/does not provide location/).first().waitFor({ timeout: 8000 }).catch(() => {});
  t = await body(page);
  check("location", "unsupported: says so and points to searching for a village instead (retry is not offered, it cannot help)", /does not provide location/.test(t) && /village or town/.test(t) && (await page.getByRole("button", { name: "Try Again", exact: true }).count()) === 0, t.slice(0, 300));
  await page.evaluate(() => { delete navigator.geolocation; });
  await setGeo(page, "real");
  await shot(page, "03-location-errors");

  // ---------------------------------------------------------------- 4. an area that is too small is rejected with a reason
  for (let i = 0; i < 3; i++) { await page.getByTitle(/Zoom in/i).first().click(); await wait(400); }
  await wait(800);
  await page.getByRole("button", { name: "Draw Boundary" }).first().click();
  for (const [x, y] of [[640, 380], [710, 380], [710, 450], [640, 450]]) { await page.mouse.click(x, y); await wait(250); }
  await page.getByRole("button", { name: "Done Adding" }).click();
  await wait(900);
  t = await body(page);
  check("validate", "a boundary below the minimum area is rejected with the reason, and it cannot be saved", /too small/i.test(t) && (await page.getByRole("button", { name: "Confirm & Save", exact: true }).isDisabled()), t.slice(0, 300));
  check("validate", "the four corners are draggable handles with a 44px touch target", (await vertices(page)) === 4 && (await centre(page.locator(".survey-vertex").first()))?.w >= 44);

  // clear: cancel keeps it, confirm removes it
  await page.getByTitle("Clear boundary").click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await wait(400);
  check("edit", "Clear asks for confirmation; cancelling keeps the corners", (await vertices(page)) === 4);
  await page.getByTitle("Clear boundary").click();
  await page.getByRole("button", { name: /Yes, Clear/ }).click();
  await wait(500);
  check("edit", "confirming Clear removes the boundary", (await vertices(page)) === 0);
  for (let i = 0; i < 3; i++) { await page.getByTitle(/Zoom out/i).first().click(); await wait(400); }
  await wait(1000);

  // ---------------------------------------------------------------- 5. draw a real boundary, adjust it, undo
  await page.getByRole("button", { name: "Draw Boundary" }).first().click();
  for (const [x, y] of [[560, 330], [800, 340], [820, 560], [580, 580]]) { await page.mouse.click(x, y); await wait(300); }
  await page.getByRole("button", { name: "Done Adding" }).click();
  await wait(700);
  check("draw", "four clicks make four corners with a midpoint handle on each side", (await vertices(page)) === 4 && (await midpoints(page)) === 4, `${await vertices(page)}/${await midpoints(page)}`);
  t = await body(page);
  check("draw", "area and perimeter are shown live and there is no validation error", /acres|ac\b/i.test(t) && /Perimeter|m\b/.test(t) && !/too small|exceeds/i.test(t), t.slice(0, 400));
  const before = await centre(page.locator(".survey-vertex").nth(1));
  await page.mouse.move(before.x, before.y); await page.mouse.down(); await page.mouse.move(before.x + 100, before.y - 40, { steps: 8 }); await page.mouse.up();
  await wait(500);
  const after = await centre(page.locator(".survey-vertex").nth(1));
  check("edit", "dragging a corner moves it by the drag", Math.abs(after.x - (before.x + 100)) < 6 && Math.abs(after.y - (before.y - 40)) < 6, JSON.stringify({ before, after }));
  check("edit", "the corner count is unchanged by a drag", (await vertices(page)) === 4);
  await page.locator(".survey-midpoint").first().click({ force: true });
  await wait(500);
  check("edit", "tapping a midpoint inserts a corner", (await vertices(page)) === 5 && (await midpoints(page)) === 5, `${await vertices(page)}/${await midpoints(page)}`);
  await page.locator(".survey-vertex").nth(1).dblclick({ force: true });
  await wait(500);
  check("edit", "double-clicking a corner removes it (never below three)", (await vertices(page)) === 4, String(await vertices(page)));
  await page.getByTitle("Undo last point").click();
  await wait(400);
  check("edit", "Undo removes the last point", (await vertices(page)) === 3, String(await vertices(page)));
  await page.getByTitle(/Add more points/i).click();
  await page.mouse.click(600, 600);
  await wait(400);
  await page.getByRole("button", { name: "Done Adding" }).click();
  await wait(500);
  check("edit", "points can be added again after an undo", (await vertices(page)) === 4, String(await vertices(page)));
  await shot(page, "05-drawn");

  // ---------------------------------------------------------------- 6. small screen
  await page.setViewportSize({ width: 360, height: 740 });
  await wait(900);
  const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  const attrBox = await page.locator(".survey-map .leaflet-control-attribution").first().boundingBox();
  const confirmBox = await page.getByRole("button", { name: "Confirm & Save", exact: true }).boundingBox();
  check("phone", "at 360px wide the page does not scroll sideways", overflow.sw <= overflow.iw, JSON.stringify(overflow));
  check("phone", "the attribution stays inside the screen", attrBox && attrBox.x >= 0 && attrBox.x + attrBox.width <= 360 + 1, JSON.stringify(attrBox));
  check("phone", "Confirm & Save is on screen and big enough to tap", confirmBox && confirmBox.y + confirmBox.height <= 740 && confirmBox.height >= 28 && confirmBox.x >= 0 && confirmBox.x + confirmBox.width <= 360, JSON.stringify(confirmBox));
  await shot(page, "06-phone");
  await page.setViewportSize({ width: 1360, height: 900 });
  await wait(900);

  // ---------------------------------------------------------------- 7. confirm + save, then the plot exists with the boundary
  await page.getByRole("button", { name: "Confirm & Save", exact: true }).click();
  t = await body(page);
  check("save", "the confirmation shows the area and the perimeter before saving", /Total Area/i.test(t) && /Perimeter/i.test(t) && /acres/.test(t), t.slice(0, 300));
  await page.getByRole("button", { name: /Confirm & Save Boundary/ }).click();
  await wait(1500);
  await page.getByRole("button", { name: "Create Plot" }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await wait(1500);
  const plots = await dbGet("plots", "select=id,name,boundary,boundary_mapped,latitude,longitude,area");
  const plotA = plots.find((p) => p.name === "Survey Plot A");
  const ring = plotA?.boundary?.coordinates?.[0] ?? [];
  check("save", "the plot is saved with a closed GeoJSON polygon, flagged as mapped", plotA?.boundary?.type === "Polygon" && ring.length === 5 && JSON.stringify(ring[0]) === JSON.stringify(ring.at(-1)) && plotA.boundary_mapped === true, JSON.stringify(plotA).slice(0, 400));
  check("save", "the polygon is where the device fix was (near Khammam), and the centroid is stored", ring.every(([lng, lat]) => Math.abs(lat - KHAMMAM.latitude) < 0.05 && Math.abs(lng - KHAMMAM.longitude) < 0.05) && Math.abs(plotA?.latitude - KHAMMAM.latitude) < 0.05 && Math.abs(plotA?.longitude - KHAMMAM.longitude) < 0.05, JSON.stringify({ lat: plotA?.latitude, lng: plotA?.longitude }));
  check("save", "a positive area was stored", plotA?.area > 0, String(plotA?.area));

  // ---------------------------------------------------------------- 8. re-survey: reopens on the saved boundary, saves to the SAME plot
  await openResurvey(page);
  await wait(2500);
  const reopened = await vertices(page);
  check("resurvey", "reopening the survey shows the saved corners (the boundary is preserved)", reopened === ring.length - 1, `${reopened} vs ${ring.length - 1}`);
  const v0 = await centre(page.locator(".survey-vertex").first());
  await page.mouse.move(v0.x, v0.y); await page.mouse.down(); await page.mouse.move(v0.x - 30, v0.y + 30, { steps: 6 }); await page.mouse.up();
  await wait(500);
  await page.getByRole("button", { name: "Confirm & Save", exact: true }).click();
  await page.getByRole("button", { name: /Confirm & Save Boundary/ }).click();
  await wait(2500);
  const plots2 = await dbGet("plots", "select=id,name,boundary,area");
  const plotA2 = plots2.find((p) => p.name === "Survey Plot A");
  check("resurvey", "the edit is saved to the same plot (no duplicate), with a changed boundary", plots2.length === plots.length && plotA2?.id === plotA.id && JSON.stringify(plotA2.boundary) !== JSON.stringify(plotA.boundary), `${plots2.length} plots`);

  // ---------------------------------------------------------------- 9. Farm Plots overview map and Digital Twin still work on the saved plot
  await goto(page, "Farm Plots");
  await wait(2500);
  const overviewAttr = (await page.locator(".leaflet-control-attribution").first().innerText().catch(() => "")).replace(/\s+/g, " ");
  check("overview", "the Farm Plots overview map shows the saved boundary over the same single provider, with attribution", (await page.locator(".leaflet-tile-pane img").count()) > 0 && /Esri/.test(overviewAttr) && (await page.locator(".leaflet-overlay-pane path.leaflet-interactive").count()) > 0, overviewAttr);
  check("overview", "the selected plot is the one that was surveyed", /Survey Plot A/.test(await body(page)) && /Ravi Kumar/.test(await body(page)));
  await goto(page, "Digital Twin");
  await wait(3000);
  t = await body(page);
  check("twin", "Digital Twin opens with the surveyed plot available", /Survey Plot A/.test(t), t.slice(0, 300));
  await shot(page, "09-twin");

  // ---------------------------------------------------------------- 10. imagery failure: a clear error and a retry, no other provider
  tiles.mode = "fail";
  const b4 = tiles.aborted;
  await goto(page, "Farm Plots");
  const resurveyBtn = page.getByRole("button", { name: /Re-Survey Boundary/ }).first();
  if (!(await resurveyBtn.isVisible().catch(() => false))) { await page.getByText("Survey Plot A").last().click({ force: true }); await wait(1000); }
  await resurveyBtn.click();
  await surveyRoot(page).getByRole("alert").filter({ hasText: /Satellite imagery could not be loaded/ }).first().waitFor({ timeout: 30000 }).catch(() => {});
  t = await surveyRoot(page).innerText();
  check("tiles", "when the configured imagery cannot load, an error explains it (not a blank map)", /Satellite imagery could not be loaded/.test(t) && /No other map source is used/.test(t), t.slice(0, 400));
  check("tiles", "the error offers a retry", (await surveyRoot(page).getByRole("alert").getByRole("button", { name: "Try again", exact: true }).count()) === 1);
  check("tiles", "requests were attempted only against the one provider (none to a second source)", tiles.aborted > b4 && !events.requests.slice(-400).some((r) => /openstreetmap|maptiler|google|mapbox|carto/i.test(r) && /\/\d+\/\d+\/\d+/.test(r)), events.requests.filter((r) => /openstreetmap|maptiler|google|mapbox|carto/i.test(r)).slice(-5).join("\n"));
  await shot(page, "10-tiles-failed");
  tiles.mode = "ok";
  const servedBefore = tiles.served.length;
  await surveyRoot(page).getByRole("alert").getByRole("button", { name: "Try again", exact: true }).click();
  await surveyRoot(page).getByRole("alert").filter({ hasText: /Satellite imagery could not be loaded/ }).first().waitFor({ state: "detached", timeout: 20000 }).catch(() => {});
  await wait(1500);
  t = await surveyRoot(page).innerText();
  check("tiles", "Retry reloads from the same provider and the error clears when it comes back", !/Satellite imagery could not be loaded/.test(t) && tiles.served.length > servedBefore, `${tiles.served.length} vs ${servedBefore}`);
  await page.keyboard.press("Escape");
  await wait(500);

  // whole run
  check("hygiene", "no Google Maps request, script or key was used anywhere in the run", !events.requests.some((r) => /maps\.googleapis|maps\.gstatic|google\.com\/maps/i.test(r)));
  const bad = events.console.filter((c) => !/Failed to load resource|ERR_FAILED|ERR_ABORTED|ERR_CONNECTION_REFUSED|net::|React DevTools|attribute d:|fonts\.g|\[i18n\] Missing Kannada key: "p[45]\./i.test(c));
  check("hygiene", "no unexpected console errors or warnings", bad.length === 0, bad.slice(0, 4).join(" | "));
  check("hygiene", "no uncaught page errors", events.pageErrors.length === 0, events.pageErrors.slice(0, 3).join(" | "));

  // =========================================================================================================== session B: really denied
  const B = await newSession({}); // no geolocation permission granted: the browser itself refuses
  B.page.setDefaultTimeout(30000);
  await routeTiles(B.ctx);
  await login(B.page, { email: "survey@e2e.test", password: "Passw0rd!x" });
  await waitForConsole(B.page);
  await openSurveyor(B.page, { plotName: "Survey Plot B", farmer: "Ravi Kumar" });
  await B.page.getByRole("button", { name: "Use My Current Location" }).first().click();
  await B.page.getByText(/permission was denied|is blocked for this site|took too long/).first().waitFor({ timeout: 20000 }).catch(() => {});
  t = await body(B.page);
  check("denied", "with the browser's own permission refused, the farmer is told how to re-enable it (not a generic failure)", /permission was denied|is blocked for this site/.test(t) && /settings/i.test(t), t.slice(0, 400));
  check("denied", "the map and search are still usable (a manual route remains)", (await B.page.locator(".leaflet-tile-pane img").count()) > 0 && (await B.page.getByPlaceholder(/search/i).count()) > 0);
  await shot(B.page, "11-denied-real");
  await B.browser.close();
  await A.browser.close();
} catch (e) {
  exit = 1;
  console.error("FATAL", e.message);
  console.error("console:", JSON.stringify(A_events?.console?.slice(-8)), "pageErrors:", JSON.stringify(A_events?.pageErrors?.slice(-5)));
  for (const [i, p] of (globalThis.__e2ePages ?? []).entries()) await p.screenshot({ path: path.join(shots, `fatal-${i}.png`) }).catch(() => {});
} finally {
  for (const k of kids) k.kill();
  await stack.close().catch(() => {});
}
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} checks passed. Screenshots: ${shots}`);
process.exit(exit || (failed ? 1 : 0));
