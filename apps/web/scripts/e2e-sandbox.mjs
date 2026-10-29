// Песочница для Playwright-спек: копия локальной БД + PocketBase из репозитория + демо-данные.
//
//   node scripts/e2e-sandbox.mjs            поднять песочницу (копия pocketbase/pb_data во временной папке)
//   node scripts/e2e-sandbox.mjs --stop     остановить её
//
// Что делает: копирует pocketbase/pb_data во временную папку, заводит там суперпользователя,
// запускает pocketbase serve на 127.0.0.1:8090 (или E2E_PB_PORT) с хуками и миграциями из репозитория
// (--automigrate=false, чтобы PocketBase не писал миграции в репозиторий) и прогоняет
// scripts/seed.ts (демо-пользователь, семестр demo, курсы, лекции, колода, экзамен).
// Рабочая БД и прод не затрагиваются; если на 8090 уже кто-то отвечает, скрипт останавливается.
//
// Потом:  PB_URL=http://127.0.0.1:8090 SUPER_EMAIL=e2e@local.test SUPER_PASS=E2E-pass-12345 npx playwright test
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../..");
const pbDir = join(repo, "pocketbase");
const exe = join(pbDir, process.platform === "win32" ? "pocketbase.exe" : "pocketbase");
const work = join(tmpdir(), "cohorta-e2e");
const pidFile = join(work, "pb.pid");
const PORT = process.env.E2E_PB_PORT ?? "8090";
const URL = `http://127.0.0.1:${PORT}`;
// Тест-пользователь для seed.ts и спек: почта и пароль из окружения (DEMO_EMAIL, DEMO_PASSWORD) или случайные.
// В репозитории учётных данных нет (аудит безопасности 2026-10, D-1). Значения печатаются в конце и пишутся в demo.env рядом с песочницей.
const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "demo@local.test";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? randomBytes(9).toString("base64url");
const SU_EMAIL = "e2e@local.test";
const SU_PASS = "E2E-pass-12345";

async function healthy() {
  try {
    return (await fetch(`${URL}/api/health`)).ok;
  } catch {
    return false;
  }
}

if (process.argv.includes("--stop")) {
  if (existsSync(pidFile)) {
    const pid = Number(readFileSync(pidFile, "utf8"));
    try {
      process.kill(pid);
      console.log("остановлен PocketBase песочницы, PID", pid);
    } catch (e) {
      console.log("не удалось остановить PID", pid, String(e.message ?? e));
    }
    rmSync(pidFile, { force: true });
  } else {
    console.log("PID-файла нет: песочница не запущена этим скриптом");
  }
  process.exit(0);
}

if (!existsSync(exe)) throw new Error(`нет ${exe}`);
if (await healthy()) throw new Error(`на ${URL} уже отвечает PocketBase: остановись или задай другой порт (E2E_PB_PORT), чтобы не трогать рабочую БД`);

rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
cpSync(join(pbDir, "pb_data"), join(work, "pb_data"), { recursive: true });
console.log("копия pb_data:", join(work, "pb_data"));

const common = [`--dir=${join(work, "pb_data")}`, `--hooksDir=${join(pbDir, "pb_hooks")}`, `--migrationsDir=${join(pbDir, "pb_migrations")}`, "--automigrate=false"];
const su = spawnSync(exe, ["superuser", "upsert", SU_EMAIL, SU_PASS, ...common], { encoding: "utf8" });
if (su.status !== 0) throw new Error(`суперпользователь не создан: ${su.stderr || su.stdout}`);

const child = spawn(exe, ["serve", `--http=127.0.0.1:${PORT}`, ...common], { detached: true, stdio: "ignore" });
child.unref();
writeFileSync(pidFile, String(child.pid));

for (let i = 0; i < 40 && !(await healthy()); i += 1) await new Promise((r) => setTimeout(r, 250));
if (!(await healthy())) throw new Error("PocketBase не поднялся");
console.log("PocketBase песочницы поднят, PID", child.pid);

const seed = spawnSync(process.execPath, [join(here, "seed.ts")], { env: { ...process.env, PB_URL: URL, DEMO_EMAIL, DEMO_PASSWORD }, encoding: "utf8" });
console.log(seed.stdout.trim().split("\n").slice(-3).join("\n"));
if (seed.status !== 0) throw new Error(`seed не прошёл: ${seed.stderr}`);

writeFileSync(join(work, "demo.env"), `DEMO_EMAIL=${DEMO_EMAIL}\nDEMO_PASSWORD=${DEMO_PASSWORD}\n`);
console.log(
  `\nГотово. Запуск спек:\n  PB_URL=${URL} SUPER_EMAIL=${SU_EMAIL} SUPER_PASS=${SU_PASS} DEMO_EMAIL=${DEMO_EMAIL} DEMO_PASSWORD=${DEMO_PASSWORD} npx playwright test\n` +
    `(тест-пользователь также записан в ${join(work, "demo.env")})\nОстановка: node scripts/e2e-sandbox.mjs --stop`,
);
