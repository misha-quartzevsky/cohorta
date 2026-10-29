/**
 * Заголовки безопасности фронтенда (аудит 2026-10, C-6 / D-8). Один источник правды:
 *  - vite.config.ts кладёт их в dist/_headers при сборке (Cloudflare Pages читает этот файл)
 *    и отдаёт из `vite preview` (так политику проверяет tests/security-csp.spec.ts);
 *  - docs/security/headers.md повторяет те же значения для nginx и Apache.
 *
 * CSP строится из адреса PocketBase (VITE_PB_URL / VITE_POCKETBASE_URL): туда уходят запросы API,
 * realtime и файлы. Пустой адрес = тот же origin (режим dev:https через прокси).
 *
 * Что намеренно разрешено и почему:
 *  - style-src 'unsafe-inline': React пишет `style="…"` у десятков компонентов (размеры, позиции, цвета),
 *    а Tiptap, Excalidraw и MathLive вставляют стили в рантайме. Скрипты при этом без 'unsafe-inline' и без 'unsafe-eval'.
 *  - script-src 'wasm-unsafe-eval': Excalidraw собирает подмножества шрифтов через WebAssembly.
 *  - img-src data: blob: : картинки из буфера обмена (data:) и предпросмотр загрузки (blob:).
 *  - media-src blob: : аудиозаписи лекций (blob: во время записи, файл с PocketBase после).
 */

const DEFAULT_PB = "http://127.0.0.1:8090";

/** Origin из адреса PocketBase; пустая строка, если адрес пуст (тот же origin). */
export function pbOrigin(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch {
    return DEFAULT_PB;
  }
}

export function contentSecurityPolicy(pbUrl: string | undefined): string {
  const pb = pbOrigin(pbUrl);
  const withPb = (...base: string[]) => [...base, ...(pb ? [pb] : [])].join(" ");
  return [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    `img-src ${withPb("'self'", "data:", "blob:")}`,
    `media-src ${withPb("'self'", "blob:")}`,
    "font-src 'self' data:",
    `connect-src ${withPb("'self'")}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** Все заголовки, которые нужно отдавать на каждой странице фронтенда. */
export function securityHeaders(pbUrl: string | undefined): Record<string, string> {
  return {
    "Content-Security-Policy": contentSecurityPolicy(pbUrl),
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "microphone=(self), camera=(), geolocation=(), payment=(), usb=()",
  };
}

/** Содержимое файла `_headers` для Cloudflare Pages. */
export function headersFile(pbUrl: string | undefined): string {
  const lines = Object.entries(securityHeaders(pbUrl)).map(([k, v]) => `  ${k}: ${v}`);
  return `/*\n${lines.join("\n")}\n`;
}
