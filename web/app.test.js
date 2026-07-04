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
