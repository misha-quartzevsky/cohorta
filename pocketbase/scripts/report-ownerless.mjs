/**
 * Только чтение. Отчёт по записям без владельца перед миграцией 1790009000:
 * считает лекции, предметы и колоды с пустым owner и говорит, что миграция сделает с каждой группой.
 * Выводит только id и числа (без названий, текстов и личных данных).
 *
 *   PB_URL=https://<адрес-pocketbase> SUPER_EMAIL=... SUPER_PASS=... node pocketbase/scripts/report-ownerless.mjs
 *
 * Ничего не меняет: только GET-запросы.
 */
const PB = process.env.PB_URL;
if (!PB || !process.env.SUPER_EMAIL) {
  console.error("Нужны PB_URL, SUPER_EMAIL, SUPER_PASS");
  process.exit(1);
}

const auth = await fetch(`${PB}/api/collections/_superusers/auth-with-password`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identity: process.env.SUPER_EMAIL, password: process.env.SUPER_PASS }),
});
if (!auth.ok) throw new Error(`вход: ${auth.status}`);
const token = (await auth.json()).token;

async function all(collection, filter, fields) {
  const out = [];
  for (let page = 1; ; page += 1) {
    const url = `${PB}/api/collections/${collection}/records?page=${page}&perPage=200&filter=${encodeURIComponent(filter)}&fields=${fields}`;
    const r = await fetch(url, { headers: { Authorization: token } });
    if (!r.ok) throw new Error(`${collection}: ${r.status}`);
    const body = await r.json();
    out.push(...body.items);
    if (page >= body.totalPages) return out;
  }
}

const lectures = await all("lectures", 'owner = ""', "id,field");
const courses = await all("courses", 'owner = ""', "id");
const decks = await all("decks", 'owner = ""', "id");

const withCourse = [];
const orphanCourse = [];
const noCourse = [];
const courseCache = new Map();
for (const l of lectures) {
  if (!l.field) {
    noCourse.push(l.id);
    continue;
  }
  if (!courseCache.has(l.field)) {
    const r = await fetch(`${PB}/api/collections/courses/records/${l.field}?fields=id,owner`, { headers: { Authorization: token } });
    courseCache.set(l.field, r.ok ? (await r.json()).owner || "" : "");
  }
  (courseCache.get(l.field) ? withCourse : orphanCourse).push(l.id);
}

console.log(`Лекции без владельца: ${lectures.length}`);
console.log(`  A. есть предмет с владельцем → миграция назначит владельца предмета: ${withCourse.length}`);
console.log(`  Б. предмет без владельца или удалён → станут недоступны никому (останутся в базе): ${orphanCourse.length}`);
console.log(`  В. без предмета → станут недоступны никому (останутся в базе): ${noCourse.length}`);
console.log(`Предметы без владельца: ${courses.length} (станут недоступны никому)`);
console.log(`Колоды без владельца: ${decks.length} (станут недоступны никому)`);
for (const [name, ids] of [["A", withCourse], ["Б", orphanCourse], ["В", noCourse]]) {
  if (ids.length) console.log(`id группы ${name}: ${ids.join(", ")}`);
}
