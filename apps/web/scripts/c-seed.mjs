// Тестовые данные группы для скриншотов (волна C). Работает с копией базы (песочница на 8091):
//   PB_URL=http://127.0.0.1:8091 SUPER_EMAIL=... SUPER_PASS=... node scripts/c-seed.mjs [--clean]
// Создаёт группу «МК-31» (владелец — демо-аккаунт) и «ЭК-21», одногруппников с лекциями и предпросмотром.
const PB = process.env.PB_URL ?? "http://127.0.0.1:8091";
const DEMO = { email: process.env.DEMO_EMAIL, password: process.env.DEMO_PASSWORD };
const PASS = "Test-pass-12345";
const TAG = "gseed";

async function api(method, url, token, body) {
  const r = await fetch(PB + url, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${url} ${r.status} ${text}`);
  return text ? JSON.parse(text) : {};
}
const login = async (email, password) => {
  const r = await api("POST", "/api/collections/users/auth-with-password", null, { identity: email, password });
  return { token: r.token, id: r.record.id };
};
const superLogin = async () => (await api("POST", "/api/collections/_superusers/auth-with-password", null, { identity: process.env.SUPER_EMAIL, password: process.env.SUPER_PASS })).token;

if (process.argv.includes("--clean")) {
  const su = await superLogin();
  const users = await api("GET", `/api/collections/users/records?perPage=200&filter=${encodeURIComponent(`email ~ "${TAG}-"`)}`, su);
  const groups = await api("GET", `/api/collections/groups/records?perPage=200&filter=${encodeURIComponent(`name = "МК-31" || name = "ЭК-21"`)}`, su);
  for (const g of groups.items) await api("DELETE", `/api/collections/groups/records/${g.id}`, su);
  for (const u of users.items) await api("DELETE", `/api/collections/users/records/${u.id}`, su);
  console.log("убрано: пользователей", users.items.length, "групп", groups.items.length);
  process.exit(0);
}

const names = ["Лена Орлова", "Дима Ершов", "Игорь Власов", "Марина Белова", "Артём Громов", "Катя Соколова", "Олег Тихонов", "Полина Жук"];
const demo = await login(DEMO.email, DEMO.password);

async function mk(name, i) {
  const email = `${TAG}-${i}-${Date.now()}@example.test`;
  await api("POST", "/api/collections/users/records", null, { email, password: PASS, passwordConfirm: PASS, name });
  return { name, ...(await login(email, PASS)) };
}
const people = [];
for (let i = 0; i < names.length; i += 1) people.push(await mk(names[i], i));
const [lena, dima, igor, marina, artem, katya, oleg, polina] = people;

// МК-31: владелец демо-аккаунт
const g1 = (await api("POST", "/api/groups/create", demo.token, { name: "МК-31" })).id;
await api("POST", `/api/groups/${g1}/invite/enable`, demo.token, { enabled: true });
const code1 = (await api("GET", `/api/groups/${g1}/invite`, demo.token)).code;
for (const p of people) await api("POST", "/api/groups/join", p.token, { code: code1 });

// ЭК-21: владелец Лена, демо состоит
const g2 = (await api("POST", "/api/groups/create", lena.token, { name: "ЭК-21" })).id;
await api("POST", `/api/groups/${g2}/invite/enable`, lena.token, { enabled: true });
const code2 = (await api("GET", `/api/groups/${g2}/invite`, lena.token)).code;
await api("POST", "/api/groups/join", demo.token, { code: code2 });
await api("POST", "/api/groups/join", dima.token, { code: code2 });

async function courseWithLectures(p, courseName, seed, titles) {
  const c = await api("POST", "/api/collections/courses/records", p.token, { name: courseName, owner: p.id, slug: `${TAG}-${Math.random().toString(36).slice(2, 8)}`, cover_seed: seed });
  const ids = [];
  for (const t of titles) {
    const l = await api("POST", "/api/collections/lectures/records", p.token, {
      title: t,
      slug: `${TAG}-${Math.random().toString(36).slice(2, 9)}`,
      owner: p.id,
      field: c.id,
      content: `<h2>${t}</h2><p>Конспект лекции «${t}».</p>`,
    });
    ids.push(l.id);
  }
  return ids;
}
async function preview(p, group) {
  const rows = (await api("GET", `/api/collections/group_members/records?filter=${encodeURIComponent(`group="${group}" && user="${p.id}"`)}`, p.token)).items;
  await api("PATCH", `/api/collections/group_members/records/${rows[0].id}`, p.token, { preview_enabled: true });
}

const phil = ["Философия всеединства", "Экзистенциализм", "Немецкая классическая философия", "Античная философия", "Средневековая философия", "Введение в философию"];
const igorPhil = await courseWithLectures(igor, "Философия", 212, phil);
await courseWithLectures(igor, "История России", 335, ["Киевская Русь", "Московское царство", "Империя", "Реформы", "Революция", "СССР", "Современность"]);
const igorLaw = await courseWithLectures(igor, "Гражданское право", 60, ["Оферта и акцепт", "Договор купли-продажи", "Обязательства", "Сделки", "Право собственности", "Наследование", "Представительство", "Исковая давность", "Залог"]);
await courseWithLectures(igor, "Статистика", 135, ["Среднее", "Дисперсия", "Корреляция", "Регрессия", "Выборка"]);
const lenaLaw = await courseWithLectures(lena, "Гражданское право", 20, ["Оферта и акцепт", "Заключение договора"]);
await courseWithLectures(lena, "Философия", 212, ["Античная философия", "Сократ и Платон"]);
await courseWithLectures(dima, "Маркетинг", 335, ["Сегментирование рынка", "Позиционирование", "Бренд"]);
await courseWithLectures(oleg, "Статистика", 135, ["Распределения", "Проверка гипотез"]);
await courseWithLectures(polina, "Философия", 212, ["Логика", "Этика", "Эстетика"]);
await courseWithLectures(artem, "Экономика", 150, ["Спрос и предложение", "Рынок", "Деньги"]);
for (const p of [lena, dima, igor, artem, oleg, polina]) await preview(p, g1);

// Демо-аккаунт: открыт предпросмотр для ЭК-21; доступы и запросы
await preview(demo, g2);
const shares = await api("POST", "/api/collections/lecture_shares/records", igor.token, { lecture: igorPhil[3], owner: igor.id, grantee: demo.id, group: g1, allow_copy: false });
await api("POST", "/api/collections/lecture_shares/records", lena.token, { lecture: lenaLaw[0], owner: lena.id, grantee: demo.id, group: g1, allow_copy: true });
await api("POST", "/api/collections/lecture_shares/records", igor.token, { lecture: igorLaw[0], owner: igor.id, grantee: demo.id, group: g1, allow_copy: false });
await api("POST", `/api/lectures/${igorPhil[1]}/request-access`, demo.token);
// лекция демо-аккаунта, которую просят
const mine = (await api("GET", `/api/collections/lectures/records?perPage=2&filter=${encodeURIComponent(`owner="${demo.id}"`)}`, demo.token)).items;
if (mine[0]) {
  const rows = (await api("GET", `/api/collections/group_members/records?filter=${encodeURIComponent(`group="${g1}" && user="${demo.id}"`)}`, demo.token)).items;
  await api("PATCH", `/api/collections/group_members/records/${rows[0].id}`, demo.token, { preview_enabled: true });
  await api("POST", `/api/lectures/${mine[0].id}/request-access`, dima.token).catch((e) => console.log("запрос Димы:", String(e).slice(0, 80)));
  await api("POST", `/api/lectures/${mine[0].id}/request-access`, katya.token).catch((e) => console.log("запрос Кати:", String(e).slice(0, 80)));
  await api("PATCH", `/api/collections/group_members/records/${rows[0].id}`, demo.token, { preview_enabled: false });
}
console.log("готово. МК-31:", g1, "ЭК-21:", g2, "код МК-31:", code1.toUpperCase(), "акк. демо:", DEMO.email, shares.id ? "" : "");
