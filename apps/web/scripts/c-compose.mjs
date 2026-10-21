// Склеивает снимок макета и снимок реализации рядом (слева макет, справа реализация):
//   node scripts/c-compose.mjs <макет.png> <реализация.png> <итог.png> [подпись макета] [подпись реализации]
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import path from "node:path";

const [mock, impl, out, capL = path.basename(mock), capR = path.basename(impl)] = process.argv.slice(2);
const uri = (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
const html = `<body style="margin:0;background:#fff;font:600 13px Inter,Arial,sans-serif;color:#5a5a56">
<div style="display:flex;gap:24px;padding:20px;align-items:flex-start">
<div><div style="margin-bottom:8px">МАКЕТ · ${capL}</div><img src="${uri(mock)}" style="max-height:1100px;display:block;border:1px solid #e5e5e1"></div>
<div><div style="margin-bottom:8px">РЕАЛИЗАЦИЯ · ${capR}</div><img src="${uri(impl)}" style="max-height:1100px;display:block;border:1px solid #e5e5e1"></div>
</div></body>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 2400, height: 1200 } });
await p.setContent(html);
await p.waitForTimeout(500);
await p.screenshot({ path: out, fullPage: true });
await b.close();
