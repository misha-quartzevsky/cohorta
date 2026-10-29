/**
 * ============================================
 *  tests/security-groups.spec.ts — поиск групп и подбор кодов (B-5, B-7)
 * ============================================
 *
 * Аудит 2026-10. Без браузера, через API.
 *  - GET /api/groups/search удалён: он перечислял названия и id всех групп (в том числе с закрытой ссылкой).
 *  - POST /api/groups/join: не больше 20 запросов за 10 минут на пользователя, GET /api/groups/preview: не больше 40.
 *    Обычное вступление (join из group-screens, group-code) укладывается в лимит с большим запасом.
 */
import { test, expect } from "@playwright/test";
import { PB, cleanup, createGroup, h, join, register } from "./group-api";

test("маршрута поиска групп нет: ни названий, ни id", async ({ request }) => {
  const owner = await register(request, "srch-owner");
  const other = await register(request, "srch-other");
  const g = await createGroup(request, owner, "Уникальное-имя-для-поиска", false);
  const r = await request.get(`${PB}/api/groups/search`, { headers: h(other), params: { q: "Уникальное" } });
  expect(r.status()).toBe(404);
  expect(await r.text()).not.toContain(g.id);
  await cleanup(request, [owner, other], [g.id]);
});

test("preview: после 40 запросов за окно приходит 429, у другого пользователя лимит свой", async ({ request }) => {
  const a = await register(request, "rl-prev");
  const b = await register(request, "rl-prev-other");
  const statuses: number[] = [];
  for (let i = 0; i < 45; i += 1) {
    const r = await request.get(`${PB}/api/groups/preview`, { headers: h(a), params: { code: `ZZZZ${String(i).padStart(4, "0")}` } });
    statuses.push(r.status());
  }
  expect(statuses.slice(0, 40).every((s) => s === 404), "первые 40: код не найден").toBeTruthy();
  expect(statuses.slice(40), "дальше отказ по частоте").toEqual([429, 429, 429, 429, 429]);
  const fresh = await request.get(`${PB}/api/groups/preview`, { headers: h(b), params: { code: "ZZZZ9999" } });
  expect(fresh.status()).toBe(404);
  await cleanup(request, [a, b]);
});

test("join: после 20 запросов за окно приходит 429; нормальное вступление работает", async ({ request }) => {
  const owner = await register(request, "rl-join-owner");
  const a = await register(request, "rl-join");
  const g = await createGroup(request, owner, "Лимит вступления", true);
  const code = (await (await request.get(`${PB}/api/groups/${g.id}/invite`, { headers: h(owner) })).json()).code as string;
  const ok = await join(request, a, code);
  expect(ok.status(), await ok.text()).toBe(200);

  const statuses: number[] = [];
  for (let i = 0; i < 24; i += 1) statuses.push((await join(request, a, `ZZZZ${String(i).padStart(4, "0")}`)).status());
  // 1 успешное вступление + 19 неверных кодов = 20, дальше отказ
  expect(statuses.slice(0, 19).every((s) => s === 404)).toBeTruthy();
  expect(statuses.slice(19)).toEqual([429, 429, 429, 429, 429]);
  await cleanup(request, [owner, a], [g.id]);
});
