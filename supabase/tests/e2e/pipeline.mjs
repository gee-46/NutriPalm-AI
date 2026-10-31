// End-to-end: soil report upload -> OCR -> review -> verified report -> recommendation -> PDF, in a REAL browser against the
// REAL backend (real Tesseract/Poppler OCR of the real lab card) and an EMULATED Supabase (PGlite). Not a managed project.
//
//   cd supabase/tests && E2E_PYTHON=... TESSERACT_CMD=... npm run e2e:pipeline
//
// The backend runs with the TEST-ONLY schedule rule pack (development mode only), so a recommendation can be produced for Oil
// Palm; Rice has no rule, so it genuinely returns insufficient_data from the backend. Nothing is mocked in the browser except
// where a check says so (network failure / expired session are injected with page.route).
import { spawn, execSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startStack } from "../e2e-stack/stack.mjs";

process.env.E2E_APP_URL = "http://127.0.0.1:5203";
const { newSession, register, waitForConsole, goto, assertPortsFree } = await import("./lib.mjs");
await assertPortsFree([54351, 8030, 5203]);

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..", "..");
const PY = process.env.E2E_PYTHON || "python";
const files = path.join(tmpdir(), "e2e-pipeline-files");
const shots = process.env.E2E_SHOTS || path.join(tmpdir(), "e2e-pipeline-shots");
mkdirSync(shots, { recursive: true });
mkdirSync(files, { recursive: true });
process.env.TEMP ??= tmpdir();
execSync(`"${PY}" "${path.join(here, "make_fixtures.py")}" "${files}"`, { cwd: path.join(repo, "backend"), stdio: "ignore", env: { ...process.env, PYTHONPATH: path.join(repo, "backend") } });
const CARD = path.join(repo, "backend", "tests", "fixtures", "P_P_Hegde_Rayee.pdf");

