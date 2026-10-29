// Проверка накатки на прод-подобную базу: пустая БД, миграции только до 1790002000 (так отстаёт прод) и сид,
// затем все остальные миграции из репозитория и хуки. Прод и порт 8090 не затрагиваются.
//
//   node scripts/prod-like-check.mjs            порт PRODLIKE_PORT (по умолчанию 8093), папка во временном каталоге
//
// Что проверяет:
//  1. этап «прод»: PocketBase поднимается на миграциях ≤ 1790002000 без хуков, сид-миграция не создала демо-пользователя
//     (нет PB_SEED_DEMO), seed.ts создаёт данные с DEMO_EMAIL/DEMO_PASSWORD из окружения;
//  2. накатка: PocketBase поднимается на полном наборе миграций и хуков, применены все файлы;
//  3. хуки лежат так, как требует runbook (14 файлов + referral), а groups_access.pb.js, group_access.pb.js,
//     exam_groups.pb.js, lib_exam.js отсутствуют;
//  4. ключевые правила волны 1 на месте (users.deleteRule = null, запрет полей премиума, без search).
// Дальше на этой же базе гоняются security-*.spec.ts и серверные group-спеки (PB_URL на этот порт).
//  5. с ключом --down: `migrate down` для миграций волны 1 (1790013000…) возвращает правила и параметры полей ТОЧНО к состоянию
//     до них (снимок всех коллекций до и после совпадает); в этом режиме PocketBase в конце останавливается.
// Остановка: node scripts/prod-like-check.mjs --stop
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../..");
const pbDir = join(repo, "pocketbase");
const exe = join(pbDir, process.platform === "win32" ? "pocketbase.exe" : "pocketbase");
const work = join(tmpdir(), "cohorta-prodlike");
const pidFile = join(work, "pb.pid");
const PORT = process.env.PRODLIKE_PORT ?? "8093";
if (PORT === "8090") throw new Error("порт 8090 занят PocketBase владелицы");
const URL = `http://127.0.0.1:${PORT}`;
const SU_EMAIL = "e2e@local.test";
const SU_PASS = process.env.SUPER_PASS ?? "E2E-pass-12345";
const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "demo@local.test";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? randomBytes(9).toString("base64url");
const LAST_PROD_MIGRATION = 1790002000;
const FIRST_WAVE1_MIGRATION = 1790013000;
const DOWN = process.argv.includes("--down");

const RUNBOOK_HOOKS = [
  "lib_db.js", "lib_groups.js", "lib_previews.js", "lib_trash.js", "lib_exam_pok.js", "groups_manage.pb.js", "groups_join.pb.js",
  "lecture_sharing.pb.js", "exam_subgroups.pb.js", "exam_tickets.pb.js", "exam_pok.pb.js", "lecture_previews.pb.js", "trash.pb.js",
  "account_deletion.pb.js",
];
const ALREADY_ON_PROD = ["lib_referral.js", "referral.pb.js"]; // стоят на проде с миграции 1787620000
const MUST_BE_ABSENT = ["groups_access.pb.js", "group_access.pb.js", "exam_groups.pb.js", "lib_exam.js"];

let failed = 0;
const check = (ok, text) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${text}`);
  if (!ok) failed += 1;
};

async function healthy() {
  try {
    return (await fetch(`${URL}/api/health`)).ok;
  } catch {
    return false;
  }
}

function stop() {
  if (!existsSync(pidFile)) return;
  const pid = Number(readFileSync(pidFile, "utf8"));
  try {
    process.kill(pid);
  } catch {
    /* уже остановлен */
  }
  rmSync(pidFile, { force: true });
}

if (process.argv.includes("--stop")) {
  stop();
  console.log("остановлен");
  process.exit(0);
}

if (!existsSync(exe)) throw new Error(`нет ${exe}`);
if (await healthy()) throw new Error(`на ${URL} уже отвечает PocketBase: остановись или задай другой PRODLIKE_PORT`);

async function start(migrationsDir, hooksDir, env = {}) {
  const common = [`--dir=${join(work, "pb_data")}`, `--hooksDir=${hooksDir}`, `--migrationsDir=${migrationsDir}`, "--automigrate=false"];
  const su = spawnSync(exe, ["superuser", "upsert", SU_EMAIL, SU_PASS, ...common], { encoding: "utf8", env: { ...process.env, ...env } });
  if (su.status !== 0) throw new Error(`суперпользователь не создан: ${su.stderr || su.stdout}`);
  const log = join(work, `pb-${Date.now()}.log`);
  const child = spawn(exe, ["serve", `--http=127.0.0.1:${PORT}`, ...common], { detached: true, stdio: ["ignore", "ignore", "ignore"], env: { ...process.env, ...env } });
  child.unref();
  writeFileSync(pidFile, String(child.pid));
  for (let i = 0; i < 80 && !(await healthy()); i += 1) await new Promise((r) => setTimeout(r, 250));
  void log;
  return await healthy();
}

async function superToken() {
  const r = await fetch(`${URL}/api/collections/_superusers/auth-with-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identity: SU_EMAIL, password: SU_PASS }),
  });
  return (await r.json()).token;
}
const getJson = async (path, token) => (await fetch(`${URL}${path}`, { headers: token ? { Authorization: token } : {} })).json();

