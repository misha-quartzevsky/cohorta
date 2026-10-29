// Скриншоты экранов для сверки «до/после» рефакторинга (десктоп 1440 и телефон 390).
// Запуск из apps/web: node scripts/dev/refactor-shots.mjs [папка] [http://localhost:5173] [http://127.0.0.1:8090]
// Папка по умолчанию — <tmp>/cohorta-shots/<время>; относительный путь считается от текущего каталога.
// Нужны PocketBase (копия БД, node scripts/e2e-sandbox.mjs) и Vite; вход демо-аккаунтом через API, без UI
// (учётные данные: DEMO_EMAIL и DEMO_PASSWORD, их печатает e2e-sandbox.mjs). Время в браузере зафиксировано, анимации выключены.
import { firefox } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const out = resolve(process.cwd(), process.argv[2] ?? join(tmpdir(), "cohorta-shots", new Date().toISOString().replace(/[:.]/g, "-")));
const web = process.argv[3] ?? "http://localhost:5173";
const pbUrl = process.argv[4] ?? "http://127.0.0.1:8090";
mkdirSync(out, { recursive: true });

const auth = await (
  await fetch(`${pbUrl}/api/collections/users/auth-with-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identity: process.env.DEMO_EMAIL, password: process.env.DEMO_PASSWORD }),
  })
).json();
if (!auth.token) throw new Error("вход не удался");
const get = async (path) => (await (await fetch(`${pbUrl}${path}`, { headers: { Authorization: auth.token } })).json()).items ?? [];

const sems = await get("/api/collections/semesters/records?perPage=50");
const courses = await get("/api/collections/courses/records?perPage=50&expand=semesters");
const lectures = await get("/api/collections/lectures/records?perPage=200&sort=-updated");
const course = courses.find((c) => lectures.some((l) => l.field === c.id)) ?? courses[0];
const lecture = lectures.find((l) => l.field === course?.id) ?? lectures[0];
const semId = course?.semesters || sems[0]?.id;
const sem = sems.find((s) => s.id === semId) ?? sems[0];
const S = sem?.slug ?? "1";
const C = course?.slug || course?.id;
const L = lecture?.slug || lecture?.id;
console.log("sem", S, "course", C, "lecture", L);

const routes = {
  home: "/",
  lectures: `/s/${S}/lectures`,
  course: `/s/${S}/${C}`,
  lecture: `/s/${S}/${C}/${L}`,
  exam: `/s/${S}/${C}/exam`,
  pairs: `/s/${S}/${C}/pairs`,
  schedule: "/schedule",
  tasks: "/tasks",
  decks: "/decks",
  settings: "/settings",
  periods: "/settings/periods",
  courses: `/s/${S}/courses`,
  notes: "/notes",
  exams: `/s/${S}/exams`,
  drafts: `/s/${S}/drafts`,
  trash: "/trash",
  more: "/more",
  group: `/s/${S}/group`,
  groupnew: `/s/${S}/group/new`,
  login: "/login",
  privacy: "/privacy",
};

const browser = await firefox.launch({ headless: true });
for (const [vp, size] of [["d", { width: 1440, height: 900 }], ["m", { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: size });
  await ctx.clock.setFixedTime(new Date("2026-10-28T12:00:00"));
  await ctx.addInitScript(
    ([token, record]) => {
      if (!location.pathname.startsWith("/login")) {
        localStorage.setItem("pocketbase_auth", JSON.stringify({ token, record }));
      }
      localStorage.setItem("cohorta:mode", "solo");
    },
    [auth.token, auth.record]
  );
  for (const [name, path] of Object.entries(routes)) {
    const page = await ctx.newPage();
    try {
      await page.goto(web + path, { waitUntil: "networkidle", timeout: 30000 });
      await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${out}/${vp}-${name}.png`, fullPage: false });
    } catch (e) {
      console.log("не удалось", vp, name, String(e).split("\n")[0]);
    }
    await page.close();
  }
  await ctx.close();
}
await browser.close();
console.log("готово:", out);
