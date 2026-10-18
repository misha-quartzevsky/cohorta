import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:5183";
const OUT = "../../docs/screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', "asyaobraz17@gmail.com");
  await page.fill('input[type="password"]', "12345678");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/s\//, { timeout: 10000 });
}

async function shot(viewport, name, pages) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await login(page);
  for (const [slug, file] of pages) {
    await page.goto(`${BASE}/s/demo/math-analysis/${slug}`);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${name}-${file}.png`, fullPage: false });
  }
  await ctx.close();
}

await shot(
  { width: 1440, height: 900 },
  "1440",
  [
    ["derivative-geometry", "editor-state1-enabled"],
    ["taylor-series", "editor-state2"],
    ["limit-of-sequence", "editor-state3"],
  ]
);

// newton-laws (301 chars, < 400) for the disabled-button variant of state 1.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await login(page);
  await page.goto(`${BASE}/s/demo/physics/newton-laws`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/1440-editor-state1-disabled.png` });
  await ctx.close();
}

await shot(
  { width: 390, height: 844 },
  "390",
  [["limit-of-sequence", "editor-state3"]]
);

await browser.close();
console.log("done");
