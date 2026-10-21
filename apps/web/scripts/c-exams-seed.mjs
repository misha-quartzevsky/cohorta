// Экзамены группы для скриншотов и ручной проверки (волна C, этап 2). После c-seed.mjs, на той же песочнице:
//   PB_URL=http://127.0.0.1:8092 SUPER_EMAIL=... SUPER_PASS=... node scripts/c-exams-seed.mjs
// Лена создаёт экзамены «Философия» и «Гражданское право», Игорь — «История России»; подгруппа «Девчонки»
// (Лена + демо-аккаунт) и «Дима и Игорь» у философии; «Вечерняя подготовка» (Марина + Катя) у права.
const PB = process.env.PB_URL ?? "http://127.0.0.1:8092";
const DEMO = { email: "asyaobraz17@gmail.com", password: "12345678" };
const PASS = "Test-pass-12345";

async function api(method, url, token, body, allowFail = false) {
  const r = await fetch(PB + url, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) {
    if (allowFail) return null;
    throw new Error(`${method} ${url} ${r.status} ${text}`);
  }
  return text ? JSON.parse(text) : {};
}
const login = async (email, password) => {
  const r = await api("POST", "/api/collections/users/auth-with-password", null, { identity: email, password });
  return { token: r.token, id: r.record.id, name: r.record.name };
};
const su = (await api("POST", "/api/collections/_superusers/auth-with-password", null, { identity: process.env.SUPER_EMAIL, password: process.env.SUPER_PASS })).token;
const users = (await api("GET", `/api/collections/users/records?perPage=200&filter=${encodeURIComponent('email ~ "gseed-"')}`, su)).items;
const by = {};
for (const u of users) by[u.name] = await login(u.email, PASS);
const demo = await login(DEMO.email, DEMO.password);
const { "Лена Орлова": lena, "Дима Ершов": dima, "Игорь Власов": igor, "Марина Белова": marina, "Катя Соколова": katya } = by;
const g1 = (await api("GET", `/api/collections/groups/records?filter=${encodeURIComponent('name="МК-31"')}`, demo.token)).items[0].id;

const myCourse = async (p, name) => (await api("GET", `/api/collections/courses/records?filter=${encodeURIComponent(`owner="${p.id}" && name="${name}"`)}`, p.token)).items[0];
async function exam(p, name, date, questions) {
  const c = (await myCourse(p, name)) ?? (await api("POST", "/api/collections/courses/records", p.token, { name, owner: p.id, slug: `gx-${Math.random().toString(36).slice(2, 8)}`, cover_seed: 100 }));
  const e = await api("POST", "/api/collections/exams/records", p.token, { course: c.id, owner: p.id, title: "Экзамен", group: g1, mode: "group", exam_date: date });
  for (let i = 0; i < questions.length; i += 1) {
    await api("POST", "/api/collections/exam_tickets/records", p.token, { exam: e.id, number: i + 1, question: questions[i], status: "empty" });
  }
  return e.id;
}
const phil = ["Античная философия: основные школы", "Сократ и сократический метод", "Платон: учение об идеях", "Аристотель: метафизика", "Философия Средних веков", "Рационализм Нового времени", "Эмпиризм", "Немецкая классическая философия", "Экзистенциализм", "Современная философия"];
const eP = await exam(lena, "Философия", "2027-01-12 00:00:00.000Z", phil);
const eH = await exam(igor, "История России", "2027-01-20 00:00:00.000Z", ["Киевская Русь", "Монгольское нашествие", "Московское царство", "Империя", "Реформы 1860-х"]);
const eL = await exam(lena, "Гражданское право", "2027-01-25 00:00:00.000Z", ["Понятие и виды сделок", "Основания недействительности", "Оферта и акцепт", "Заключение и расторжение договора"]);

const girls = (await api("POST", `/api/exams/${eP}/subgroups`, lena.token, { name: "Девчонки", members: [demo.id] })).id;
await api("POST", `/api/exams/${eP}/subgroups`, dima.token, { name: "Дима и Игорь", members: [igor.id] });
await api("POST", `/api/exams/${eL}/subgroups`, marina.token, { name: "Вечерняя подготовка", members: [katya.id] });

const tickets = (await api("GET", `/api/collections/exam_tickets/records?perPage=50&sort=number&filter=${encodeURIComponent(`subgroup="${girls}"`)}`, demo.token)).items;
const ans = (t) => `<p>Ответ на билет «${t.question}». Оферта — адресованное одному или нескольким лицам предложение, достаточно определённое и выражающее намерение заключить договор.</p>`;
await api("PATCH", `/api/collections/exam_tickets/records/${tickets[0].id}`, lena.token, { answer: ans(tickets[0]), status: "ready" });
await api("PATCH", `/api/collections/exam_tickets/records/${tickets[1].id}`, lena.token, { answer: ans(tickets[1]), status: "ready" });
await api("PATCH", `/api/collections/exam_tickets/records/${tickets[2].id}`, lena.token, { answer: ans(tickets[2]), status: "draft" });
await api("POST", `/api/tickets/${tickets[0].id}/assign`, demo.token, { users: [demo.id] });
await api("POST", `/api/tickets/${tickets[1].id}/assign`, demo.token, { users: [lena.id] });
await api("POST", `/api/tickets/${tickets[2].id}/assign`, demo.token, { users: [demo.id, lena.id] });
await api("POST", `/api/tickets/${tickets[3].id}/assign`, demo.token, { users: [lena.id] });
console.log(JSON.stringify({ philosophy: eP, history: eH, law: eL, girls, busyTicket: tickets[2].id, lena: lena.id, ticket3: tickets[2].id }));