rmSync(work, { recursive: true, force: true });
mkdirSync(join(work, "pb_data"), { recursive: true });

// ---- этап 1: «прод» = миграции до 1790002000, без хуков ------------------------------------------------
const oldMig = join(work, "migrations-prod");
const noHooks = join(work, "hooks-none");
mkdirSync(oldMig, { recursive: true });
mkdirSync(noHooks, { recursive: true });
const allMigrations = readdirSync(join(pbDir, "pb_migrations")).filter((f) => f.endsWith(".js")).sort();
const prodMigrations = allMigrations.filter((f) => Number(f.split("_")[0]) <= LAST_PROD_MIGRATION);
for (const f of prodMigrations) cpSync(join(pbDir, "pb_migrations", f), join(oldMig, f));
console.log(`этап 1: миграций до ${LAST_PROD_MIGRATION}: ${prodMigrations.length} из ${allMigrations.length}`);

check(await start(oldMig, noHooks), "PocketBase поднялся на миграциях прода (≤ 1790002000)");
let token = await superToken();
let users = (await getJson("/api/collections/users/records?perPage=50", token)).items ?? [];
check(users.length === 0, "сид-миграция не создала демо-пользователя без PB_SEED_DEMO");

const seed = spawnSync(process.execPath, [join(here, "seed.ts")], { env: { ...process.env, PB_URL: URL, DEMO_EMAIL, DEMO_PASSWORD }, encoding: "utf8" });
check(seed.status === 0, `seed.ts выполнен (демо-пользователь из окружения): ${seed.status === 0 ? seed.stdout.trim().split("\n").pop() : seed.stderr.slice(0, 200)}`);
users = (await getJson("/api/collections/users/records?perPage=50", token)).items ?? [];
check(users.some((u) => u.email === DEMO_EMAIL), "демо-пользователь создан сидом с почтой из окружения");
stop();
await new Promise((r) => setTimeout(r, 800));

// ---- снимок до волны 1: все миграции ДО 1790013000 (для проверки down) ----------------------------------------------
let beforeWave1 = null;
const preWave1Dir = join(work, "migrations-pre-wave1");
if (DOWN) {
  mkdirSync(preWave1Dir, { recursive: true });
  for (const f of allMigrations.filter((x) => Number(x.split("_")[0]) < FIRST_WAVE1_MIGRATION)) cpSync(join(pbDir, "pb_migrations", f), join(preWave1Dir, f));
  check(await start(preWave1Dir, noHooks), "поднялась база до волны 1 (миграции < 1790013000)");
  beforeWave1 = (await getJson("/api/collections?perPage=200", await superToken())).items;
  stop();
  await new Promise((r) => setTimeout(r, 800));
}

// ---- этап 2: накатка всех остальных миграций + хуки репозитория --------------------------------------------
const hooksFiles = readdirSync(join(pbDir, "pb_hooks")).filter((f) => f.endsWith(".js"));
for (const f of RUNBOOK_HOOKS) check(hooksFiles.includes(f), `хук по runbook на месте: ${f}`);
for (const f of ALREADY_ON_PROD) check(hooksFiles.includes(f), `хук, уже стоящий на проде: ${f}`);
for (const f of MUST_BE_ABSENT) check(!hooksFiles.includes(f), `старый файл отсутствует: ${f}`);
const extra = hooksFiles.filter((f) => !RUNBOOK_HOOKS.includes(f) && !ALREADY_ON_PROD.includes(f));
check(extra.length === 0, `в pb_hooks нет лишних файлов${extra.length ? `: ${extra.join(", ")}` : ""}`);

