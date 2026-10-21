/**
 * Волна C, этап 1: проверка, что тесты group-access.spec.ts РЕАЛЬНО ловят ослабление правил.
 * Для каждого правила: временно ослабляет его на ТЕСТОВОЙ копии базы (суперпользователь
 * песочницы), гоняет тесты и требует, чтобы хотя бы один из ожидаемых тестов стал красным;
 * затем возвращает правило. Серверные хуки ослабляются копией папки pb_hooks и перезапуском
 * песочницы.
 *
 *   node scripts/c-mutations.mjs            (песочница на 8091, см. PROGRESS.md)
 *
 * Переменные: PB_URL (по умолчанию http://127.0.0.1:8091), SUPER_EMAIL, SUPER_PASS,
 * SANDBOX_DIR (папка pb_data песочницы), PB_BIN (путь к pocketbase.exe).
 */
import { execFileSync, spawn } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const PB = process.env.PB_URL ?? "http://127.0.0.1:8091";
const EMAIL = process.env.SUPER_EMAIL ?? "sandbox@test.local";
const PASS = process.env.SUPER_PASS ?? "SandboxPass12345";
const REPO = path.resolve(import.meta.dirname, "..", "..", "..");
const PB_BIN = process.env.PB_BIN ?? path.join(REPO, "pocketbase", "pocketbase.exe");
const SANDBOX = process.env.SANDBOX_DIR ?? path.join(process.env.TEMP ?? tmpdir(), "pbsandbox", "pb_data");
const SPEC = process.argv[2] ?? "tests/group-access.spec.ts";

async function api(method, url, token, body) {
  const res = await fetch(`${PB}${url}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${url}: ${res.status} ${await res.text()}`);
  return res.json();
}

const login = async () =>
  (await api("POST", "/api/collections/_superusers/auth-with-password", null, { identity: EMAIL, password: PASS })).token;

function runTests(spec = SPEC) {
  const out = path.join(process.env.TEMP ?? tmpdir(), `c-mut-${Date.now()}.json`);
  try {
    execFileSync(
      "npx",
      ["playwright", "test", spec, "--project=firefox", "--retries=0", "--reporter=json"],
      {
        cwd: path.join(REPO, "apps", "web"),
        env: { ...process.env, PB_URL: PB, SUPER_EMAIL: EMAIL, SUPER_PASS: PASS, PLAYWRIGHT_JSON_OUTPUT_NAME: out },
        stdio: ["ignore", "ignore", "ignore"],
        shell: true,
        timeout: 240000,
      }
    );
  } catch {
    /* код выхода не ноль, когда есть красные тесты — это нормально */
  }
  const report = JSON.parse(readFileSync(out, "utf8"));
  const failed = [];
  const walk = (suite) => {
    for (const s of suite.suites ?? []) walk(s);
    for (const spec of suite.specs ?? []) if (!spec.ok) failed.push(spec.title);
  };
  for (const s of report.suites) walk(s);
  rmSync(out, { force: true });
  return failed;
}

