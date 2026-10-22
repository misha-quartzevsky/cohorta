// Руками в браузере: импорт билетов (соло и группа), диалог «Добавить билет», «Выйти из подгруппы», посторонний.
//   PB_URL=http://127.0.0.1:8092 SUPER_EMAIL=… SUPER_PASS=… node scripts/c-import-flow.mjs <папка для снимков> '<json из c-exams-seed.mjs>'
// Песочница 8092 с данными c-seed.mjs и c-exams-seed.mjs, приложение на 5174. Меняет данные песочницы.
import { chromium } from "playwright";

const OUT = process.argv[2];
const ids = JSON.parse(process.argv[3]);
const BASE = process.env.BASE ?? "http://127.0.0.1:5174";
const PB = process.env.PB_URL ?? "http://127.0.0.1:8092";
const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "ПРОШЛО   " : "НЕ ПРОШЛО"}  ${name}${extra ? `  [${extra}]` : ""}`);
};
async function api(method, url, token, body) {
  const r = await fetch(PB + url, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = {}; }
  return { status: r.status, json };
}
const login = async (identity, password) => {
  const r = await api("POST", "/api/collections/users/auth-with-password", null, { identity, password });
  return { token: r.json.token, id: r.json.record.id };
};
const demo = await login("asyaobraz17@gmail.com", "12345678");
const mk = (await api("GET", `/api/collections/groups/records?filter=${encodeURIComponent('name="МК-31"')}`, demo.token)).json.items[0].id;

// предмет с экзаменом и тремя билетами для соло-импорта
const slug = `imp-${Date.now()}`;
const course = (await api("POST", "/api/collections/courses/records", demo.token, { name: "Гражданское право (импорт)", owner: demo.id, slug, cover_seed: 60 })).json;
const exam = (await api("POST", "/api/collections/exams/records", demo.token, { course: course.id, owner: demo.id, title: "Экзамен", mode: "solo", exam_date: "2027-01-12 00:00:00.000Z" })).json;
for (let i = 1; i <= 3; i += 1) await api("POST", "/api/collections/exam_tickets/records", demo.token, { exam: exam.id, number: i, question: `Старый билет ${i}`, status: "empty" });

const browser = await chromium.launch();
const shots = (p, phone) => (name) => p.screenshot({ path: `${OUT}/${name}${phone ? "-m" : ""}.png` });
const text = async (p) => (await p.locator("body").innerText()).replace(/\s+/g, " ");

async function session(w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 500 ? 2 : 1 });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`);
  await p.fill('input[type="email"]', "asyaobraz17@gmail.com");
  await p.fill('input[type="password"]', "12345678");
  await p.click('button[type="submit"]');
  await p.waitForURL(/\/s\//, { timeout: 20000 });
  await p.evaluate((g) => localStorage.setItem("cohorta:group", g), mk);
  return { ctx, p };
}

