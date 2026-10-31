// Kannada typography guard.
//   node e2e/kn-typography.mjs --capture   writes e2e/kn-typography-baseline.json (run on UNMODIFIED code)
//   node e2e/kn-typography.mjs --compare   re-measures and fails if ANY Kannada computed style differs
// Measures computed font-family / weight / size / line-height / letter-spacing / transform / numeric features of
// body, headings, paragraphs, buttons, labels, table cells, links and inputs on every screen this work does not
// restructure, with html[lang="kn"]. Also records the Noto Sans Kannada font-face and the Kannada CSS rule block.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startStack } from "../e2e-stack/stack.mjs";

process.env.E2E_APP_URL = "http://127.0.0.1:5193";
const { newSession, register, waitForConsole, goto, assertPortsFree } = await import("./lib.mjs");
await assertPortsFree([54341, 8020, 5193]);

const mode = process.argv.includes("--compare") ? "compare" : "capture";
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..", "..");
const baselineFile = path.join(here, "kn-typography-baseline.json");
const PY = process.env.E2E_PYTHON || "python";

const secret = crypto.randomBytes(32).toString("hex");
const stack = await startStack({ port: 54341, jwtSecret: secret, quiet: true });
const kids = [];
const run = (cmd, args, opts) => { const p = spawn(cmd, args, { ...opts, stdio: "ignore", shell: process.platform === "win32" && cmd === "npx" }); kids.push(p); };
const env = { ...process.env, SUPABASE_URL: stack.url, SUPABASE_SERVICE_ROLE_KEY: stack.serviceRoleKey, SUPABASE_JWT_SECRET: secret, CORS_ALLOW_ORIGINS: "http://127.0.0.1:5193", ENVIRONMENT: "development", SENTINEL_HUB_CLIENT_ID: "", SENTINEL_HUB_CLIENT_SECRET: "", VITE_SUPABASE_URL: stack.url, VITE_SUPABASE_ANON_KEY: stack.anonKey, VITE_API_BASE_URL: "http://127.0.0.1:8020" };
run(PY, ["-m", "uvicorn", "app.main:app", "--port", "8020"], { cwd: path.join(repo, "backend"), env });
run("npx", ["vite", "--host", "127.0.0.1", "--port", "5193", "--strictPort"], { cwd: repo, env });
const up = async (u) => { for (let i = 0; i < 80; i++) { try { if ((await fetch(u)).ok) return true; } catch {} await new Promise((r) => setTimeout(r, 500)); } return false; };
await up("http://127.0.0.1:8020/health"); await up("http://127.0.0.1:5193/");

const PROPS = ["fontFamily", "fontWeight", "fontSize", "lineHeight", "letterSpacing", "textTransform", "fontStyle", "fontVariantNumeric", "fontFeatureSettings"];
const TAGS = ["body", "h1", "h2", "h3", "h4", "p", "button", "label", "th", "td", "a", "input", "span"];
const measure = (page) => page.evaluate(({ PROPS, TAGS }) => {
  const out = { lang: document.documentElement.lang };
  for (const tag of TAGS) {
    const els = [...document.querySelectorAll(tag)].filter((e) => e.getClientRects().length > 0).slice(0, 4);
    els.forEach((e, i) => { const cs = getComputedStyle(e); out[`${tag}[${i}]`] = Object.fromEntries(PROPS.map((p) => [p, cs[p]])); });
  }
  return out;
}, { PROPS, TAGS });

const result = { screens: {}, cssRule: null, kn_json_sha256: null };
try {
  const { page } = await newSession();
  const clickLang = (name) => page.locator(".lang-toggle button, header button", { hasText: name }).first().click();
  // auth page in Kannada
  await page.goto("http://127.0.0.1:5193/");
  await page.evaluate(() => localStorage.setItem("nutripalm_lang", "kn"));
  await page.reload(); await page.waitForTimeout(1500);
  result.screens["landing"] = await measure(page);
  await page.evaluate(() => localStorage.setItem("nutripalm_lang", "en"));
  await page.reload(); await page.waitForTimeout(1200);
  await register(page, { name: "Kn Probe", email: "kn@e2e.test", password: "Passw0rd!x" });
  await waitForConsole(page);
  for (const screen of ["Dashboard", "Farmers", "Farm Plots", "Digital Twin", "Profile", "Settings"]) {
    await goto(page, screen);
    await page.evaluate(() => { localStorage.setItem("nutripalm_lang", "kn"); });
    await clickLang("ಕನ್ನಡ").catch(() => {});
    await page.waitForTimeout(900);
    result.screens[screen] = await measure(page);
    await clickLang("EN").catch(() => {});
    await page.waitForTimeout(300);
  }
  result.cssRule = readFileSync(path.join(repo, "src", "index.css"), "utf8").match(/\/\* Kannada font scope[\s\S]*?\n}\n/)?.[0] ?? null;
  result.kn_json_sha256 = crypto.createHash("sha256").update(readFileSync(path.join(repo, "src", "translation", "translations", "kn.json"))).digest("hex");
  result.notoImportPresent = /Noto\+Sans\+Kannada/.test(readFileSync(path.join(repo, "src", "index.css"), "utf8"));
  result.measuredElements = Object.values(result.screens).reduce((n, s) => n + Object.keys(s).length, 0);
} finally {
  for (const k of kids) { try { process.platform === "win32" ? spawn("taskkill", ["/PID", String(k.pid), "/T", "/F"]) : k.kill(); } catch {} }
  await stack.close();
}

if (mode === "capture") {
  writeFileSync(baselineFile, JSON.stringify(result, null, 1));
  console.log(`captured ${result.measuredElements} Kannada element style sets across ${Object.keys(result.screens).length} screens -> ${path.relative(repo, baselineFile)}`);
  console.log("kn.json sha256", result.kn_json_sha256);
  process.exit(0);
}
const base = JSON.parse(readFileSync(baselineFile, "utf8"));
const diffs = [];
for (const [screen, els] of Object.entries(base.screens)) {
  for (const [k, props] of Object.entries(els)) {
    if (k === "lang") { if (result.screens[screen]?.lang !== props) diffs.push(`${screen} html lang ${result.screens[screen]?.lang} != ${props}`); continue; }
    const now = result.screens[screen]?.[k];
    if (!now) continue; // element absent now (content changed) - only styles of matching elements are compared
    for (const p of Object.keys(props)) if (props[p] !== now[p]) diffs.push(`${screen} ${k}.${p}: "${props[p]}" -> "${now[p]}"`);
  }
}
const checks = [
  ["every measured Kannada style is identical to the pre-change baseline", diffs.length === 0, diffs.slice(0, 8).join(" | ")],
  ["the Kannada CSS rule block is byte-identical", result.cssRule === base.cssRule, "rule changed"],
  ["kn.json is byte-identical", result.kn_json_sha256 === base.kn_json_sha256, `${base.kn_json_sha256} -> ${result.kn_json_sha256}`],
  ["the Noto Sans Kannada import is still present", result.notoImportPresent === true, "import removed"],
];
let bad = 0;
for (const [name, ok, detail] of checks) { console.log(`${ok ? "PASS" : "FAIL"} [kn-typography] ${name}${ok ? "" : "  -> " + detail}`); if (!ok) bad++; }
console.log(`KN TYPOGRAPHY: ${checks.length - bad}/${checks.length} passed (${result.measuredElements} element style sets compared)`);
process.exit(bad ? 1 : 0);