// ---- мутации правил: [название, коллекция, как ослабить, фрагмент названия теста, который обязан упасть]
const OPEN = '@request.auth.id != ""';
const RULE_MUTATIONS = [
  ["lectures: чужая лекция открыта любому вошедшему (list/view)", "lectures", { listRule: OPEN, viewRule: OPEN }, "чужая лекция без доступа"],
  ["lectures: пустой владелец совпадает с гостем (нет проверки входа)", "lectures", { viewRule: 'deleted_at = "" && (owner = @request.auth.id || (@collection.lecture_shares.lecture ?= id && @collection.lecture_shares.grantee ?= @request.auth.id))', listRule: 'deleted_at = "" && (owner = @request.auth.id || (@collection.lecture_shares.lecture ?= id && @collection.lecture_shares.grantee ?= @request.auth.id))' }, "без владельца"],
  ["lectures: корзина не закрывает доступ", "lectures", { listRule: '@request.auth.id != "" && (owner = @request.auth.id || (@collection.lecture_shares.lecture ?= id && @collection.lecture_shares.grantee ?= @request.auth.id))', viewRule: '@request.auth.id != "" && (owner = @request.auth.id || (@collection.lecture_shares.lecture ?= id && @collection.lecture_shares.grantee ?= @request.auth.id))' }, "в корзине"],
  ["lectures: можно создать лекцию за другого", "lectures", { createRule: OPEN }, "за другого"],
  ["lecture_shares: выдать доступ может любой (создание)", "lecture_shares", { createRule: '@request.auth.id != "" && owner = @request.auth.id' }, "от себя"],
  ["lecture_shares: снять доступ может любой вошедший", "lecture_shares", { deleteRule: OPEN }, "доступ выдаёт и снимает только автор"],
  ["lecture_shares: читает любой вошедший", "lecture_shares", { listRule: OPEN, viewRule: OPEN }, "доступ выдаёт и снимает только автор"],
  ["lecture_shares: получатель может менять выдачу", "lecture_shares", { updateRule: '@request.auth.id != "" && (owner = @request.auth.id || grantee = @request.auth.id)' }, "доступ выдаёт и снимает только автор"],
  ["lecture_previews: превью видит любой вошедший", "lecture_previews", { listRule: OPEN, viewRule: OPEN }, "название чужой лекции"],
  ["group_members: вступить в группу без кода (создание)", "group_members", { createRule: '@request.auth.id != "" && user = @request.auth.id' }, "вступление по коду"],
  ["group_members: сменить группу в строке членства", "group_members", { updateRule: '@request.auth.id != "" && user = @request.auth.id' }, "вступление по коду"],
  ["group_members: выйти в обход серверной логики (удаление)", "group_members", { deleteRule: '@request.auth.id != "" && (user = @request.auth.id || group.owner = @request.auth.id)' }, "выйти и удалить аккаунт"],
  ["groups: список групп виден любому вошедшему", "groups", { listRule: OPEN, viewRule: OPEN }, "вступление по коду"],
  ["groups: код приглашения не скрыт", "groups", { __hideInviteCode: false }, "вступление по коду"],
  ["groups: владельца можно сменить напрямую", "groups", { updateRule: '@request.auth.id != "" && owner = @request.auth.id' }, "выйти и удалить аккаунт"],
  ["users: чужие профили видны любому вошедшему", "users", { viewRule: OPEN, listRule: OPEN }, "вступление по коду"],
];

// ---- мутации хуков: [название, файл, замена, фрагмент названия теста]
// ---- правила квиза: проверяются файлом quiz-privacy (гость не создаёт/не удаляет квиз, ответы личные)
const QUIZ_SPEC = "tests/quiz-privacy.spec.ts";
const QUIZ_MUTATIONS = [
  ["quizzes: гость может создать квиз чужой лекции", "quizzes", { createRule: '@request.auth.id != "" && owner = @request.auth.id' }, "гость не может создать"],
  ["quizzes: гость может удалить квиз чужой лекции", "quizzes", { deleteRule: OPEN, updateRule: OPEN }, "гость не может создать"],
  ["quiz_questions: гость может менять вопросы", "quiz_questions", { createRule: OPEN, updateRule: OPEN, deleteRule: OPEN }, "гость не может создать"],
  ["quiz_answers: ответы читает любой вошедший", "quiz_answers", { listRule: OPEN, viewRule: OPEN }, "чужой список пуст"],
  ["quiz_answers: гость отвечает без доступа к лекции", "quiz_answers", { createRule: '@request.auth.id != "" && owner = @request.auth.id' }, "доступ снят"],
];

