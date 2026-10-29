/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Аудит безопасности 2026-10, D-1: почта и пароль демо-аккаунта были зашиты в миграцию, тесты, скрипты и документы
 * публичного репозитория. Теперь они приходят из окружения (DEMO_EMAIL, DEMO_PASSWORD; PB_SEED_DEMO для миграции).
 * Тест красный, если зашитая пара снова появилась в файлах репозитория. Значения собраны из частей, чтобы
 * этот файл сам их не содержал.
 */
const OLD_EMAIL = ["asyaobraz17", "@gmail.com"].join("");
const OLD_PASSWORD = new RegExp(["(?<![0-9])", "1234", "5678", "(?![0-9])"].join(""));

// vitest запускается из apps/web
const root = resolve(process.cwd(), "../..");
const SKIP = new Set(["node_modules", "dist", ".git", "pb_data", "test-results", "playwright-report", ".wrangler"]);
const TEXT = /\.(ts|tsx|js|mjs|cjs|json|md|bat|ps1|sh|yml|yaml|html|css|toml)$|^\.clinerules$|^\.env\.example$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (TEXT.test(name) && st.size < 2_000_000) out.push(p);
  }
  return out;
}

describe("учётные данные демо-аккаунта не зашиты в репозиторий (D-1)", () => {
  const files = [
    ...walk(join(root, "apps/web/src")),
    ...walk(join(root, "apps/web/tests")),
    ...walk(join(root, "apps/web/scripts")),
    ...walk(join(root, "apps/web/functions")),
    ...walk(join(root, "pocketbase/pb_migrations")),
    ...walk(join(root, "pocketbase/pb_hooks")),
    ...walk(join(root, "docs")),
    ...readdirSync(root).filter((n) => TEXT.test(n)).map((n) => join(root, n)),
  ];

  it("просмотрено достаточно файлов", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("нет старой почты демо-аккаунта", () => {
    const hits = files.filter((f) => readFileSync(f, "utf8").includes(OLD_EMAIL)).map((f) => f.replace(root, ""));
    expect(hits).toEqual([]);
  });

  it("нет старого пароля демо-аккаунта", () => {
    const hits = files.filter((f) => OLD_PASSWORD.test(readFileSync(f, "utf8"))).map((f) => f.replace(root, ""));
    expect(hits).toEqual([]);
  });

  it("миграция сидов не создаёт демо-пользователя без PB_SEED_DEMO и не логирует пароль", () => {
    const src = readFileSync(join(root, "pocketbase/pb_migrations/1787043973_seed_demo.js"), "utf8");
    expect(src).toContain('$os.getenv("PB_SEED_DEMO") === "1"');
    expect(src).toContain("$security.randomString(");
    expect(src).not.toMatch(/console\.log\([^)]*password(?!\s+is not logged)[^)]*\)/i);
  });
});
