import { chromium } from "playwright-core";

export const EDGE = process.env.E2E_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
export const APP = process.env.E2E_APP_URL || "http://127.0.0.1:5173";

export async function newSession(opts = {}) {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, ...opts });
  const page = await ctx.newPage();
  (globalThis.__e2ePages ??= []).push(page); // lets the runner screenshot the live page if a step throws
  const events = { console: [], pageErrors: [], failed: [], http: [], requests: [] };
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") events.console.push(`${m.type()}: ${m.text()}${m.location()?.url ? " @ " + m.location().url : ""}`);
  });
  page.on("pageerror", (e) => events.pageErrors.push(e.message));
  page.on("requestfailed", (r) => events.failed.push(`${r.method()} ${r.url()} ${r.failure()?.errorText}`));
  page.on("response", (r) => { if (r.status() >= 400) events.http.push(`${r.status()} ${r.request().method()} ${r.url()}`); });
  page.on("request", (r) => events.requests.push(`${r.method()} ${r.url()}`));
  return { browser, ctx, page, events };
}

export async function openAuth(page) {
  await page.goto(APP, { waitUntil: "networkidle" });
  const explore = page.getByRole("button", { name: /Explore Prototype/ }).first();
  await explore.waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500); // landing loader
  await explore.click();
  await page.waitForSelector("input[type=password]", { timeout: 45000 });
}

export async function register(page, { name, email, password }) {
  await openAuth(page);
  await page.getByRole("button", { name: "Sign Up", exact: true }).click();
  await page.waitForTimeout(500);
  const inputs = page.locator("form input:not([type=checkbox])");
  await inputs.nth(0).fill(name);
  await inputs.nth(1).fill(email);
  await inputs.nth(2).fill(password);
  await page.getByRole("button", { name: /Create Account/ }).click();
}

export async function login(page, { email, password }) {
  await openAuth(page);
  const inputs = page.locator("form input:not([type=checkbox])");
  await inputs.nth(0).fill(email);
  await inputs.nth(1).fill(password);
  await page.getByRole("button", { name: /Launch Console/ }).click();
}

export async function waitForConsole(page) {
  await page.getByText("Dashboard", { exact: true }).first().waitFor({ timeout: 45000 });
  await page.waitForTimeout(2500);
}

// internal screen ids -> the English sidebar label the farmer sees
const NAV_LABEL = {
  "Soil Reports": "Soil",
  "Recommendations": "Nutrient & Fertilizer",
  "Digital Twin": "Satellite & Digital Twin",
  "Settings": "Settings & Language",
  "Profile": "My Profile",
  "Disease Intelligence": "Disease Intelligence",
  "Crop Suitability": "What Should I Grow?",
  "Weather": "Weather Advisory",
  "History": "Previous Reports & Advice",
};
export async function goto(page, screenId) {
  const screen = NAV_LABEL[screenId] ?? screenId;
  // exact (whitespace-tolerant) label match, so "Farm Plots" never matches "Farm"
  const label = new RegExp("^\\s*" + screen.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$");
  await page.locator("aside button", { hasText: label }).first().click();
  await page.waitForTimeout(1800);
}
export const shot = (page, name) => page.screenshot({ path: `${process.env.TEMP}/shots/${name}.png`, fullPage: true });

import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
export const stackEnv = () => JSON.parse(readFileSync(path.join(tmpdir(), "nutripalm-e2e-env.json"), "utf8"));
/** Read-only look at the database, as the service role (for assertions only). */
export async function dbGet(table, query = "select=*") {
  const e = stackEnv();
  const r = await fetch(`${e.url}/rest/v1/${table}?${query}`, { headers: { apikey: e.service, authorization: `Bearer ${e.service}` } });
  return r.json();
}

export async function createFarmerUI(page, { name, phone = "+91 90000 11111", village = "Mulki", district = "Udupi", size = "3.5" }) {
  await goto(page, "Farmers");
  await page.getByRole("button", { name: /Add Farmer/ }).first().click();
  await page.getByPlaceholder("e.g. Swaminathan Gowda").fill(name);
  await page.getByPlaceholder("e.g. +91 94401 23456").fill(phone);
  await page.getByPlaceholder("e.g. Rangampeta").fill(village);
  await page.getByPlaceholder("e.g. Dakshina Kannada").fill(district);
  await page.getByRole("button", { name: /Next Specs/ }).click();
  await page.getByPlaceholder("e.g. 10.5").fill(size);
  await page.getByRole("button", { name: /Create Farmer/ }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.waitForTimeout(800);
}

/** Wizard step 1 -> 2 -> full-screen surveyor, ready to search/draw. */
export async function openSurveyor(page, { plotName, farmer }) {
  await goto(page, "Farm Plots");
  await page.getByRole("button", { name: /Add Plot/ }).first().click();
  await page.getByPlaceholder("e.g. Swamy North Plot (Plot 2A)").fill(plotName);
  if (farmer) await page.locator("div[class*=fixed] select").first().selectOption({ label: farmer });
  await page.getByRole("button", { name: /Next Location/ }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /Open Full-Screen Map/ }).click();
  await page.getByRole("button", { name: "Use My Current Location" }).first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(2500);
}

export const KHAMMAM = { latitude: 17.2473, longitude: 80.1514, accuracy: 12 };

/** Draw a 4-vertex boundary in the surveyor, nudge one vertex, confirm, and create the plot. */
export async function surveyAndCreatePlot(page, { plotName, farmer }) {
  await openSurveyor(page, { plotName, farmer });
  await page.getByRole("button", { name: "Use My Current Location" }).first().click();
  await page.waitForTimeout(5000);
  await page.getByRole("button", { name: "Draw Boundary" }).first().click();
  for (const [x, y] of [[560, 330], [800, 340], [820, 560], [580, 580]]) { await page.mouse.click(x, y); await page.waitForTimeout(300); }
  await page.getByRole("button", { name: "Done Adding" }).click();
  await page.waitForTimeout(600);
  await page.mouse.move(800, 340); await page.mouse.down(); await page.mouse.move(900, 300, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Confirm & Save" }).click();
  await page.getByRole("button", { name: /Confirm & Save Boundary/ }).click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Create Plot" }).click();
}
