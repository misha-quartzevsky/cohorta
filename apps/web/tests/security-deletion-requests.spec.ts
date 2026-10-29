/**
 * ============================================
 *  tests/security-deletion-requests.spec.ts — запросы на удаление аккаунта (A-11)
 * ============================================
 *
 * Аудит 2026-10. Без браузера, через API. Раньше клиент сам создавал запись deletion_requests со своими
 * status, scheduled_for и email: запись со сроком в прошлом заставляла ночную задачу стереть аккаунт без
 * 14 дней отсрочки. Миграция 1790016000: createRule = null, запись создаёт только маршрут
 * POST /api/account/delete-request (срок +14 дней, email из аккаунта). Поток «Удалить аккаунт» в
 * /settings (account-hygiene.spec) идёт через маршрут и не меняется.
 */
import { test, expect } from "@playwright/test";
import { PB, cleanup, h, list, register } from "./group-api";

test("запись deletion_requests клиентом не создаётся, в том числе со сроком в прошлом", async ({ request }) => {
  const a = await register(request, "delreq");
  for (const data of [
    { user: a.id, email: a.email, status: "new", scheduled_for: "2020-01-01 00:00:00.000Z" },
    { user: a.id, email: "чужая@почта.test", status: "new" },
    { user: a.id },
  ]) {
    const r = await request.post(`${PB}/api/collections/deletion_requests/records`, { headers: h(a), data });
    expect([400, 403, 404], `${JSON.stringify(data)} → ${r.status()}`).toContain(r.status());
  }
  expect(await list(request, a, "deletion_requests")).toHaveLength(0);
  await cleanup(request, [a]);
});

test("маршрут delete-request ставит срок через 14 дней, отмена закрывает запись", async ({ request }) => {
  const a = await register(request, "delreq-route");
  const r = await request.post(`${PB}/api/account/delete-request`, { headers: h(a), data: {} });
  expect(r.status(), await r.text()).toBe(200);
  const when = new Date(String((await r.json()).scheduled_for).replace(" ", "T")).getTime();
  const days = (when - Date.now()) / 86400000;
  expect(days).toBeGreaterThan(13.9);
  expect(days).toBeLessThan(14.1);

  const rows = await list(request, a, "deletion_requests", 'status="new"');
  expect(rows).toHaveLength(1);
  expect(rows[0].email).toBe(a.email);

  const cancel = await request.post(`${PB}/api/account/delete-cancel`, { headers: h(a), data: {} });
  expect(cancel.ok()).toBeTruthy();
  expect(await list(request, a, "deletion_requests", 'status="new"')).toHaveLength(0);
  await cleanup(request, [a]);
});
