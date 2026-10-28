/**
 * Волна C, этап 1: проверка, что тесты group-access.spec.ts РЕАЛЬНО ловят ослабление правил.
 * Для каждого правила: временно ослабляет его на ТЕСТОВОЙ копии базы (суперпользователь
 * песочницы), гоняет тесты и требует, чтобы хотя бы один из ожидаемых тестов стал красным;
 * затем возвращает правило. Серверные хуки ослабляются копией папки pb_hooks и перезапуском
 * песочницы.
 *
 *   node scripts/c-mutations.mjs            (песочница на 8091, см. PROGRESS.md)
 *
 * Переменные: PB_URL (по умолчанию http://127.0.0.1:8091; порт задаёт и порт перезапускаемой песочницы), SUPER_EMAIL, SUPER_PASS,
 * SANDBOX_DIR (папка pb_data песочницы), PB_BIN (путь к pocketbase.exe).
 */
import { execFileSync, spawn } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const PB = process.env.PB_URL ?? "http://127.0.0.1:8091";
const PORT = new URL(PB).port;
const EMAIL = process.env.SUPER_EMAIL ?? "sandbox@test.local";
const PASS = process.env.SUPER_PASS ?? "SandboxPass12345";
const REPO = path.resolve(import.meta.dirname, "..", "..", "..");
const PB_BIN = process.env.PB_BIN ?? path.join(REPO, "pocketbase", "pocketbase.exe");
const SANDBOX = process.env.SANDBOX_DIR ?? path.join(process.env.TEMP ?? tmpdir(), "pbsandbox", "pb_data");
const SPEC = process.argv[2]
  ? [process.argv[2]]
  : ["tests/group-access.spec.ts", "tests/group-exams.spec.ts", "tests/group-subgroup-leave.spec.ts", "tests/group-lifecycle.spec.ts", "tests/group-code.spec.ts", "tests/group-exam-link.spec.ts"];

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
  const specs = Array.isArray(spec) ? spec : [spec];
  const out = path.join(process.env.TEMP ?? tmpdir(), `c-mut-${Date.now()}.json`);
  try {
    execFileSync(
      "npx",
      ["playwright", "test", ...specs, "--project=firefox", "--retries=0", "--reporter=json"],
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

// Правило как функция текущего: ослабляем конкретную часть.
const NO_SUSPEND = (r) => String(r).replace(" && @collection.lecture_shares.suspended ?!= true", "");
RULE_MUTATIONS.push(
  ["lectures: приостановленный доступ продолжает работать", "lectures", { listRule: NO_SUSPEND, viewRule: NO_SUSPEND }, "выход:"],
  ["exam_subgroups: подгруппы видны всем вошедшим", "exam_subgroups", { listRule: OPEN, viewRule: OPEN }, "подгруппу и её билеты видят только"],
  ["exam_tickets: билеты подгруппы видны всем вошедшим", "exam_tickets", { listRule: OPEN, viewRule: OPEN }, "подгруппу и её билеты видят только"],
  ["exam_tickets: записывать билет может любой вошедший", "exam_tickets", { updateRule: OPEN }, "блокировка"],
  ["exam_participants: состав подгрупп виден всем вошедшим", "exam_participants", { listRule: OPEN, viewRule: OPEN }, "подгруппу и её билеты видят только"],
  ["exam_participants: можно добавить в подгруппу напрямую", "exam_participants", { createRule: OPEN }, "один человек не может"],
  ["exam_participants: можно переставить в другую подгруппу правкой", "exam_participants", { updateRule: OPEN }, "один человек не может"],
  ["exam_participants: уникальность (экзамен, человек) снята", "exam_participants", { __indexes: [] }, "один человек не может"],
  ["exams: экзамен группы виден всем вошедшим", "exams", { listRule: OPEN, viewRule: OPEN }, "подгруппу и её билеты видят только"],
  ["exams: экзамен можно создать в чужой группе", "exams", { createRule: '@request.auth.id != "" && owner = @request.auth.id' }, "участник группы создаёт подгруппу"],
  ["lecture_shares: доступы разных групп не различаются (индекс без группы)", "lecture_shares", { __indexes: ["CREATE UNIQUE INDEX `idx_lecture_shares_lecture_grantee` ON `lecture_shares` (`lecture`, `grantee`)"] }, "один и тот же человек получает доступ отдельно"],
  ["lecture_shares: получатель сам меняет «разрешить копировать»", "lecture_shares", { updateRule: '@request.auth.id != "" && (owner = @request.auth.id || grantee = @request.auth.id)' }, "копировать можно"],
  ["access_requests: запросы видны всем вошедшим", "access_requests", { listRule: OPEN, viewRule: OPEN }, "запросить можно только"],
  ["access_requests: запрос создаётся напрямую", "access_requests", { createRule: OPEN }, "запросить можно только"],
  ["access_requests: запрос меняется напрямую", "access_requests", { updateRule: OPEN }, "запросить можно только"],
  ["access_requests: уникальность открытого запроса снята", "access_requests", { __indexes: [] }, "запросить можно только"],
  ["exam_tickets: билет подгруппы можно создать напрямую (в обход маршрута импорта)", "exam_tickets", { createRule: OPEN }, "импорт списка билетов"],
  ["exam_tickets: личные билеты видны всем вошедшим", "exam_tickets", { listRule: OPEN, viewRule: OPEN }, "личные ответы не видны"],
  ["exam_tickets: чужой личный ответ можно править", "exam_tickets", { updateRule: OPEN }, "личные ответы не видны"],
  ["exams: личный экзамен виден всем вошедшим (ответы вместе с ним)", "exams", { listRule: OPEN, viewRule: OPEN }, "личные ответы не видны"],
  ["tags: теги читает любой, даже без входа", "tags", { listRule: "", viewRule: "" }, "теги"],
  ["tags: теги создаёт и удаляет любой", "tags", { createRule: "", updateRule: "", deleteRule: "" }, "теги"],
);

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
  ["hook: доступ можно выдать не члену группы", "groups_manage.pb.js", [/if \(!group \|\| !g\.isMember\(e\.app, group, owner\) \|\| !g\.isMember\(e\.app, group, grantee\)\) \{/, "if (false) {"], "один и тот же человек получает доступ отдельно"],
  ["hook: старый код после сброса продолжает работать", "groups_manage.pb.js", [/group\.set\("invite_code", g\.newInviteCode\(e\.app\)\);\n    e\.app\.save\(group\);\n    return e\.json\(200, \{ code: String\(group\.get\("invite_code"\)\) \}\);/, 'return e.json(200, { code: String(group.get("invite_code")) });'], "код приглашения"],
  ["hook: передать группу можно не участнику", "groups_manage.pb.js", [/if \(!g\.isMember\(e\.app, group\.id, target\)\) \{/, "if (false) {"], "выйти и удалить аккаунт"],
  ["hook: участник видит код (ownerOnlyGroup пускает участников)", "lib_groups.js", [/throw new ForbiddenError\("Это может только владелец группы\."\);/, "return group;"], "код приглашения"],
  ["hook: в превью копируется текст лекции", "lib_previews.js", [/preview_text: "",/, "preview_text: String(lecture.get(String.fromCharCode(99,111,110,116,101,110,116)) || \"\"),"], "название чужой лекции"],
  ["hook: превью из корзины остаётся", "lib_previews.js", [/const inTrash = String\(lecture\.get\("deleted_at"\) \|\| ""\) !== "";/, "const inTrash = false;"], "в корзине"],
  ["hook: ростер отдаёт почту", "groups_join.pb.js", [/user = \{ id: u\.id, name: label, avatar: String\(u\.get\("avatar"\) \|\| ""\) \};/, 'user = { id: u.id, name: label, email: u.get("email") };'], "ростер"],
  ["hook: запись билета занятого другим разрешена", "exam_tickets.pb.js", [/if \(g\.isLockedByOther\(e\.record, me\)\) \{\n      throw new ApiError/, "if (false) {\n      throw new ApiError"], "блокировка"],
  ["hook: маршрут блокировки не проверяет «Занят»", "exam_tickets.pb.js", [/if \(g\.isLockedByOther\(t, e\.auth\.id\)\) \{\n      return e\.json\(409, \{ code: "busy", locked_by: holder, locked_until: until \}\);/, 'if (false) {\n      return e.json(409, { code: "busy" });'], "блокировка"],
  ["hook: «Взять мой ответ» перезаписывает занятый билет", "exam_tickets.pb.js", [/if \(g\.isLockedByOther\(t, e\.auth\.id\)\) \{\n      return e\.json\(409, \{ code: "busy", locked_by: holder \}\);/, 'if (false) {\n      return e.json(409, { code: "busy", locked_by: holder });'], "Взять мой ответ"],
  ["hook: человек попадает во вторую подгруппу (создание)", "exam_subgroups.pb.js", [/if \(part && String\(part\.get\("subgroup"\) \|\| ""\) !== ""\) \{\n        return e\.json\(409, \{ code: "already_in_subgroup", user: uid \}\);/, 'if (false) {\n        return e.json(409, { code: "already_in_subgroup", user: uid });'], "один человек не может"],
  ["hook: человек попадает во вторую подгруппу (приглашение)", "exam_subgroups.pb.js", [/if \(part && String\(part\.get\("subgroup"\) \|\| ""\) !== ""\) \{\n      return e\.json\(409/, 'if (false) {\n      return e.json(409'], "один человек не может"],
  ["hook: посторонний управляет чужой подгруппой", "lib_groups.js", [/if \(!isSubgroupMember\(e\.app, sub\.id, e\.auth\.id\)\) \{\n    throw new NotFoundError/, 'if (false) {\n    throw new NotFoundError'], "подгруппу и её билеты видят только"],
  // (запись билета чужой подгруппы закрыта и правилом, и хуком: ослабление одного хука красным не становится, правило ловится мутацией exam_tickets.updateRule)
  ["hook: подгруппу создаёт не участник группы", "exam_subgroups.pb.js", [/if \(!groupId \|\| !g\.isMember\(e\.app, groupId, me\)\) throw new NotFoundError\("Экзамен не найден\."\);/, 'if (!groupId) throw new NotFoundError("Экзамен не найден.");'], "участник группы создаёт подгруппу"],
  ["hook: исключение не убирает человека", "groups_manage.pb.js", [/g\.leaveGroupCore\(e\.app, group, target, \{ kicked: true \}\);/, "/* пропуск */"], "исключённый"],
  ["hook: выход не убирает человека", "groups_manage.pb.js", [/g\.leaveGroupCore\(e\.app, group, e\.auth\.id, \{ remember: !!data\.remember \}\);/, "/* пропуск */"], "выход"],
  ["hook: при выходе доступы не приостанавливаются", "lib_groups.js", [/sh\.set\("suspended", true\);/g, 'sh.set("suspended", false);'], "выход"],
  ["hook: при возврате полученные доступы не включаются", "lib_groups.js", [/if \(isMember\(app, groupId, String\(sh\.get\("owner"\)\)\)\) \{/, "if (false) {"], "выход"],
  ["hook: «Вернуть прежние доступы» ничего не возвращает", "groups_manage.pb.js", [/sh\.set\("suspended", false\);\n      e\.app\.save\(sh\);/, "/* пропуск */"], "выход"],
  ["hook: владелец выходит без передачи группы", "groups_manage.pb.js", [/if \(group\.get\("owner"\) === e\.auth\.id && others > 0\) \{/, "if (false) {"], "владелец с участниками не может выйти"],
  ["hook: закрытая ссылка пускает по коду", "groups_join.pb.js", [/if \(group\.get\("invite_enabled"\) !== true\) \{\n        throw/, "if (false) {\n        throw"], "закрыта"],
  ["hook: запрос доступа к лекции без предпросмотра", "lecture_sharing.pb.js", [/String\(lecture\.get\("deleted_at"\) \|\| ""\) !== "" \|\| !preview\) \{/, 'String(lecture.get("deleted_at") || "") !== "") {'], "запросить можно только"],
  ["hook: запрос доступа от не участника группы", "lecture_sharing.pb.js", [/if \(!g\.isMember\(e\.app, groupId, me\) \|\| !g\.isMember\(e\.app, groupId, owner\)\) \{/, "if (false) {"], "запросить можно только"],
  ["hook: запрос решает не автор", "lecture_sharing.pb.js", [/if \(req\.get\("owner"\) !== e\.auth\.id\) throw new NotFoundError\("Запрос не найден\."\);/, "/* пропуск */"], "запросить можно только"],
  ["hook: копирование без разрешения автора", "lecture_sharing.pb.js", [/if \(!shares\.some\(\(s\) => s\.get\("allow_copy"\) === true\)\) \{/, "if (false) {"], "копировать можно"],
  ["hook: копия кладётся в чужой предмет", "lecture_sharing.pb.js", [/if \(!c \|\| c\.get\("owner"\) !== me\) throw/, "if (!c) throw"], "копировать можно"],
  ["hook: доступ подгруппе выдаёт не её участник", "lecture_sharing.pb.js", [/if \(!g\.isSubgroupMember\(e\.app, sub\.id, e\.auth\.id\)\) \{\n      throw new NotFoundError\("Подгруппа/, 'if (false) {\n      throw new NotFoundError("Подгруппа'], "доступ подгруппе"],
  ["hook: билет назначается не участнику подгруппы", "exam_tickets.pb.js", [/if \(!g\.isSubgroupMember\(e\.app, String\(t\.get\("subgroup"\)\), uid\)\) \{/, "if (false) {"], "раздаются поровну"],
  ["hook: присоединение к групповому экзамену без сверки названия", "exam_subgroups.pb.js", [/if \(nameOf\(mine\) !== nameOf\(target\)\) throw new BadRequestError\("Названия предметов не совпадают\."\);/, "/* пропуск */"], "личный экзамен присоединяется"],
  ["hook: в общем списке экзамена группы ответ владельца виден прошедшему PoK", "exam_pok.pb.js", [/\} else if \(groupExam && uid !== ownerId\) \{/, "} else if (false) {"], "в общем списке экзамена группы"],
  ["hook: номер лекции не попадает в новое превью", "lib_previews.js", [/lecture_number: number,/, ""], "номер и дата лекции"],
  ["hook: номер лекции не обновляется в превью после правки", "lib_previews.js", [/row\.set\("lecture_number", number\);/, "/* пропуск */"], "номер и дата лекции"],
  ["hook: список экзаменов группы отдаётся не участнику", "exam_subgroups.pb.js", [/if \(!g\.isMember\(e\.app, gid, e\.auth\.id\)\) throw new NotFoundError\("Группа не найдена\."\);/, "/* пропуск */"], "список экзаменов группы"],
  ["hook: экзамен группы отдаётся не участнику", "exam_subgroups.pb.js", [/if \(!gid \|\| !g\.isMember\(e\.app, gid, e\.auth\.id\)\) throw new NotFoundError\("Экзамен не найден\."\);\n    const taken/, "const taken"], "список экзаменов группы"],
  ["hook: в экзамене группы показана чужая подгруппа", "lib_groups.js", [/const part = first\(app, "exam_participants", "exam = \{:x\} && user = \{:u\}", \{ x: exam\.id, u: me \}\);/, "const part = first(app, \"exam_participants\", \"exam = {:x} && subgroup != ''\", { x: exam.id });"], "список экзаменов группы"],
  // импорт списка билетов в подгруппу
  ["hook: импорт билетов принимает не участника подгруппы", "exam_tickets.pb.js", [/const sub = g\.memberSubgroup\(e\);\n    const data = new DynamicModel\(\{ questions: \[\] \}\);/, 'const sub = e.app.findRecordById("exam_subgroups", e.request.pathValue("id"));\n    const data = new DynamicModel({ questions: [] });'], "импорт списка билетов"],
  ["hook: импорт нумерует с единицы, не после существующих", "lib_groups.js", [/return max \+ 1;/, "return 1;"], "импорт списка билетов"],
  ["hook: импорт сохраняет пустые строки", "exam_tickets.pb.js", [/if \(text\) list\.push\(text\);/, "list.push(text);"], "импорт списка билетов"],
  ["hook: импорт без ограничения длины списка", "exam_tickets.pb.js", [/if \(list\.length > 500\)/, "if (false)"], "импорт списка билетов"],
  // выход из подгруппы
  ["hook: выход из подгруппы не убирает участие", "lib_groups.js", [/if \(part\) app\.delete\(part\);/, "/* пропуск */"], "после выхода билеты подгруппы"],
  ["hook: выход не закрывает лекции, открытые подгруппе", "lib_groups.js", [/for \(const sh of all\(app, "lecture_shares", "grantee = \{:u\} && subgroup = \{:s\}", \{ u: userId, s: sub\.id \}\)\) app\.delete\(sh\);/, "/* пропуск */"], "лекция, открытая подгруппе, закрылась"],
  ["hook: выход закрывает и лично открытые лекции", "lib_groups.js", [/for \(const sh of all\(app, "lecture_shares", "grantee = \{:u\} && subgroup = \{:s\}", \{ u: userId, s: sub\.id \}\)\) app\.delete\(sh\);/, 'for (const sh of all(app, "lecture_shares", "grantee = {:u}", { u: userId })) app.delete(sh);'], "лекция, открытая подгруппе, закрылась"],
  ["hook: выход из подгруппы выводит и из группы", "lib_groups.js", [/if \(part\) app\.delete\(part\);/, 'if (part) app.delete(part);\n  for (const m of all(app, "group_members", "user = {:u}", { u: userId })) app.delete(m);'], "из группы человек не вышел"],
  ["hook: пустая подгруппа не удаляется", "lib_groups.js", [/if \(app\.countRecords\("exam_participants", \$dbx\.hashExp\(\{ subgroup: sub\.id \}\)\) === 0\) \{/, "if (false) {"], "последний вышедший"],
  ["hook: выйти из чужой подгруппы может любой", "exam_subgroups.pb.js", [/const sub = g\.memberSubgroup\(e\);\n    e\.app\.runInTransaction\(\(tx\) => g\.removeFromSubgroup/, 'const sub = e.app.findRecordById("exam_subgroups", e.request.pathValue("id"));\n    e.app.runInTransaction((tx) => g.removeFromSubgroup'], "посторонний и участник группы вне подгруппы"],
  // код приглашения при создании группы
  ["hook: занятый код из формы оставляется (дубль кода у двух групп)", "groups_manage.pb.js", [/if \(!okFormat \|\| g\.codeTaken\(tx, code\)\) code = g\.newInviteCode\(tx\);/, "if (!okFormat) code = g.newInviteCode(tx);"], "два одновременных создания"],
  ["hook: лимит частоты запросов кода снят", "lib_groups.js", [/if \(recent\.length >= max\) throw new ApiError\(429/, "if (false) throw new ApiError(429"], "частота запросов ограничена"],
  ["hook: в алфавите кода путаемые знаки (0, o, 1, i, l)", "lib_groups.js", [/const CODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";/, 'const CODE_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";'], "код создаётся"],
  ["hook: дефис и регистр в коде при вступлении не обрабатываются", "lib_groups.js", [/\.replace\(\/\[\^a-z0-9\]\/g, ""\);/, '.replace(/[^a-z0-9-]/g, "");'], "после «Создать группу»"],
  ["hook: код из формы не проверяется на формат (мусор становится кодом)", "groups_manage.pb.js", [/const okFormat = code\.length === 8 && code\.split\(""\)\.every\(\(ch\) => g\.CODE_ALPHABET\.indexOf\(ch\) >= 0\);/, "const okFormat = code.length > 0;"], "занятый код заменяется"],
  // личный экзамен и экзамен группы
  ["hook: присоединение затирает уже существующие личные билеты", "exam_subgroups.pb.js", [/if \(have\[String\(t\.get\("number"\)\)\]\) continue;/, "/* пропуск */"], "присоединение не теряет"],
  ["hook: «Взять мой ответ» берёт чужой личный билет", "exam_tickets.pb.js", [/if \(srcExam\.get\("owner"\) !== e\.auth\.id \|\| String\(src\.get\("subgroup"\) \|\| ""\) !== ""\) \{/, "if (false) {"], "личные ответы не видны"],
  ["hook: присоединиться к групповому экзамену может не участник группы", "exam_subgroups.pb.js", [/const gid = String\(target\.get\("group"\) \|\| ""\);\n    if \(!gid \|\| !g\.isMember\(e\.app, gid, me\)\) throw/, 'const gid = String(target.get("group") || "");\n    if (!gid) throw'], "выход из подгруппы и из группы"],
  ["hook: удаление аккаунта владельцем группы разрешено", "account_deletion.pb.js", [/if \(others > 0\) \{\n        return e\.json\(409/, "if (false) {\n        return e.json(409"], "выйти и удалить аккаунт"],
];

let token = await login();
const results = [];

console.log("Базовый прогон без ослаблений…");
const baseline = [...runTests(), ...runTests(QUIZ_SPEC)];
console.log(baseline.length === 0 ? "  все тесты зелёные" : `  КРАСНЫЕ: ${baseline.join("; ")}`);
if (baseline.length) process.exit(1);

// SKIP_RULES=1 пропускает ослабления правил коллекций (быстрый повторный прогон только хуков через ONLY=…)
for (const [title, collection, patch, expected, spec = SPEC] of process.env.SKIP_RULES
  ? []
  : [...RULE_MUTATIONS, ...QUIZ_MUTATIONS.map((m) => [...m, QUIZ_SPEC])]) {
  token = await login();
  const original = await api("GET", `/api/collections/${collection}`, token);
  const body = {};
  for (const [k, v] of Object.entries(patch)) body[k] = typeof v === "function" ? v(original[k]) : v;
  if ("__indexes" in body) {
    body.indexes = body.__indexes;
    delete body.__indexes;
  }
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
  restore.indexes = original.indexes;
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
      if (!line.includes(`:${PORT}`)) continue;
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
    ["serve", `--dir=${SANDBOX}`, `--hooksDir=${hooksDir}`, `--migrationsDir=${path.join(REPO, "pocketbase", "pb_migrations")}`, `--http=127.0.0.1:${PORT}`, "--automigrate=false"],
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

const ONLY = (process.env.ONLY ?? "").split(",").filter(Boolean);
const wanted = (t) => ONLY.length === 0 || ONLY.some((o) => t.includes(o));
for (const [title, file, [re, repl], expected] of HOOK_MUTATIONS.filter((m) => wanted(m[0]))) {
  const dir = mkdtempSync(path.join(process.env.TEMP ?? tmpdir(), "hooks-mut-"));
  cpSync(hooksSrc, dir, { recursive: true });
  const target = path.join(dir, file);
  const src = readFileSync(target, "utf8").split(String.fromCharCode(13,10)).join(String.fromCharCode(10));
  if (!re.test(src)) {
    console.log(`ПРОПУЩЕНО (шаблон не найден в ${file}): ${title}`);
    results.push({ title, caught: false, failed: ["шаблон не найден"] });
    rmSync(dir, { recursive: true, force: true });
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
