/**
 * Волна C: код приглашения при создании группы (форма «Новая группа»): сервер выдаёт случайный свободный код,
 * код из формы становится кодом группы, занятый код заменяется новым без ошибки, чужих кодов не узнать, частота ограничена.
 * API-тесты на одноразовых аккаунтах (без браузера). Запуск — как у group-access.spec.ts.
 */
import { test, expect } from "@playwright/test";
import { PB, h, register, cleanup, join, type Session } from "./group-api";

const FORMAT = /^[2-9a-hjkmnp-z]{8}$/; // 8 знаков, без 0, o, 1, i, l

async function newCode(request: any, s: Session) {
  const r = await request.post(`${PB}/api/groups/new-code`, { headers: h(s) });
  return r;
}
async function create(request: any, s: Session, name: string, code?: string) {
  return request.post(`${PB}/api/groups/create`, { headers: h(s), data: { name, ...(code ? { code } : {}) } });
}
async function inviteOf(request: any, s: Session, group: string) {
  const r = await request.get(`${PB}/api/groups/${group}/invite`, { headers: h(s) });
  return { status: r.status(), code: r.ok() ? ((await r.json()).code as string) : "" };
}

test.describe.configure({ mode: "serial" });

test.describe("код приглашения при создании группы", () => {
  let a: Session;
  let b: Session;
  let c: Session;
  let x: Session; // посторонний
  const groups: string[] = [];

  test.beforeAll(async ({ request }) => {
    [a, b, c, x] = await Promise.all(["a", "b", "c", "x"].map((t) => register(request, `code-${t}`)));
  });
  test.afterAll(async ({ request }) => cleanup(request, [a, b, c, x], groups));

  test("код создаётся: 8 знаков без путаемых 0/o и 1/i/l, случайный, не по названию", async ({ request }) => {
    const seen = new Set<string>();
    for (const s of [a, b, c, x]) {
      for (let i = 0; i < 8; i += 1) {
        const r = await newCode(request, s);
        expect(r.ok(), await r.text()).toBeTruthy();
        const code = (await r.json()).code as string;
        expect(code, "формат").toMatch(FORMAT);
        seen.add(code);
      }
    }
    expect(seen.size, "коды не повторяются").toBe(32);
    // код не зависит от названия: у «МК-31» не появляется «mk31…»
    const r = await create(request, a, "МК-31");
    expect(r.ok(), await r.text()).toBeTruthy();
    const body = await r.json();
    groups.push(body.id);
    expect(body.code).toMatch(FORMAT);
    expect(body.code.startsWith("mk31")).toBeFalsy();
  });

  test("без входа код не выдаётся", async ({ request }) => {
    expect((await request.post(`${PB}/api/groups/new-code`)).status()).toBe(401);
    expect((await request.post(`${PB}/api/groups/create`, { data: { name: "Гость", code: "23456789" } })).status()).toBe(401);
  });

  test("после «Создать группу» код в настройках совпадает с тем, что был в форме; ссылка по умолчанию закрыта", async ({ request }) => {
    const shown = (await (await newCode(request, b)).json()).code as string;
    const r = await create(request, b, "Группа с кодом из формы", shown);
    expect(r.ok(), await r.text()).toBeTruthy();
    const body = await r.json();
    groups.push(body.id);
    expect(body.code).toBe(shown);
    expect((await inviteOf(request, b, body.id)).code).toBe(shown);
    // ссылка закрыта, пока владелец не включил: вступить нельзя и узнать, что группа есть, тоже
    expect((await join(request, c, shown)).status()).toBe(404);
    expect((await request.post(`${PB}/api/groups/${body.id}/invite/enable`, { headers: h(b), data: { enabled: true } })).ok()).toBeTruthy();
    // регистр и дефис в коде не важны: «2345-6789» = «23456789»
    const spaced = `${shown.slice(0, 4)}-${shown.slice(4)}`.toUpperCase();
    expect((await join(request, c, spaced)).ok(), "вступление по коду с дефисом").toBeTruthy();
  });

  test("два одновременных создания с одним кодом: оба успешны, коды разные, ни одна группа не падает", async ({ request }) => {
    const shown = (await (await newCode(request, a)).json()).code as string;
    const [r1, r2] = await Promise.all([create(request, a, "Параллельная 1", shown), create(request, c, "Параллельная 2", shown)]);
    expect(r1.ok(), await r1.text()).toBeTruthy();
    expect(r2.ok(), await r2.text()).toBeTruthy();
    const [b1, b2] = [await r1.json(), await r2.json()];
    groups.push(b1.id, b2.id);
    expect(b1.code).not.toBe(b2.code);
    expect([b1.code, b2.code].filter((x) => x === shown).length, "ровно одна получила код из формы").toBe(1);
    expect((await inviteOf(request, a, b1.id)).code).toBe(b1.code);
    expect((await inviteOf(request, c, b2.id)).code).toBe(b2.code);
  });

  test("занятый код заменяется новым и показывается человеку; чужая группа не затронута", async ({ request }) => {
    const first = await (await create(request, a, "Первая")).json();
    groups.push(first.id);
    const r = await create(request, b, "Вторая с чужим кодом", first.code);
    expect(r.ok(), await r.text()).toBeTruthy();
    const second = await r.json();
    groups.push(second.id);
    expect(second.code).not.toBe(first.code);
    expect(second.code).toMatch(FORMAT);
    expect((await inviteOf(request, a, first.id)).code, "код первой группы цел").toBe(first.code);
    expect((await inviteOf(request, b, second.id)).code).toBe(second.code);
    // непригодный код из формы (мусор, не тот формат) тоже не роняет создание
    const junk = await create(request, b, "С мусорным кодом", "0O1Il!!");
    expect(junk.ok(), await junk.text()).toBeTruthy();
    const jb = await junk.json();
    groups.push(jb.id);
    expect(jb.code).toMatch(FORMAT);
  });

  test("посторонний не получает коды чужих групп: ни кода, ни списка, ни перебора", async ({ request }) => {
    const owned = await (await create(request, c, "Закрытая для постороннего")).json();
    groups.push(owned.id);
    // маршрут кода: постороннему группы нет, участнику-не-владельцу отказ
    expect((await inviteOf(request, x, owned.id)).status).toBe(404);
    // в записи группы и в списках кода нет
    const rec = await request.get(`${PB}/api/collections/groups/records/${owned.id}`, { headers: h(x) });
    expect(rec.ok()).toBeFalsy();
    const listed = await request.get(`${PB}/api/collections/groups/records`, { headers: h(x), params: { perPage: "200" } });
    expect(JSON.stringify(await listed.json())).not.toContain(owned.code);
    const byCode = await request.get(`${PB}/api/collections/groups/records`, { headers: h(x), params: { filter: `invite_code="${owned.code}"` } });
    expect(((await byCode.json()).items ?? []).length).toBe(0);
    // свежие коды не совпадают с существующими (коды чужих групп не отдаются и не «угадываются» повтором)
    for (let i = 0; i < 10; i += 1) expect((await (await newCode(request, x)).json()).code).not.toBe(owned.code);
    // создание с чужим кодом ничего не раскрывает: человек получает свой новый код, чужого не видит
    const probe = await create(request, x, "Проба", owned.code);
    const pb = await probe.json();
    groups.push(pb.id);
    expect(pb.code).not.toBe(owned.code);
    expect(JSON.stringify(pb)).not.toContain(owned.code);
  });

  test("участник группы не видит и не меняет ссылку-приглашение", async ({ request }) => {
    const grp = await (await create(request, a, "Группа для участника")).json();
    groups.push(grp.id);
    expect((await request.post(`${PB}/api/groups/${grp.id}/invite/enable`, { headers: h(a), data: { enabled: true } })).ok()).toBeTruthy();
    expect((await join(request, b, grp.code)).ok()).toBeTruthy();
    // код не виден: ни маршрутом, ни в записи группы
    expect((await inviteOf(request, b, grp.id)).status).toBe(403);
    const rec = await (await request.get(`${PB}/api/collections/groups/records/${grp.id}`, { headers: h(b) })).json();
    expect(rec).not.toHaveProperty("invite_code");
    // и не меняется: сброс, включение и выключение, прямая правка записи
    expect((await request.post(`${PB}/api/groups/${grp.id}/invite/reset`, { headers: h(b) })).status()).toBe(403);
    expect((await request.post(`${PB}/api/groups/${grp.id}/invite/enable`, { headers: h(b), data: { enabled: false } })).status()).toBe(403);
    const patch = await request.patch(`${PB}/api/collections/groups/records/${grp.id}`, { headers: h(b), data: { invite_enabled: false, invite_code: "22222222", name: "Взлом" } });
    expect(patch.ok(), "правка группы участником").toBeFalsy();
    // у владельца всё осталось как было
    expect((await inviteOf(request, a, grp.id)).code).toBe(grp.code);
    expect((await join(request, c, grp.code)).ok(), "ссылка по-прежнему включена").toBeTruthy();
  });

  test("сброс кода: новый код выдаётся из того же алфавита, старый перестаёт работать", async ({ request }) => {
    const grp = await (await create(request, a, "Сброс")).json();
    groups.push(grp.id);
    await request.post(`${PB}/api/groups/${grp.id}/invite/enable`, { headers: h(a), data: { enabled: true } });
    const reset = await request.post(`${PB}/api/groups/${grp.id}/invite/reset`, { headers: h(a) });
    const fresh = (await reset.json()).code as string;
    expect(fresh).toMatch(FORMAT);
    expect(fresh).not.toBe(grp.code);
    expect((await join(request, x, grp.code)).status(), "старый код").toBe(404);
    expect((await join(request, x, fresh)).ok(), "новый код").toBeTruthy();
  });

  test("частота запросов ограничена", async ({ request }) => {
    const z = await register(request, "code-rate");
    let limited = 0;
    for (let i = 0; i < 25; i += 1) if ((await newCode(request, z)).status() === 429) limited += 1;
    expect(limited, "после 20 запросов за 10 минут отказ").toBeGreaterThanOrEqual(4);
    let creates = 0;
    for (let i = 0; i < 12; i += 1) {
      const r = await create(request, z, `Спам ${i}`);
      if (r.ok()) groups.push((await r.json()).id);
      else if (r.status() === 429) creates += 1;
    }
    expect(creates, "создание групп тоже ограничено").toBeGreaterThanOrEqual(1);
    await cleanup(request, [z]);
  });
});
