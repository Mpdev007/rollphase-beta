/**
 * Headless smoke QA for live place stack (no browser).
 * Run: node qa-smoke.mjs
 */
import { createRequire } from "module";
// places-live is browser IIFE — re-test APIs used by it

const UA = "RollPhaseQA/1.0 (https://github.com/Mpdev007/rollphase)";
const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log("PASS", name, detail);
}
function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error("FAIL", name, detail);
}

async function testNominatim() {
  const lat = 30.2672,
    lng = -97.7431;
  const dLat = 12000 / 111320;
  const dLng = 12000 / (111320 * Math.cos((lat * Math.PI) / 180));
  const viewbox = `${lng - dLng},${lat + dLat},${lng + dLng},${lat - dLat}`;
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.searchParams.set("q", "gym");
  u.searchParams.set("format", "json");
  u.searchParams.set("limit", "8");
  u.searchParams.set("viewbox", viewbox);
  u.searchParams.set("bounded", "1");
  u.searchParams.set("extratags", "1");
  const res = await fetch(u, { headers: { Accept: "application/json", "User-Agent": UA } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const rows = await res.json();
  if (rows.length < 3) throw new Error("too few " + rows.length);
  pass("nominatim-gyms", `${rows.length} near Austin`);
}

async function testGeocode() {
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.searchParams.set("q", "Miami FL");
  u.searchParams.set("format", "json");
  u.searchParams.set("limit", "1");
  const res = await fetch(u, { headers: { Accept: "application/json", "User-Agent": UA } });
  const rows = await res.json();
  if (!rows[0]) throw new Error("no geocode");
  pass("geocode-city", rows[0].display_name.slice(0, 60));
}

async function testFiles() {
  const fs = await import("fs");
  const need = [
    "app.js",
    "places-live.js",
    "mobile-shell.js",
    "update-check.js",
    "index.html",
    "version.json",
  ];
  for (const f of need) {
    if (!fs.existsSync(f)) throw new Error("missing " + f);
  }
  const app = fs.readFileSync("app.js", "utf8");
  for (const fn of [
    "loadLivePlaces",
    "bindSystemBack",
    "goBackInApp",
    "openProfileSettings",
    "closeProfileSettings",
    "applyNavEntry",
    "searchCityAndLoad",
  ]) {
    if (!app.includes(`function ${fn}`)) throw new Error("missing fn " + fn);
  }
  const pl = fs.readFileSync("places-live.js", "utf8");
  if (!pl.includes("loadLastLocation") || !pl.includes("isSecureContext")) {
    throw new Error("places-live missing hardened location");
  }
  pass("source-integrity", "files + critical functions");
}

async function main() {
  process.chdir(new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
  // Windows path fix for file URL
  try {
    await testFiles();
  } catch (e) {
    // chdir may fail on windows file URL — try cwd
    try {
      const { fileURLToPath } = await import("url");
      const path = await import("path");
      process.chdir(path.dirname(fileURLToPath(import.meta.url)));
      await testFiles();
    } catch (e2) {
      fail("source-integrity", e2.message || e.message);
    }
  }
  try {
    await testNominatim();
  } catch (e) {
    fail("nominatim-gyms", e.message);
  }
  try {
    await testGeocode();
  } catch (e) {
    fail("geocode-city", e.message);
  }
  const failed = results.filter((r) => !r.ok);
  console.log("\n=== QA summary ===");
  console.log(`${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main();
