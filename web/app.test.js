const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "web", "index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "web", "app.js"), "utf8");

test("provides a stock selection menu instead of fixed sample stock shortcuts", () => {
  assert.match(html, /id="stockPage"/);
  assert.match(html, /id="analysisPage"/);
  assert.match(html, /id="stockTableBody"/);
  assert.doesNotMatch(html, /sampleHuatian|sampleTaiji|samplePingan/);
  assert.doesNotMatch(js, /sampleHuatian|sampleTaiji|samplePingan/);
});

test("provides a persistent dark theme toggle", () => {
  assert.match(html, /id="themeToggle"/);
  assert.match(js, /localStorage\.setItem\("adata-theme"/);
  assert.match(js, /document\.documentElement\.dataset\.theme/);
});

test("provides sector discovery from hot themes and news events", () => {
  assert.match(html, /id="hotSectorGrid"/);
  assert.match(html, /id="newsSectorGrid"/);
  assert.match(html, /id="sectorCompanyBody"/);
  assert.match(js, /const sectorThemes = /);
  assert.match(js, /sourceUrl/);
  assert.match(js, /class="source-link"/);
  assert.match(js, /function selectSector/);
  assert.match(js, /function renderSectorCompanies/);
});

test("provides local AI monitor controls and analysis flow", () => {
  assert.match(html, /id="aiMonitorStatus"/);
  assert.match(html, /id="watchBody"/);
  assert.match(html, /id="aiInsight"/);
  assert.match(js, /function startMonitor/);
  assert.match(js, /function refreshWatchlist/);
  assert.match(js, /\/api\/ai\/analyze/);
});

test("provides user-facing sector filters, prices, and AI stock recommendations", () => {
  assert.match(html, /id="sectorFilterSelect"/);
  assert.match(html, /id="maxPriceInput"/);
  assert.match(html, /id="riskFilterSelect"/);
  assert.match(html, /id="aiSectorBtn"/);
  assert.match(html, /id="recommendationBody"/);
  assert.match(html, /id="aiSectorInsight"/);
  assert.match(js, /function applyDiscoveryFilters/);
  assert.match(js, /function refreshCandidateQuotes/);
  assert.match(js, /function runAISectorScan/);
  assert.match(js, /function renderRecommendations/);
});