const up = await start(join(pbDir, "pb_migrations"), join(pbDir, "pb_hooks"));
check(up, "PocketBase поднялся на всех миграциях и хуках репозитория (маршруты не задвоены)");
if (up) {
  token = await superToken();
  const applied = new Set();
  const mig = await getJson("/api/collections/_migrations/records?perPage=500", token).catch(() => null);
  void mig;
  const cols = (await getJson("/api/collections?perPage=200", token)).items ?? [];
  const col = (n) => cols.find((c) => c.name === n);
  check(Boolean(col("lecture_previews")) && Boolean(col("exam_subgroups")) && Boolean(col("access_requests")), "таблицы волны C созданы (previews, подгруппы, запросы доступа)");
  check(col("users")?.deleteRule === null, "users.deleteRule = null");
  check(String(col("users")?.updateRule).includes("premium_until:isset = false"), "users.updateRule запрещает premium_until");
  check(col("deletion_requests")?.createRule === null, "deletion_requests.createRule = null");
  check(String(col("quizzes")?.updateRule).includes("lecture:isset = false"), "quizzes.updateRule запрещает смену lecture");
  check(col("exams")?.fields.find((f) => f.name === "group")?.cascadeDelete === false, "exams.group без каскадного удаления");
  check(col("lectures")?.fields.find((f) => f.name === "file")?.mimeTypes.length > 0, "lectures.file ограничен по типам");
  const search = await fetch(`${URL}/api/groups/search?q=a`, { headers: { Authorization: token } });
  check(search.status === 404, "маршрута /api/groups/search нет");
  void applied;
  console.log(`\nПрод-подобная база поднята: ${URL}\n  PB_URL=${URL} SUPER_EMAIL=${SU_EMAIL} SUPER_PASS=${SU_PASS} DEMO_EMAIL=${DEMO_EMAIL} DEMO_PASSWORD=${DEMO_PASSWORD} npx playwright test tests/security-*.spec.ts ...\n  Остановка: node scripts/prod-like-check.mjs --stop`);
}
if (DOWN && up) {
  stop();
  await new Promise((r) => setTimeout(r, 800));
  const waveCount = allMigrations.filter((x) => Number(x.split("_")[0]) >= FIRST_WAVE1_MIGRATION).length;
  const down = spawnSync(exe, ["migrate", "down", String(waveCount), `--dir=${join(work, "pb_data")}`, `--migrationsDir=${join(pbDir, "pb_migrations")}`], { encoding: "utf8", input: "y\n" });
  console.log(String(down.stdout).trim().split("\n").slice(-6).join("\n"));
  check(down.status === 0 && /revert/i.test(String(down.stdout)), `migrate down ${waveCount} выполнен${down.status === 0 ? "" : `: ${(down.stderr || down.stdout).slice(0, 300)}`}`);
  check(await start(preWave1Dir, noHooks), "после down база поднимается на миграциях < 1790013000");
  const afterDown = (await getJson("/api/collections?perPage=200", await superToken())).items;
  const byName = (list) => Object.fromEntries(list.map((c) => [c.name, c]));
  const a = byName(beforeWave1);
  const b = byName(afterDown);
  const strip = (c) => ({ ...c, updated: undefined, fields: c.fields }); // updated: время последнего сохранения, не настройка
  const diffs = Object.keys(a).filter((name) => JSON.stringify(strip(a[name])) !== JSON.stringify(strip(b[name])));
  check(diffs.length === 0 && Object.keys(a).length === Object.keys(b).length, `down возвращает коллекции точно как до волны 1${diffs.length ? `; отличаются: ${diffs.join(", ")}` : ""}`);
  for (const name of diffs) {
    const x = a[name];
    const y = b[name];
    for (const k of Object.keys({ ...x, ...y })) {
      if (k === "fields") {
        for (const f of x.fields) {
          const g = y.fields.find((q) => q.name === f.name);
          if (JSON.stringify(f) !== JSON.stringify(g)) console.log(`  ${name}.${f.name}: до ${JSON.stringify(f)}\n      после ${JSON.stringify(g)}`);
        }
      } else if (k !== "updated" && JSON.stringify(x[k]) !== JSON.stringify(y[k])) console.log(`  ${name}.${k}: до ${JSON.stringify(x[k])}\n      после ${JSON.stringify(y[k])}`);
    }
  }
  stop();
}
if (failed) {
  console.log(`\nпроблем: ${failed}`);
  process.exitCode = 1;
}