const HOOK_MUTATIONS = [
  ["hook: доступ можно выдать не члену группы", "groups_manage.pb.js", [/if \(!g\.shareGroupId\(e\.app, owner, grantee\)\) \{/, "if (false) {"], "доступ выдаёт и снимает только автор"],
  ["hook: старый код после сброса продолжает работать", "groups_manage.pb.js", [/group\.set\("invite_code", \$security\.randomStringWithAlphabet\(8, alphabet\)\);\n    e\.app\.save\(group\);\n    return e\.json\(200, \{ code: String\(group\.get\("invite_code"\)\) \}\);/, 'return e.json(200, { code: String(group.get("invite_code")) });'], "код приглашения"],
  ["hook: передать группу можно не участнику", "groups_manage.pb.js", [/if \(!g\.isMember\(e\.app, group\.id, target\)\) \{/, "if (false) {"], "выйти и удалить аккаунт"],
  ["hook: участник видит код (ownerOnlyGroup пускает участников)", "lib_groups.js", [/throw new ForbiddenError\("Это может только владелец группы\."\);/, "return group;"], "код приглашения"],
  ["hook: в превью копируется текст лекции", "lib_previews.js", [/const previewText = "";/, 'const previewText = stripHtml(lecture.get("content")).slice(0, PREVIEW_MAX);'], "название чужой лекции"],
  ["hook: превью из корзины остаётся", "lib_previews.js", [/const inTrash = String\(lecture\.get\("deleted_at"\) \|\| ""\) !== "";/, "const inTrash = false;"], "в корзине"],
  ["hook: ростер отдаёт почту", "groups_access.pb.js", [/user = \{ id: u\.id, name: label, avatar: String\(u\.get\("avatar"\) \|\| ""\) \};/, 'user = { id: u.id, name: label, email: u.get("email") };'], "ростер"],
  ["hook: удаление аккаунта владельцем группы разрешено", "account_deletion.pb.js", [/if \(others > 0\) \{\n        return e\.json\(409/, "if (false) {\n        return e.json(409"], "выйти и удалить аккаунт"],
];

let token = await login();
const results = [];

console.log("Базовый прогон без ослаблений…");
const baseline = [...runTests(), ...runTests(QUIZ_SPEC)];
console.log(baseline.length === 0 ? "  все тесты зелёные" : `  КРАСНЫЕ: ${baseline.join("; ")}`);
if (baseline.length) process.exit(1);

for (const [title, collection, patch, expected, spec = SPEC] of [
  ...RULE_MUTATIONS,
  ...QUIZ_MUTATIONS.map((m) => [...m, QUIZ_SPEC]),
]) {
  token = await login();
  const original = await api("GET", `/api/collections/${collection}`, token);
  const body = { ...patch };
  let fields;
  if ("__hideInviteCode" in body) {
    fields = original.fields.map((f) => (f.name === "invite_code" ? { ...f, hidden: body.__hideInviteCode } : f));
    delete body.__hideInviteCode;
    body.fields = fields;
  }
  await api("PATCH", `/api/collections/${collection}`, token, body);
  const failed = runTests(spec);
  const restore = { fields: original.fields };
  for (const k of ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"]) restore[k] = original[k];
  token = await login();
  await api("PATCH", `/api/collections/${collection}`, token, restore);
  const caught = failed.some((t) => t.includes(expected));
  results.push({ title, caught, failed });
  console.log(`${caught ? "КРАСНЫЙ (ловится)" : "ЗЕЛЁНЫЙ (НЕ ЛОВИТСЯ!)"}  ${title}\n      упали: ${failed.length ? failed.join(" | ") : "ничего"}`);
}

// хуки: копия pb_hooks, правка, перезапуск песочницы с этой копией
const hooksSrc = path.join(REPO, "pocketbase", "pb_hooks");
function killSandbox() {
  try {
    const out = execFileSync("wmic", ["process", "where", "name='pocketbase.exe'", "get", "ProcessId,CommandLine"], { encoding: "utf8" });
    for (const line of out.split("\n")) {
      if (!line.includes(":8091")) continue;
      const pid = line.trim().split(/\s+/).pop();
      if (/^\d+$/.test(pid)) execFileSync("taskkill", ["/F", "/PID", pid], { stdio: "ignore" });
    }
  } catch {
    /* нечего останавливать */
  }
}
async function startSandbox(hooksDir) {
  killSandbox();
  await new Promise((r) => setTimeout(r, 1500));
  const child = spawn(
    PB_BIN,
    ["serve", `--dir=${SANDBOX}`, `--hooksDir=${hooksDir}`, `--migrationsDir=${path.join(REPO, "pocketbase", "pb_migrations")}`, "--http=127.0.0.1:8091", "--automigrate=false"],
    { detached: true, stdio: "ignore", windowsHide: true }
  );
  child.unref();
  for (let i = 0; i < 40; i += 1) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      if ((await fetch(`${PB}/api/health`)).ok) return;
    } catch {
      /* ещё не поднялся */
    }
  }
  throw new Error("песочница не поднялась");
}

for (const [title, file, [re, repl], expected] of HOOK_MUTATIONS) {
  const dir = mkdtempSync(path.join(process.env.TEMP ?? tmpdir(), "hooks-mut-"));
  cpSync(hooksSrc, dir, { recursive: true });
  const target = path.join(dir, file);
  const src = readFileSync(target, "utf8");
  if (!re.test(src)) {
    console.log(`ПРОПУЩЕНО (шаблон не найден в ${file}): ${title}`);
    results.push({ title, caught: false, failed: ["шаблон не найден"] });
    continue;
  }
  writeFileSync(target, src.replace(re, repl));
  await startSandbox(dir);
  const failed = runTests();
  const caught = failed.some((t) => t.includes(expected));
  results.push({ title, caught, failed });
  console.log(`${caught ? "КРАСНЫЙ (ловится)" : "ЗЕЛЁНЫЙ (НЕ ЛОВИТСЯ!)"}  ${title}\n      упали: ${failed.length ? failed.join(" | ") : "ничего"}`);
  rmSync(dir, { recursive: true, force: true });
}
await startSandbox(hooksSrc);

const missed = results.filter((r) => !r.caught);
console.log(`\nИтого: ${results.length - missed.length} из ${results.length} ослаблений ловятся тестами.`);
if (missed.length) {
  console.log("НЕ ловятся:\n" + missed.map((m) => " - " + m.title).join("\n"));
  process.exit(2);
}
