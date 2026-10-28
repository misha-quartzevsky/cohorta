/**
 * ============================================
 *  tests/lecture-request-access.spec.ts — запрос доступа к лекции (без браузера)
 * ============================================
 *
 * `POST /api/lectures/{id}/request-access` отказывает (404 «Лекция не найдена.»), если запрашивающий или автор не состоят
 * в группе, где видна лекция. Через интерфейс до проверки членства автора не дойти: при выходе и исключении сервер сам
 * стирает превью автора. Поэтому состояние «превью осталось, а автора в группе нет» создаётся напрямую (нужен суперпользователь
 * песочницы: SUPER_EMAIL/SUPER_PASS) и закрепляет проверку членства автора. Проверка членства самого запрашивающего достижима только вместе с превью
 * в его группе, поэтому отдельно не покрыта. Тест красный, если проверка снята
 * (мутант c-mutations.mjs «запрос доступа от не участника группы»).
 */
import { test, expect } from "@playwright/test";
import { PB, createLecture, groupWith, h, list, register, setPreview, superToken } from "./group-api";

test.describe("запрос доступа: членство в группе", () => {
  test.skip(!process.env.SUPER_EMAIL, "нужен суперпользователь песочницы (SUPER_EMAIL, SUPER_PASS)");

  test("запрос принимается только пока автор и запрашивающий в группе; посторонний и автор вне группы получают 404", async ({ request }) => {
    const a = await register(request, "ra-owner");
    const b = await register(request, "ra-member");
    const outsider = await register(request, "ra-outsider");
    const su = (await superToken(request)) as string;
    expect(su, "вход суперпользователя").toBeTruthy();

    const group = await groupWith(request, a, [b], "Запрос");
    await setPreview(request, a, group.id, true);
    const first = await createLecture(request, a, "Лекция для запроса один");
    const second = await createLecture(request, a, "Лекция для запроса два");
    const ask = (s: typeof a, lecture: string) => request.post(`${PB}/api/lectures/${lecture}/request-access`, { headers: h(s), data: {} });

    // превью лекций созданы: название видно участнику
    await expect
      .poll(async () => (await list(request, b, "lecture_previews", `group="${group.id}"`)).map((p) => p.lecture).sort())
      .toEqual([first, second].sort());

    // посторонний (не в группе) не видит превью, запрос отказан
    const out = await ask(outsider, first);
    expect([out.status(), (await out.json()).message]).toEqual([404, "Лекция не найдена."]);

    // участник группы: запрос принят и создан открытый запрос
    const ok = await ask(b, first);
    expect(ok.status(), await ok.text()).toBe(200);
    expect((await ok.json()).status).toBe("open");

    // автор вышел из группы «в обход» (строка членства удалена, превью осталось): запрос отказан
    const rows = await list(request, a, "group_members", `group="${group.id}" && user="${a.id}"`);
    expect(rows).toHaveLength(1);
    const del = await request.delete(`${PB}/api/collections/group_members/records/${rows[0].id}`, { headers: { Authorization: su } });
    expect(del.ok(), await del.text()).toBeTruthy();
    const asSuper = async (collection: string, filter: string) =>
      (((await (await request.get(`${PB}/api/collections/${collection}/records`, { headers: { Authorization: su }, params: { filter } })).json()).items ?? []) as unknown[]).length;
    expect(await asSuper("lecture_previews", `lecture="${second}"`), "превью второй лекции на месте").toBe(1);

    expect(await asSuper("lectures", `id="${second}"`), "лекция на месте").toBe(1);
    expect(await asSuper("group_members", `group="${group.id}" && user="${b.id}"`), "запрашивающий по-прежнему в группе").toBe(1);
    const denied = await ask(b, second);
    expect([denied.status(), (await denied.json()).message]).toEqual([404, "Лекция не найдена."]);
    expect(await asSuper("access_requests", `lecture="${second}"`), "запрос не создан").toBe(0);
  });
});