const results = [];
const check = (group, name, pass, detail = "") => {
  results.push({ pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"} [${group}] ${name}${pass ? "" : "  -> " + String(detail).slice(0, 400)}`);
};

const secret = crypto.randomBytes(32).toString("hex");
const stack = await startStack({ port: 54351, jwtSecret: secret, quiet: true });
const kids = [];
const run = (cmd, args, opts) => { const p = spawn(cmd, args, { ...opts, stdio: "ignore", shell: process.platform === "win32" && cmd === "npx" }); kids.push(p); };
const env = {
  ...process.env, SUPABASE_URL: stack.url, SUPABASE_SERVICE_ROLE_KEY: stack.serviceRoleKey, SUPABASE_JWT_SECRET: secret,
  CORS_ALLOW_ORIGINS: "http://127.0.0.1:5203", ENVIRONMENT: "development", RULE_PACK_PATH: path.join(files, "test_schedule_rule_pack.json"),
  SENTINEL_HUB_CLIENT_ID: "", SENTINEL_HUB_CLIENT_SECRET: "", VITE_SUPABASE_URL: stack.url, VITE_SUPABASE_ANON_KEY: stack.anonKey, VITE_API_BASE_URL: "http://127.0.0.1:8030",
};
run(PY, ["-m", "uvicorn", "app.main:app", "--port", "8030"], { cwd: path.join(repo, "backend"), env });
run("npx", ["vite", "--host", "127.0.0.1", "--port", "5203", "--strictPort"], { cwd: repo, env });
const up = async (u) => { for (let i = 0; i < 80; i++) { try { if ((await fetch(u)).ok) return true; } catch {} await new Promise((r) => setTimeout(r, 500)); } return false; };
check("setup", "backend and frontend are up", (await up("http://127.0.0.1:8030/health")) && (await up("http://127.0.0.1:5203/")));

const rest = (t, q = "select=*", init = {}) => fetch(`${stack.url}/rest/v1/${t}?${q}`, { ...init, headers: { apikey: stack.serviceRoleKey, authorization: `Bearer ${stack.serviceRoleKey}`, "content-type": "application/json", prefer: "return=representation", ...(init.headers || {}) } }).then((r) => r.json());
const pdfText = async (download, name) => { const f = path.join(shots, name); await download.saveAs(f); return { file: f, text: execSync(`pdftotext -layout "${f}" -`, { encoding: "utf8" }), bytes: readFileSync(f) }; };
const body = async (page) => (await page.locator("body").innerText()).replace(/[ \t]+/g, " ");
const shot = (page, n) => page.screenshot({ path: path.join(shots, n + ".png"), fullPage: true }).catch(() => {});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let exit = 0;

try {
  const { page, events } = await newSession();
  page.setDefaultTimeout(45000);
  await register(page, { name: "Pipeline Farmer", email: "pipe@e2e.test", password: "Passw0rd!x" });
  await waitForConsole(page);
  const uid = (await rest("profiles"))[0].id;
  const y = new Date().getUTCFullYear() - 5;
  const [OIL, RICE] = await rest("plots", "select=*", { method: "POST", body: JSON.stringify([
    { owner_id: uid, name: "Oil Palm Plot", crop: "Oil Palm", area: 2, area_unit: "hectare", planting_date: `${y}-01-01`, plant_count: 300, state: "Karnataka", latitude: 13, longitude: 75 },
    { owner_id: uid, name: "Rice Plot", crop: "Rice", area: 1, area_unit: "hectare", latitude: 13.1, longitude: 75.1 },
  ]) });
  // Records from before the verified workflow: kept in the database, must stay visible but never be used as advice.
  const [legacySoil] = await rest("soil_reports", "select=*", { method: "POST", body: JSON.stringify([{ owner_id: uid, plot_id: OIL.id, nitrogen_kg_ha: 99, phosphorus_kg_ha: 9, potassium_kg_ha: 99, organic_carbon_percent: 0.3, ph: 6, verification_status: null }]) });
  await rest("recommendations", "select=*", { method: "POST", body: JSON.stringify([{ owner_id: uid, plot_id: OIL.id, soil_report_id: legacySoil.id, crop: "oil_palm", deficiencies: [], fertilizer_plan: [{ product_display_name: "LEGACY-PRODUCT", quantity_kg_per_ha: 1 }], yield_prediction: {}, roi: {}, explanation: { summary: "LEGACY-SUMMARY" }, status: "generated" }]) });
  await page.reload(); await waitForConsole(page);
  const plotSel = (p) => p.locator("#nf-plot");

  // ------------------------------------------------------------- 1. Recommendations before any verified report
  await goto(page, "Recommendations");
  let t = await body(page);
  check("no-report", "opening Recommendations with no verified report explains it and offers Soil Reports (no automatic redirect)", /no verified soil report|No soil report|Upload/i.test(t) && /Nutrient & Fertilizer Advice/.test(t), t.slice(0, 300));
  check("no-report", "the earlier (unverified) report is NOT used: its values are not shown", !t.includes("99") || !/Nitrogen[^\n]*99/.test(t));
  check("no-report", "earlier records stay visible on the plot, but not as advice", /Earlier records for this plot/.test(t) && !t.includes("LEGACY-SUMMARY") && !t.includes("LEGACY-PRODUCT"), t.slice(0, 600));

  // ------------------------------------------------------------- 2. Soil Reports: a network failure is shown, with a retry that works
  await goto(page, "Soil Reports");
  check("context", "Soil Reports opens the same plot Recommendations was showing", (await page.locator("select").first().inputValue()) === OIL.id);
  await page.route("**/api/soil-reports/upload", (r) => r.abort());
  await page.locator("input[type=file]").setInputFiles(CARD);
  await page.waitForSelector("text=Could not reach the NutriPalm server");
  t = await body(page);
  check("failure", "an unreachable API shows a clear message, the file name and a retry (not a silent return to the dropzone)", /could not be read/.test(t) && /Try Hegde|Try P_P_Hegde_Rayee\.pdf again/.test(t) && /Choose another file/.test(t), t.slice(0, 400));
  check("failure", "nothing was saved by the failed attempt", (await rest("soil_report_extractions")).length === 0 && (await rest("soil_reports", "select=id&verification_status=not.is.null")).length === 0);
  await page.unroute("**/api/soil-reports/upload");
  await shot(page, "01-upload-failed");

  // expired session
  await page.route("**/api/soil-reports/upload", (r) => r.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ detail: "Invalid token" }) }));
  await page.getByRole("button", { name: /Choose another file/ }).click().catch(() => {});
  await page.locator("input[type=file]").setInputFiles({ name: "x.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 x") });
  await page.waitForSelector("text=Your session has expired");
  check("failure", "an expired session says so", /Your session has expired\. Please sign in again\./.test(await body(page)));
  await page.unroute("**/api/soil-reports/upload");

  // corrupt file -> backend status 'failed'
  await page.locator("input[type=file]").setInputFiles({ name: "broken.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 truncated nonsense") });
  await page.getByRole("button", { name: /Try broken\.pdf again/ }).waitFor({ timeout: 60000 }); // the retry names THIS file, so it is this attempt's panel
  t = await body(page);
  check("failure", "an unreadable file is reported with a retry, and creates nothing", /broken\.pdf/.test(t) && (await rest("soil_reports", "select=id&verification_status=not.is.null")).length === 0, t.slice(0, 300));

  // ------------------------------------------------------------- 3. real card: needs_review -> confirm -> verified
  await page.locator("input[type=file]").setInputFiles(CARD);
  await page.waitForSelector("#review-title", { timeout: 90000 });
  const ext = await rest("soil_report_extractions");
  check("review", "the real lab card is stored as an extraction waiting for review - not as a soil report", ext.length >= 1 && ext.at(-1).status === "needs_review" && (await rest("soil_reports", "select=id&verification_status=not.is.null")).length === 0);
  t = await body(page);
  check("review", "the review shows the values as read, with units and the source line", /211 kg\/ha/.test(t) && /23\.46 kg\/ha/.test(t) && /Page 1/.test(t), t.slice(0, 500));
  await shot(page, "02-review");

  // leave and come back: the pending extraction is offered again
  await goto(page, "Dashboard");
  await goto(page, "Soil Reports");
  await page.waitForSelector("text=waiting for your check");
  check("review", "after leaving and coming back, the waiting review is offered again (and is not shown as a verified report)", !/AI Diagnostic Complete/.test(await body(page)));
  await page.getByRole("button", { name: /Continue checking/ }).click();
  await page.waitForSelector("#review-title");
  const boxes = page.locator("section[aria-labelledby=review-title] input[type=checkbox]");
  for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).check();
  await page.getByRole("button", { name: /confirm|save/i }).first().click();
  await page.waitForSelector("text=AI Diagnostic Complete", { timeout: 60000 });
  const soil = (await rest("soil_reports", "select=*&verification_status=not.is.null"))[0];
  t = await body(page);
  check("verified", "a verified soil report exists, linked to its extraction and to the selected plot", !!soil && soil.plot_id === OIL.id && !!soil.extraction_id && ["user_confirmed", "user_corrected"].includes(soil.verification_status), JSON.stringify(soil));
  check("verified", "the screen shows exactly the values saved in the database", t.includes(`${soil.nitrogen_kg_ha} kg/ha`) && t.includes(`${soil.phosphorus_kg_ha} kg/ha`) && t.includes(`${soil.potassium_kg_ha} kg/ha`), t.slice(0, 500));
  check("verified", "'as read' details (unit printed on the report, status) are shown and survive", /As read from your laboratory report/.test(t) && /kg\/ha/.test(t));
  await shot(page, "03-verified-results");

  // ------------------------------------------------------------- 4. the action carries plot + report into Recommendations
  await page.getByRole("button", { name: /Generate AI Recommendation/i }).first().click();
  await page.waitForSelector("#nf-plot");
  await page.waitForSelector("text=What your soil report says");
  check("context", "Generate takes the farmer straight to Recommendations on the SAME plot, showing the verified values", (await plotSel(page).inputValue()) === OIL.id && (await body(page)).includes(`${soil.potassium_kg_ha}`));
  const reqs = events.requests.filter((r) => /POST .*\/api\/recommendations$/.test(r));
  await page.getByRole("button", { name: /Get advice/ }).click();
  await page.waitForSelector("text=Fertilizer to apply", { timeout: 60000 });
  const rec = (await rest("recommendations", "select=*&engine_version=not.is.null"))[0];
  check("recommend", "the backend generated and saved a recommendation for the verified report id", !!rec && rec.soil_report_id === soil.id && rec.plot_id === OIL.id && rec.engine_version === "rec-2.2", JSON.stringify(rec)?.slice(0, 300));
  check("recommend", "the browser asked the backend (authenticated); it did not compute doses itself", events.requests.filter((r) => /POST .*\/api\/recommendations$/.test(r)).length === reqs.length + 1);
  t = await body(page);
  check("recommend", "the plan, the schedule arithmetic and the citation are displayed", /Muriate of Potash/.test(t) && /Di-Ammonium Phosphate/.test(t) && /Dose per palm/.test(t) && /Basis of this recommendation/.test(t), t.slice(0, 500));
  await shot(page, "04-recommendation");

  // ------------------------------------------------------------- 5. PDF
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /PDF/ }).filter({ hasNotText: /assessment/i }).first().click()]);
  const pdf = await pdfText(dl, "recommendation.pdf");
  const mop = rec.fertilizer_plan.find((d) => d.product_code === "mop"), dap = rec.fertilizer_plan.find((d) => d.product_code === "dap");
  check("pdf", "the download is a real PDF with a safe, dated filename", pdf.bytes.subarray(0, 5).toString() === "%PDF-" && /^NutriPalm_Recommendation_Oil_Palm_Plot_\d{4}-\d{2}-\d{2}\.pdf$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  const flat = pdf.text.replace(/\s+/g, " ");
  check("pdf", "it names the plot, crop, farmer, engine and rule version", /Oil Palm Plot/.test(flat) && /oil palm/i.test(flat) && /Pipeline Farmer/.test(flat) && /rec-2\.2/.test(flat) && /e2e-schedule-fixture/.test(flat), flat.slice(0, 400));
  check("pdf", "it prints the verified soil values used", flat.includes(String(soil.nitrogen_kg_ha)) && flat.includes(String(soil.phosphorus_kg_ha)) && flat.includes(String(soil.potassium_kg_ha)), flat.slice(0, 600));
  const fmt = (n) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  check("pdf", "its fertilizer quantities equal the saved recommendation (the one on screen)", flat.includes(fmt(mop.quantity_kg_per_ha)) && flat.includes(fmt(dap.quantity_kg_per_ha)) && flat.includes(fmt(mop.quantity_kg_total)), `${fmt(mop.quantity_kg_per_ha)} ${fmt(dap.quantity_kg_per_ha)} in ${flat.slice(0, 900)}`);
  check("pdf", "it carries the citation, assumptions, and says it is advice, not an application", /Source/.test(flat) && /Assumptions/.test(flat) && /not a record of fertilizer applied/i.test(flat));

  // ------------------------------------------------------------- 6. refresh keeps everything
  await page.reload(); await waitForConsole(page);
  await goto(page, "Recommendations");
  await page.waitForSelector("text=Fertilizer to apply", { timeout: 30000 });
  check("refresh", "after a full refresh the same plot, soil report and recommendation are shown", (await plotSel(page).inputValue()) === OIL.id && /Muriate of Potash/.test(await body(page)));
  check("refresh", "earlier records remain visible but are not advice", /Earlier records for this plot/.test(await body(page)) && !(await body(page)).includes("LEGACY-SUMMARY"));

  // ------------------------------------------------------------- 7. another plot never shows this plot's data
  await plotSel(page).selectOption(RICE.id);
  await page.waitForTimeout(1500);
  t = await body(page);
  check("isolation", "switching to the Rice plot shows no soil report and no recommendation of the Oil Palm plot", !t.includes(String(soil.potassium_kg_ha)) && !/Muriate of Potash/.test(t) && !/Earlier records/.test(t) && /Rice/.test(t), t.slice(0, 500));
  await goto(page, "Soil Reports");
  check("context", "navigating by the sidebar keeps the Rice plot selected on Soil Reports", (await page.locator("select").first().inputValue()) === RICE.id);

  // ------------------------------------------------------------- 8. verified, but no approved rule -> insufficient_data (the backend decides)
  await page.locator("input[type=file]").setInputFiles(CARD);
  await page.waitForSelector("#review-title", { timeout: 90000 });
  const boxes2 = page.locator("section[aria-labelledby=review-title] input[type=checkbox]");
  for (let i = 0; i < (await boxes2.count()); i++) await boxes2.nth(i).check();
  await page.getByRole("button", { name: /confirm|save/i }).first().click();
  await page.waitForSelector("text=AI Diagnostic Complete", { timeout: 60000 });
  await goto(page, "Recommendations"); // sidebar, not the button: the plot must still be Rice
  await page.waitForSelector("text=What your soil report says");
  check("context", "Recommendations (sidebar) opens the Rice plot the report was just uploaded for, with its verified values", (await plotSel(page).inputValue()) === RICE.id);
  await page.getByRole("button", { name: /Get advice/ }).click();
  await page.waitForSelector("text=No recommendation can be given yet");
  t = await body(page);
  check("insufficient", "the backend's insufficient_data is explained with the reason and what is needed, on the same screen", /No agronomist-verified, cited nutrient rule is installed for 'Rice'/.test(t) && /What is needed/.test(t), t.slice(0, 600));
  check("insufficient", "the verified soil values stay visible, no dose is invented, and there is no redirect back to the upload screen", /What your soil report says/.test(t) && !/Fertilizer to apply/.test(t) && !/Drag & drop/.test(t));
  check("insufficient", "nothing was saved as a recommendation for Rice", (await rest("recommendations", `select=id&plot_id=eq.${RICE.id}`)).length === 0);
  await shot(page, "05-insufficient");
  const [dl2] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /soil assessment/i }).first().click()]);
  const pdf2 = await pdfText(dl2, "assessment.pdf");
  const flat2 = pdf2.text.replace(/\s+/g, " ");
  check("pdf", "the status report downloads, lists the measured values and the reasons, and contains no fertilizer quantity", pdf2.bytes.subarray(0, 5).toString() === "%PDF-" && /Soil Assessment Status Report/.test(flat2) && /No fertilizer recommendation has been issued/.test(flat2) && /cited nutrient rule is installed for 'Rice'/.test(flat2) && !/Fertilizer plan|kg per ha/.test(flat2) && /Rice Plot/.test(flat2) && /NutriPalm_Soil_Assessment_Rice_Plot_/.test(dl2.suggestedFilename()), flat2.slice(0, 500));

  // ------------------------------------------------------------- 9. typography: English is redesigned, Kannada is not
  const fontInfo = await page.evaluate(async () => {
    await document.fonts.ready;
    const cs = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e) : null; };
    return {
      lang: document.documentElement.lang,
      body: cs("body")?.fontFamily, h1: cs("h1")?.fontFamily, h2: cs("h2")?.fontFamily, td: cs("td")?.fontVariantNumeric,
      loadedUI: document.fonts.check('500 16px "Instrument Sans Variable"'), loadedDisplay: document.fonts.check('400 24px "EB Garamond"'),
      geistUsed: [...document.querySelectorAll("body *")].filter((e) => e.getClientRects().length && /Geist/.test(getComputedStyle(e).fontFamily.split(",")[0])).slice(0, 5).map((e) => `${e.tagName.toLowerCase()}.${String(e.className?.baseVal ?? e.className).slice(0, 60)} "${(e.textContent || "").trim().slice(0, 20)}"`),
      maxWeight: Math.max(...[...document.querySelectorAll("body *")].filter((e) => e.children.length === 0 && e.textContent.trim()).map((e) => Number(getComputedStyle(e).fontWeight))),
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  check("typography-en", "English body uses Instrument Sans and page titles use EB Garamond (not Geist)", fontInfo.lang === "en" && /Instrument Sans/.test(fontInfo.body) && /EB Garamond/.test(fontInfo.h1 || fontInfo.h2) && fontInfo.geistUsed.length === 0, JSON.stringify(fontInfo.geistUsed) + " " + JSON.stringify(fontInfo).slice(0, 300));
  check("typography-en", "the new fonts actually loaded (self-hosted), tables use tabular figures, and no weight above 600 is used", fontInfo.loadedUI && fontInfo.loadedDisplay && /tabular-nums/.test(fontInfo.td || "tabular-nums") && fontInfo.maxWeight <= 600, JSON.stringify(fontInfo));
  check("typography-en", "English pages made no request to Google's font files", !events.requests.some((r) => /fonts\.gstatic\.com\/s\/(geist|notosanskannada)/i.test(r)), events.requests.filter((r) => /gstatic/.test(r)).join(" | "));

  await page.getByRole("button", { name: "Switch to Kannada" }).click();
  await page.waitForTimeout(1500);
  const kn = await page.evaluate(async () => { await document.fonts.ready; return { lang: document.documentElement.lang, body: getComputedStyle(document.body).fontFamily, h1: getComputedStyle(document.querySelector("h1") || document.body).fontFamily, text: document.body.innerText.slice(0, 200), overflowX: document.documentElement.scrollWidth - window.innerWidth }; });
  check("typography-kn", "Kannada still uses Noto Sans Kannada then Geist, exactly as before", kn.lang === "kn" && /^"Noto Sans Kannada", Geist/.test(kn.body) && /^"Noto Sans Kannada", Geist/.test(kn.h1) && !/Instrument|Garamond/.test(kn.body + kn.h1), JSON.stringify(kn));
  check("typography-kn", "the Kannada Recommendations screen renders without horizontal overflow", /[ಀ-೿]/.test(kn.text) && kn.overflowX <= 1, JSON.stringify(kn));
  await shot(page, "06-kannada-recommendations");
  await page.getByRole("button", { name: /Switch to English/ }).click();
  await page.waitForTimeout(800);

  // ------------------------------------------------------------- 10. mobile width
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [screen, label] of [["Soil Reports", "soil"], ["Recommendations", "recommendations"]]) {
    await page.evaluate(() => document.querySelector("aside")?.classList.add("hidden"));
    await goto(page, screen).catch(async () => { await page.locator("button[aria-label*='enu']").first().click().catch(() => {}); });
    await page.waitForTimeout(1500);
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check("mobile", `${label} screen has no horizontal page scroll at 390px`, ov <= 1, `overflow ${ov}px`);
    await shot(page, `07-mobile-${label}`);
  }
  await page.setViewportSize({ width: 1360, height: 900 });

  // ------------------------------------------------------------- 11. logged out / API surface
  const anon = await fetch("http://127.0.0.1:8030/api/recommendations");
  check("auth", "the recommendations API refuses a request without a token (401)", anon.status === 401);
  const bad = events.console.filter((c) => !/status of (4\d\d) .* @ http:\/\/127\.0\.0\.1:8030\/api\/|ERR_FAILED|ERR_ABORTED|net::|Failed to load resource|React DevTools|attribute d:|Failed to load|fonts\.g|\[i18n\] Missing Kannada key: "p4\./i.test(c)); // p4.* = new English-only strings awaiting a native Kannada translation (kn.json is frozen)
  check("console", "no unexpected browser console errors or page errors", bad.length === 0 && events.pageErrors.length === 0, bad.concat(events.pageErrors).join(" | "));
} catch (e) {
  check("script", "completed without an exception", false, e.stack || e.message);
  for (const pg of globalThis.__e2ePages ?? []) await pg.screenshot({ path: path.join(shots, "FAILURE.png"), fullPage: true }).catch(() => {});
  exit = 1;
} finally {
  for (const k of kids) { try { process.platform === "win32" ? spawn("taskkill", ["/PID", String(k.pid), "/T", "/F"]) : k.kill(); } catch {} }
  await stack.close();
}
const failed = results.filter((r) => !r.pass).length;
console.log(`\nPIPELINE E2E: ${results.length - failed}/${results.length} passed${failed ? `, ${failed} FAILED` : ""}  (screenshots: ${shots})`);
process.exit(failed || exit ? 1 : 0);
