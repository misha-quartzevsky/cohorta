// Склеивает макет и скриншот реализации рядом (слева макет, справа реализация).
// node scripts/b6-compare.mjs <папка со скриншотами> <куда сложить> пара ...   (пара = имя=макет.png:скриншот.png)
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [shots, out, ...pairs] = process.argv.slice(2);
const MOCKS = resolve("../../docs/design/screens-png");
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
for (const pair of pairs) {
  const [name, files] = pair.split("=");
  const [mock, shot] = files.split(":");
  const mobile = name.startsWith("m-") || name.includes("390");
  const imgH = mobile ? 900 : 760;
  const html = `<body style="margin:0;background:#fff;font-family:Inter,system-ui,sans-serif">
    <div style="display:flex;gap:24px;padding:24px;align-items:flex-start;width:max-content">
      <figure style="margin:0"><figcaption style="font:600 13px Inter,sans-serif;color:#6a6a65;margin-bottom:8px">МАКЕТ · ${mock}</figcaption><img style="max-height:${imgH}px;border:1px solid #e5e5e1" src="${pathToFileURL(resolve(MOCKS, mock)).href}"></figure>
      <figure style="margin:0"><figcaption style="font:600 13px Inter,sans-serif;color:#6a6a65;margin-bottom:8px">РЕАЛИЗАЦИЯ · ${shot}</figcaption><img style="max-height:${imgH}px;border:1px solid #e5e5e1" src="${pathToFileURL(resolve(shots, shot)).href}"></figure>
    </div></body>`;
  const p = await b.newPage({ viewport: { width: mobile ? 900 : 1900, height: 900 } });
  const tmp = resolve(out, `.${name}.html`);
  writeFileSync(tmp, html);
  await p.goto(pathToFileURL(tmp).href);
  await p.waitForLoadState("load");
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  await p.close();
}
await b.close();
