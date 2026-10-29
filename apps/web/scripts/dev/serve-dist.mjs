// Статический сервер для проверки собранного фронтенда вместе с заголовками из dist/_headers
// (как это сделает Cloudflare Pages): tests/security-csp.spec.ts гоняется против него.
//   node scripts/dev/serve-dist.mjs <папка сборки> [порт=5176]
// Раздаёт файлы папки, для путей без файла отдаёт index.html (SPA), к каждому ответу добавляет заголовки
// раздела «/*» из _headers. Ничего не проксирует: PocketBase приложение вызывает напрямую по VITE_PB_URL.
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";

const root = resolve(process.argv[2] ?? "dist");
const port = Number(process.argv[3] ?? 5176);
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff": "font/woff",
  ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf", ".wasm": "application/wasm", ".map": "application/json", ".txt": "text/plain",
};

/** Заголовки раздела «/*» из _headers (формат Cloudflare Pages: путь, затем строки с отступом «Имя: значение»). */
function globalHeaders() {
  const file = join(root, "_headers");
  if (!existsSync(file)) throw new Error(`нет ${file}: собери фронтенд (npm run build) или укажи другую папку`);
  const out = {};
  let inGlobal = false;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (/^\S/.test(line)) inGlobal = line.trim() === "/*";
    else if (inGlobal && line.trim()) {
      const i = line.indexOf(":");
      out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return out;
}
const headers = globalHeaders();

createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
  let file = resolve(join(root, path));
  if (!file.startsWith(root + sep) && file !== root) {
    res.writeHead(403).end();
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, "index.html");
  res.writeHead(200, { ...headers, "Content-Type": types[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-cache" });
  res.end(readFileSync(file));
}).listen(port, () => console.log(`dist ${root} на http://localhost:${port} с заголовками из _headers`));