try {
  // ---------- десктоп ----------
  {
    const { p } = await session(1440, 900);
    const shot = shots(p, false);
    await p.evaluate(() => localStorage.setItem("cohorta:mode", "solo"));
    await p.goto(`${BASE}/s/demo/${slug}/exam`);
    await p.waitForTimeout(1800);
    await shot("solo-exam");
    const btns = await p.locator(".c-exam-tickets-card .c-exam-card-head .actions button").allInnerTexts();
    check("соло-экзамен: «Импорт» между «Шпаргалка» и «Добавить билет»", JSON.stringify(btns.map((x) => x.trim())) === JSON.stringify(["Конспекты предмета", "Шпаргалка", "Импорт", "Добавить билет"]), btns.join(" | "));

    // диалог «Добавить билет»
    await p.getByRole("button", { name: "Добавить билет" }).first().click();
    await p.waitForTimeout(600);
    await shot("add-ticket");
    const link = p.locator(".c-form-dialog .c-form-link-row");
    const box = await link.boundingBox();
    const foot = await p.locator(".c-form-dialog .c-dialog-foot").boundingBox();
    const addBtn = await p.locator(".c-form-dialog .c-dialog-foot .c-btn.primary").boundingBox();
    check("«Вставить список билетов сразу» в одну строку", box && box.height <= 26, `высота ${box?.height}`);
    check("ссылка слева и над строкой кнопок", box && foot && box.y + box.height <= foot.y + 1 && box.x < addBtn.x);
    check("«Добавить» справа, оранжевая единственная", addBtn && addBtn.x > box.x + box.width - 1 || addBtn.x > 700);
    await link.click();
    await p.waitForURL(/\/exam\/import$/);
    await p.waitForTimeout(800);
    await shot("solo-import-empty");
    check("пустое состояние: кнопки «Добавить» нет, подсказка есть", (await p.getByRole("button", { name: /Добавить \d+ билет/ }).count()) === 0 && (await text(p)).includes("Здесь появится список после вставки"));
    const resize = await p.locator(".c-import-textarea textarea").evaluate((el) => getComputedStyle(el).resize);
    const minH = (await p.locator(".c-import-textarea textarea").boundingBox()).height;
    check("поле без ручки изменения размера, высота от 200", resize === "none" && minH >= 198, `resize=${resize}, h=${minH}`);

    // 5 строк как в макете
    await p.locator(".c-import-textarea textarea").fill("1. Понятие и виды сделок\n2. Оферта и акцепт\n3. Заключение договора\n4. Недействительность сделок\n5. Представительство и доверенность");
    await p.waitForTimeout(400);
    await p.evaluate(() => window.scrollTo(0, 0));
    await shot("solo-import-5");

    // 27 строк разных форматов при трёх существующих билетах
    const marks = ["1.", "2)", "3 –", "4:", "•", "-", "*", "", "12)", "7 —", "№9", "5."];
    const lines = Array.from({ length: 27 }, (_, i) => `${marks[i % marks.length]} Вопрос ${i + 1}`).join("\n");
    await p.locator(".c-import-textarea textarea").fill(lines);
    await p.waitForTimeout(500);
    const t27 = await text(p);
    check("27 строк: подпись «Найдено 27 билетов»", t27.includes("Найдено 27 билетов"));
    check("27 строк: кнопка «Добавить 27 билетов»", (await p.getByRole("button", { name: "Добавить 27 билетов" }).count()) >= 1);
    const rows = await p.locator(".c-import-preview-row").evaluateAll((els) => els.map((e) => [e.querySelector(".num").textContent, e.querySelector(".q").textContent, e.querySelector(".c-chip, .c-status, [class*=chip]")?.textContent]));
    check("в превью 27 строк с номерами 4…30 и пометкой «Новый»", rows.length === 27 && rows[0][0] === "4" && rows[26][0] === "30" && rows.every((r) => r[2]?.trim() === "Новый"), `${rows[0]} … ${rows[26]}`);
    check("ведущие номера и маркеры убраны из текста", rows.every((r, i) => r[1] === `Вопрос ${i + 1}`));
    await p.mouse.move(700, 500);
    await p.mouse.wheel(0, 1200);
    await p.waitForTimeout(500);
    await shot("solo-import-27-scrolled");
    const stickyBtn = await p.locator(".c-import-head .c-btn.primary").boundingBox();
    check("кнопка «Добавить 27 билетов» остаётся на виду при прокрутке", stickyBtn && stickyBtn.y >= 0 && stickyBtn.y < 120, `y=${stickyBtn?.y}`);
    await p.locator(".c-import-head .c-btn.primary").click();
    await p.waitForURL(/\/exam$/, { timeout: 15000 });
    await p.waitForTimeout(800);
    const tk = (await api("GET", `/api/collections/exam_tickets/records?perPage=100&sort=number&filter=${encodeURIComponent(`exam="${exam.id}"`)}`, demo.token)).json.items;
    check("в экзамене 30 билетов: 3 старых и 27 новых", tk.length === 30);
    check("новые номера 4…30 подряд, в порядке текста, ничего не пропущено", tk.slice(3).every((t, i) => t.number === i + 4 && t.question === `Вопрос ${i + 1}`));
    check("старые билеты не тронуты", tk.slice(0, 3).every((t, i) => t.number === i + 1 && t.question === `Старый билет ${i + 1}`));

    // ---------- группа ----------
    await p.evaluate(() => localStorage.setItem("cohorta:mode", "group"));
    await p.goto(`${BASE}/s/demo/group/exams/${ids.philosophy}`);
    await p.waitForTimeout(1800);
    await shot("group-exam");
    const gb = await p.locator(".c-gx-thead .actions button").allInnerTexts();
    check("экзамен группы: «Импорт» между «Распределить поровну» и «Добавить билет»", JSON.stringify(gb.map((x) => x.trim())) === JSON.stringify(["Распределить поровну", "Импорт", "Добавить билет"]), gb.join(" | "));
    await p.getByRole("button", { name: "Добавить билет" }).click();
    await p.waitForTimeout(600);
    await shot("group-add-ticket");
    check("в группе тот же диалог: поле «Ответ» и ссылка на импорт", (await p.getByText("Ответ · необязательно").count()) === 1 && (await p.locator(".c-form-link-row").count()) === 1);
    await p.locator(".c-form-link-row").click();
    await p.waitForURL(/\/group\/exams\/[^/]+\/import$/);
    await p.waitForTimeout(1000);
    const gt = await text(p);
    check("групповой импорт: крошки, подпись и режим «Группа»", gt.includes("МК-31") && gt.includes("Экзамены группы") && gt.includes("Философия") && gt.includes("Импорт") && /Философия · МК-31 · экзамен 12 января/.test(gt));
    await p.locator(".c-import-textarea textarea").fill("1. Эмпиризм Бэкона\n2) Рационализм Декарта\n3 – Критицизм Канта\n4: Диалектика Гегеля\n• Экзистенциализм");
    await p.waitForTimeout(500);
    await shot("group-import-5");
    const before = (await api("GET", `/api/collections/exam_tickets/records?perPage=100&filter=${encodeURIComponent(`subgroup="${ids.girls}"`)}`, demo.token)).json.items;
    await p.locator(".c-import-head .c-btn.primary").click();
    await p.waitForURL(new RegExp(`/group/exams/${ids.philosophy}$`), { timeout: 15000 });
    await p.waitForTimeout(800);
    const afterG = (await api("GET", `/api/collections/exam_tickets/records?perPage=100&sort=number&filter=${encodeURIComponent(`subgroup="${ids.girls}"`)}`, demo.token)).json.items;
    check("импорт в группе: 5 билетов в моей подгруппе, номера после существующих", afterG.length === before.length + 5 && afterG.slice(-5).every((t, i) => t.number === before.length + i + 1), `было ${before.length}, стало ${afterG.length}`);
    const common = (await api("GET", `/api/collections/exam_tickets/records?perPage=100&filter=${encodeURIComponent(`exam="${ids.philosophy}" && subgroup=""`)}`, demo.token)).json.items;
    check("общий список экзамена не изменился", common.length === 10, String(common.length));
    await shot("group-exam-after");

    // ---------- посторонний ----------
    const email = `imp-x-${Date.now()}@example.test`;
    await api("POST", "/api/collections/users/records", null, { email, password: "Test-pass-12345", passwordConfirm: "Test-pass-12345", name: "Посторонний" });
    const X = await login(email, "Test-pass-12345");
    await api("PATCH", `/api/collections/users/records/${X.id}`, X.token, { onboarding_completed: true });
    const api404 = await api("POST", `/api/subgroups/${ids.girls}/tickets/bulk`, X.token, { questions: ["взлом"] });
    check("посторонний не импортирует (API 404)", api404.status === 404, String(api404.status));
    const afterX = (await api("GET", `/api/collections/exam_tickets/records?perPage=100&filter=${encodeURIComponent(`subgroup="${ids.girls}"`)}`, demo.token)).json.items;
    check("после попытки постороннего билетов не прибавилось", afterX.length === afterG.length);
    const ctxX = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const px = await ctxX.newPage();
    await px.goto(`${BASE}/login`);
    await px.fill('input[type="email"]', email);
    await px.fill('input[type="password"]', "Test-pass-12345");
    await px.click('button[type="submit"]');
    await px.waitForTimeout(3000);
    await px.goto(`${BASE}/s/demo/group/exams/${ids.philosophy}/import`);
    await px.waitForTimeout(2000);
    const tx = await text(px);
    check("посторонний на экране импорта группы: нет формы, нет экзамена", !tx.includes("Вставь список билетов") && !tx.includes("Философия"));
    await ctxX.close();
    await api("DELETE", `/api/collections/users/records/${X.id}`, (await api("POST", "/api/collections/_superusers/auth-with-password", null, { identity: process.env.SUPER_EMAIL, password: process.env.SUPER_PASS })).json.token);

    // телефон: экзамен группы, окно выхода, групповой импорт (пока человек ещё в подгруппе)
    {
      const ph = await session(390, 844);
      const sh = shots(ph.p, true);
      await ph.p.evaluate(() => localStorage.setItem("cohorta:mode", "group"));
      await ph.p.goto(`${BASE}/s/demo/group/exams/${ids.philosophy}`);
      await ph.p.waitForTimeout(1800);
      await sh("group-exam");
      const phBtns = await ph.p.locator(".c-gx-thead .actions button").allInnerTexts();
      check("телефон: в экзамене группы есть «Импорт» рядом с «Добавить билет»", phBtns.map((x) => x.trim()).includes("Импорт"), phBtns.join(" | "));
      await ph.p.getByRole("button", { name: "Выйти из подгруппы" }).click();
      await ph.p.waitForTimeout(700);
      await sh("leave-subgroup");
      await ph.p.keyboard.press("Escape");
      await ph.p.goto(`${BASE}/s/demo/group/exams/${ids.philosophy}/import`);
      await ph.p.waitForTimeout(1200);
      await ph.p.locator(".c-import-textarea textarea").fill("1. Эмпиризм\n2. Рационализм\n3. Критицизм");
      await ph.p.waitForTimeout(500);
      await sh("group-import-3");
      await ph.ctx.close();
    }

    // ---------- выйти из подгруппы ----------
    await p.goto(`${BASE}/s/demo/group/exams/${ids.philosophy}`);
    await p.waitForTimeout(1500);
    check("«Выйти из подгруппы» видна участнику подгруппы", (await p.getByRole("button", { name: "Выйти из подгруппы" }).count()) === 1);
    await p.getByRole("button", { name: "Выйти из подгруппы" }).click();
    await p.waitForTimeout(600);
    await shot("leave-subgroup");
    const dlg = await text(p);
    check("в окне текст из макета и красная кнопка", dlg.includes("Выйти из подгруппы «Девчонки»?") && dlg.includes("В группе ты останешься") && (await p.locator(".c-dialog .c-btn.danger").count()) === 1);
    await p.locator(".c-dialog .c-btn.danger").click();
    await p.waitForTimeout(1800);
    const after = await text(p);
    check("после выхода экран объясняет, что человек не в подгруппе", after.includes("Ты пока не в подгруппе"));
    const mine = (await api("GET", `/api/collections/exam_tickets/records?perPage=100&filter=${encodeURIComponent(`subgroup="${ids.girls}"`)}`, demo.token)).json.items;
    check("билеты подгруппы ему больше не отдаются", mine.length === 0);
    const mem = (await api("GET", `/api/collections/group_members/records?filter=${encodeURIComponent(`group="${mk}" && user="${demo.id}"`)}`, demo.token)).json.items;
    check("из группы он не вышел", mem.length === 1);
    await shot("group-exam-left");
  }

  // ---------- телефон ----------
  {
    const { p } = await session(390, 844);
    const shot = shots(p, true);
    await p.evaluate(() => localStorage.setItem("cohorta:mode", "solo"));
    await p.goto(`${BASE}/s/demo/${slug}/exam`);
    await p.waitForTimeout(1800);
    await shot("solo-exam");
    await p.goto(`${BASE}/s/demo/${slug}/exam/import`);
    await p.waitForTimeout(1000);
    await p.locator(".c-import-textarea textarea").fill("1. Оферта и акцепт\n2. Виды сделок\n3. Форма сделки");
    await p.waitForTimeout(500);
    await shot("solo-import-3");
    check("телефон: подпись «Найдено 3 билета» и кнопка «Добавить 3 билета»", (await text(p)).toLowerCase().includes("найдено 3 билета") && (await p.getByRole("button", { name: "Добавить 3 билета" }).count()) >= 1);
    await p.goto(`${BASE}/s/demo/${slug}/exam`);
    await p.waitForTimeout(1500);
    await p.getByRole("button", { name: "Добавить билет" }).first().click();
    await p.waitForTimeout(700);
    await shot("add-ticket");
    const l = await p.locator(".c-dialog-foot .c-form-link").boundingBox();
    const a = await p.locator(".c-dialog-foot .c-btn.primary").boundingBox();
    check("телефон: ссылка под кнопкой «Добавить», одна строка", l && a && l.y > a.y + a.height - 1 && l.height <= 26, `ссылка y=${l?.y} кнопка y=${a?.y}`);
    await p.keyboard.press("Escape");
    await p.evaluate(() => localStorage.setItem("cohorta:mode", "group"));
    await p.goto(`${BASE}/s/demo/group/exams/${ids.history}`);
    await p.waitForTimeout(1500);
    await shot("group-exam-nosub");
  }
} catch (e) {
  console.log("СБОЙ СКРИПТА:", String(e).slice(0, 600));
  results.push(false);
}
await browser.close();
const bad = results.filter((x) => !x).length;
console.log(`\nИтого: ${results.length - bad} из ${results.length} прошло.`);
process.exit(bad ? 1 : 0);
