/**
 * Волна C, этап 1: правила доступа в группе (раздел 5 инструкции, приёмка).
 *
 * Работает напрямую с PocketBase (без браузера): одноразовые тестовые
 * аккаунты, чужие данные не трогаются. В конце всё убирается (если задан
 * суперпользователь SUPER_EMAIL/SUPER_PASS — им, иначе самими аккаунтами).
 *
 * Запуск (на копии базы, не на данных пользователей):
 *   PB_URL=http://127.0.0.1:8091 npx playwright test tests/group-access.spec.ts
 *
 * Каждая проверка написана так, чтобы падать, если правило ослабить
 * (см. scripts/c-mutations.mjs: он ослабляет правила по одному и гоняет тесты).
 */
import { test, expect, type APIRequestContext, type APIResponse } from "@playwright/test";

const PB = process.env.PB_URL ?? "http://127.0.0.1:8090";
const stamp = Date.now();
const PASSWORD = "Test-pass-12345";

interface Session {
  id: string;
  token: string;
  email: string;
}

const h = (s: Session) => ({ Authorization: s.token });

async function register(request: APIRequestContext, tag: string): Promise<Session> {
  const email = `c-group-${tag}-${stamp}@example.test`;
  const created = await request.post(`${PB}/api/collections/users/records`, {
    data: { email, password: PASSWORD, passwordConfirm: PASSWORD, name: `C ${tag}` },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const auth = await request.post(`${PB}/api/collections/users/auth-with-password`, {
    data: { identity: email, password: PASSWORD },
  });
  expect(auth.ok()).toBeTruthy();
  const body = await auth.json();
  return { id: body.record.id, token: body.token, email };
}

async function createGroup(request: APIRequestContext, s: Session, name: string) {
  const r = await request.post(`${PB}/api/groups/create`, { headers: h(s), data: { name } });
  expect(r.ok(), await r.text()).toBeTruthy();
  const group = (await r.json()) as { id: string; name: string };
  // новая группа создаётся с закрытой ссылкой; для вступления по коду владелец её открывает
  const on = await request.post(`${PB}/api/groups/${group.id}/invite/enable`, { headers: h(s), data: { enabled: true } });
  expect(on.ok(), await on.text()).toBeTruthy();
  return group;
}

async function inviteCode(request: APIRequestContext, s: Session, groupId: string): Promise<string> {
  const r = await request.get(`${PB}/api/groups/${groupId}/invite`, { headers: h(s) });
  expect(r.ok(), await r.text()).toBeTruthy();
  return (await r.json()).code as string;
}

async function join(request: APIRequestContext, s: Session, code: string): Promise<APIResponse> {
  return request.post(`${PB}/api/groups/join`, { headers: h(s), data: { code } });
}

async function createLecture(
  request: APIRequestContext,
  s: Session,
  title: string,
  groupId?: string
): Promise<string> {
  const r = await request.post(`${PB}/api/collections/lectures/records`, {
    headers: h(s),
    data: {
      title,
      slug: `c-${title.replace(/\W+/g, "")}-${stamp}`,
      content: "<p>секретный текст конспекта</p>",
      owner: s.id,
      ...(groupId ? { group: groupId } : {}),
    },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  return (await r.json()).id as string;
}

async function myMembership(request: APIRequestContext, s: Session, groupId: string) {
  const r = await request.get(`${PB}/api/collections/group_members/records`, {
    headers: h(s),
    params: { filter: `group="${groupId}" && user="${s.id}"` },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  return (await r.json()).items[0] as { id: string };
}

async function setPreview(request: APIRequestContext, s: Session, groupId: string, on: boolean) {
  const m = await myMembership(request, s, groupId);
  const r = await request.patch(`${PB}/api/collections/group_members/records/${m.id}`, {
    headers: h(s),
    data: { preview_enabled: on },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
}

async function canGetLecture(request: APIRequestContext, s: Session, id: string): Promise<boolean> {
  const r = await request.get(`${PB}/api/collections/lectures/records/${id}`, { headers: h(s) });
  return r.ok();
}

async function lectureListIds(request: APIRequestContext, s: Session, filter = ""): Promise<string[]> {
  const r = await request.get(`${PB}/api/collections/lectures/records`, {
    headers: h(s),
    params: { perPage: "200", ...(filter ? { filter } : {}) },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  return ((await r.json()).items as { id: string }[]).map((x) => x.id);
}

async function previews(request: APIRequestContext, s: Session, groupId?: string) {
  const r = await request.get(`${PB}/api/collections/lecture_previews/records`, {
    headers: h(s),
    params: { perPage: "200", ...(groupId ? { filter: `group="${groupId}"` } : {}) },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  return (await r.json()).items as { lecture: string; title: string; preview_text?: string }[];
}

async function grant(request: APIRequestContext, owner: Session, lectureId: string, grantee: Session, group = "") {
  return request.post(`${PB}/api/collections/lecture_shares/records`, {
    headers: h(owner),
    data: { lecture: lectureId, owner: owner.id, grantee: grantee.id, group },
  });
}

test.describe.configure({ mode: "serial" });

test.describe("группа: правила доступа", () => {
  let a: Session; // автор лекций и владелец группы 1
  let b: Session; // участник группы 1
  let c: Session; // посторонний
  let d: Session; // владелец группы 2
  let e: Session; // новичок, вступает по коду
  let w: Session; // ещё один участник группы 1 (получатель подделанной выдачи)
  let g1 = "";
  let g2 = "";
  let code1 = "";
  let l1 = ""; // лекция A в группе 1
  let l2 = ""; // лекция A в группе 2
  const cleanup: { collection: string; id: string }[] = [];

  test.beforeAll(async ({ request }) => {
    [a, b, c, d, e, w] = await Promise.all(["a", "b", "c", "d", "e", "w"].map((t) => register(request, t)));
    g1 = (await createGroup(request, a, `C-группа-1-${stamp}`)).id;
    g2 = (await createGroup(request, d, `C-группа-2-${stamp}`)).id;
    code1 = await inviteCode(request, a, g1);
    const jb = await join(request, b, code1);
    expect(jb.ok(), await jb.text()).toBeTruthy();
    const jw = await join(request, w, code1);
    expect(jw.ok(), await jw.text()).toBeTruthy();
    // A состоит ещё и в группе 2
    const code2 = await inviteCode(request, d, g2);
    const ja = await join(request, a, code2);
    expect(ja.ok(), await ja.text()).toBeTruthy();

    l1 = await createLecture(request, a, "Секретная лекция группа 1", g1);
    l2 = await createLecture(request, a, "Секретная лекция группа 2", g2);
  });

  test.afterAll(async ({ request }) => {
    const su = process.env.SUPER_EMAIL;
    if (su) {
      const auth = await request.post(`${PB}/api/collections/_superusers/auth-with-password`, {
        data: { identity: su, password: process.env.SUPER_PASS ?? "" },
      });
      if (auth.ok()) {
        const token = (await auth.json()).token;
        for (const s of [a, b, c, d, e, w]) {
          if (!s) continue;
          await request.delete(`${PB}/api/collections/users/records/${s.id}`, { headers: { Authorization: token } });
        }
        for (const g of [g1, g2]) {
          if (g) await request.delete(`${PB}/api/collections/groups/records/${g}`, { headers: { Authorization: token } });
        }
        return;
      }
    }
    for (const s of [a, b, c, d, e, w]) {
      if (s) await request.delete(`${PB}/api/collections/users/records/${s.id}`, { headers: h(s) });
    }
    void cleanup;
  });

  test("чужая лекция без доступа: getOne и getList отказ, даже если id угадан", async ({ request }) => {
    for (const s of [b, c, d, e]) {
      const one = await request.get(`${PB}/api/collections/lectures/records/${l1}`, { headers: h(s) });
      expect(one.status(), "getOne чужой лекции").toBe(404);
      expect(await lectureListIds(request, s, `id="${l1}"`), "getList по угаданному id").toEqual([]);
      const ids = await lectureListIds(request, s);
      expect(ids).not.toContain(l1);
      expect(ids).not.toContain(l2);
    }
    // без входа тоже закрыто
    const anon = await request.get(`${PB}/api/collections/lectures/records/${l1}`);
    expect(anon.status()).toBe(404);
  });

  test("лекция без владельца (владельца удалили) не становится публичной", async ({ request }) => {
    const su = process.env.SUPER_EMAIL;
    test.skip(!su, "нужен SUPER_EMAIL/SUPER_PASS: аккаунт удаляется суперпользователем");
    const auth = await request.post(`${PB}/api/collections/_superusers/auth-with-password`, {
      data: { identity: su, password: process.env.SUPER_PASS ?? "" },
    });
    const token = (await auth.json()).token as string;
    const x = await register(request, "x");
    const orphan = await createLecture(request, x, "Лекция удалённого автора");
    // владельца удаляют, не трогая его записи: relation owner обнуляется
    const del = await request.delete(`${PB}/api/collections/users/records/${x.id}`, { headers: { Authorization: token } });
    expect(del.ok(), await del.text()).toBeTruthy();
    const check = await request.get(`${PB}/api/collections/lectures/records/${orphan}`, { headers: { Authorization: token } });
    if (check.ok()) expect((await check.json()).owner, "владелец обнулён").toBe("");
    for (const s of [b, c]) {
      expect(await canGetLecture(request, s, orphan), "лекция без владельца").toBe(false);
      expect(await lectureListIds(request, s)).not.toContain(orphan);
    }
    const anon = await request.get(`${PB}/api/collections/lectures/records/${orphan}`);
    expect(anon.status(), "без входа").toBe(404);
    await request.delete(`${PB}/api/collections/lectures/records/${orphan}`, { headers: { Authorization: token } });
  });

  test("нельзя создать лекцию «за другого» или отдать лекцию без владельца", async ({ request }) => {
    const forged = await request.post(`${PB}/api/collections/lectures/records`, {
      headers: h(c),
      data: { title: "подложная", slug: `c-forged-${stamp}`, content: "", owner: a.id },
    });
    expect(forged.ok(), "создание от имени другого").toBeFalsy();
    const ownerless = await request.post(`${PB}/api/collections/lectures/records`, {
      headers: h(c),
      data: { title: "ничья", slug: `c-ownerless-${stamp}`, content: "" },
    });
    expect(ownerless.ok(), "создание без владельца").toBeFalsy();
    const mine = await createLecture(request, c, "Моя лекция C");
    const drop = await request.patch(`${PB}/api/collections/lectures/records/${mine}`, {
      headers: h(c),
      data: { owner: "" },
    });
    expect(drop.ok(), "сброс владельца").toBeFalsy();
    const give = await request.patch(`${PB}/api/collections/lectures/records/${mine}`, {
      headers: h(c),
      data: { owner: b.id },
    });
    expect(give.ok(), "передача лекции другому владельцу").toBeFalsy();
    await request.delete(`${PB}/api/collections/lectures/records/${mine}`, { headers: h(c) });
  });

  test("нельзя открыть себе чужую лекцию, создав выдачу доступа «от себя»", async ({ request }) => {
    const forged = await request.post(`${PB}/api/collections/lecture_shares/records`, {
      headers: h(c),
      data: { lecture: l1, owner: c.id, grantee: c.id, group: g1 },
    });
    expect(forged.ok(), "подделанная выдача на чужую лекцию").toBeFalsy();
    const forged2 = await request.post(`${PB}/api/collections/lecture_shares/records`, {
      headers: h(b),
      data: { lecture: l1, owner: b.id, grantee: c.id, group: g1 },
    });
    expect(forged2.ok(), "участник не автор лекции").toBeFalsy();
    const forged3 = await request.post(`${PB}/api/collections/lecture_shares/records`, {
      headers: h(b),
      data: { lecture: l1, owner: a.id, grantee: b.id, group: g1 },
    });
    expect(forged3.ok(), "выдача «от имени автора»").toBeFalsy();
    // участник группы выдаёт доступ к чужой лекции другому участнику той же группы:
    // общая группа есть (хук пропустит), значит держит именно правило «лекция моя»
    const forged4 = await request.post(`${PB}/api/collections/lecture_shares/records`, {
      headers: h(b),
      data: { lecture: l1, owner: b.id, grantee: w.id, group: g1 },
    });
    expect(forged4.ok(), "выдача на чужую лекцию участнику своей группы").toBeFalsy();
    expect(await canGetLecture(request, w, l1)).toBe(false);
    expect(await canGetLecture(request, c, l1)).toBe(false);
    expect(await canGetLecture(request, b, l1)).toBe(false);
  });

  test("название чужой лекции видно только при включённом предпросмотре в этой группе", async ({ request }) => {
    // по умолчанию выключен
    const m = await myMembership(request, a, g1);
    const row = await (
      await request.get(`${PB}/api/collections/group_members/records/${m.id}`, { headers: h(a) })
    ).json();
    expect(row.preview_enabled).toBe(false);
    expect(await previews(request, b, g1)).toEqual([]);

    await setPreview(request, a, g1, true);
    const seen = await previews(request, b, g1);
    // предпросмотр на группу: видны названия всех лекций автора (не только привязанных к группе)
    expect(seen.map((p) => p.lecture).sort()).toEqual([l1, l2].sort());
    expect(seen.find((p) => p.lecture === l1)?.title).toBe("Секретная лекция группа 1");
    // текст лекции в превью не попадает, сама лекция по-прежнему закрыта
    expect(seen.every((p) => String(p.preview_text ?? "") === "")).toBeTruthy();
    expect(JSON.stringify(seen)).not.toContain("секретный текст");
    expect(await canGetLecture(request, b, l1)).toBe(false);
    // посторонний не видит и превью
    expect(await previews(request, c)).toEqual([]);
    expect((await previews(request, d)).map((p) => p.lecture)).not.toContain(l1);

    await setPreview(request, a, g1, false);
    expect(await previews(request, b, g1)).toEqual([]);
  });

  test("номер и дата лекции в предпросмотре видны только там, где виден предпросмотр", async ({ request }) => {
    const upd = await request.patch(`${PB}/api/collections/lectures/records/${l1}`, {
      headers: h(a),
      data: { number: 5, lecture_date: "2026-10-11 00:00:00.000Z" },
    });
    expect(upd.ok(), await upd.text()).toBeTruthy();
    // предпросмотр выключен: ни строки, ни полей
    expect(await previews(request, b, g1)).toEqual([]);
    await setPreview(request, a, g1, true);
    const row = (await previews(request, b, g1)).find((p) => p.lecture === l1) as Record<string, unknown>;
    expect(row.lecture_number).toBe(5);
    expect(String(row.lecture_date)).toContain("2026-10-11");
    // правка лекции обновляет и превью
    await request.patch(`${PB}/api/collections/lectures/records/${l1}`, { headers: h(a), data: { number: 6 } });
    expect(((await previews(request, b, g1)).find((p) => p.lecture === l1) as Record<string, unknown>).lecture_number).toBe(6);
    // не участник группы и участник другой группы не видят ни строки, ни полей
    expect(await previews(request, c)).toEqual([]);
    const direct = await request.get(`${PB}/api/collections/lecture_previews/records`, { headers: h(c), params: { fields: "lecture_number,lecture_date" } });
    expect((await direct.json()).items).toEqual([]);
    // чужой не может записать номер в превью
    const forge = await request.patch(`${PB}/api/collections/lecture_previews/records/${(row as { id?: string }).id}`, {
      headers: h(b),
      data: { lecture_number: 99 },
    });
    expect(forge.ok(), "правка превью через API").toBeFalsy();
    // выключили предпросмотр: строка, а с ней и поля, исчезли
    await setPreview(request, a, g1, false);
    expect(await previews(request, b, g1)).toEqual([]);
  });

  test("человек в двух группах: предпросмотр у каждой группы свой", async ({ request }) => {
    await setPreview(request, a, g1, true); // только группа 1
    const both = [l1, l2].sort();
    expect((await previews(request, b)).map((p) => p.lecture).sort()).toEqual(both);
    expect(await previews(request, d)).toEqual([]); // группа 2 не включена

    await setPreview(request, a, g2, true);
    expect((await previews(request, d)).map((p) => p.lecture).sort()).toEqual(both); // своя группа
    expect((await previews(request, b)).map((p) => p.lecture).sort()).toEqual(both);

    await setPreview(request, a, g1, false);
    expect(await previews(request, b)).toEqual([]);
    expect((await previews(request, d)).map((p) => p.lecture).sort()).toEqual(both); // группа 2 включена независимо
    await setPreview(request, a, g2, false);
    expect(await previews(request, d)).toEqual([]);
  });

  test("доступ выдаёт и снимает только автор; читает автор и получатель", async ({ request }) => {
    const ok = await grant(request, a, l1, b, g1);
    expect(ok.ok(), await ok.text()).toBeTruthy();
    const shareId = (await ok.json()).id as string;

    expect(await canGetLecture(request, b, l1)).toBe(true);
    expect(await lectureListIds(request, b)).toContain(l1);
    expect(await canGetLecture(request, c, l1)).toBe(false);

    const read = (s: Session) =>
      request.get(`${PB}/api/collections/lecture_shares/records/${shareId}`, { headers: h(s) });
    expect((await read(a)).ok(), "автор читает").toBeTruthy();
    expect((await read(b)).ok(), "получатель читает").toBeTruthy();
    expect((await read(c)).status(), "посторонний читает").toBe(404);
    expect((await read(d)).status()).toBe(404);

    // получатель не снимает и не правит выдачу, не выдаёт дальше
    const del = await request.delete(`${PB}/api/collections/lecture_shares/records/${shareId}`, { headers: h(b) });
    expect(del.ok(), "получатель снял доступ").toBeFalsy();
    const upd = await request.patch(`${PB}/api/collections/lecture_shares/records/${shareId}`, {
      headers: h(b),
      data: { grantee: c.id },
    });
    expect(upd.ok(), "получатель правит выдачу").toBeFalsy();
    const upd2 = await request.patch(`${PB}/api/collections/lecture_shares/records/${shareId}`, {
      headers: h(a),
      data: { grantee: c.id },
    });
    expect(upd2.ok(), "автор переписывает получателя").toBeFalsy();
    expect((await grant(request, b, l1, c, g1)).ok(), "получатель выдаёт дальше").toBeFalsy();
    expect(await canGetLecture(request, c, l1)).toBe(false);
    // не участнику группы автора выдать нельзя
    expect((await grant(request, a, l1, c, g1)).ok(), "выдача постороннему вне группы").toBeFalsy();
    // себе выдать нельзя
    expect((await grant(request, a, l1, a, g1)).ok(), "выдача самому себе").toBeFalsy();

    // автор снимает — получатель снова не видит
    const rm = await request.delete(`${PB}/api/collections/lecture_shares/records/${shareId}`, { headers: h(a) });
    expect(rm.ok(), await rm.text()).toBeTruthy();
    expect(await canGetLecture(request, b, l1)).toBe(false);
    expect(await lectureListIds(request, b)).not.toContain(l1);
  });

  test("вступление по коду: новичок не видит ни одной чужой лекции, список групп и коды", async ({ request }) => {
    // до вступления прямое создание членства закрыто (нельзя вступить по id, без кода)
    const direct = await request.post(`${PB}/api/collections/group_members/records`, {
      headers: h(e),
      data: { group: g1, user: e.id },
    });
    expect(direct.ok(), "вступление в обход кода").toBeFalsy();
    const gl0 = await request.get(`${PB}/api/collections/groups/records`, { headers: h(e) });
    expect((await gl0.json()).items).toEqual([]);

    // предпросмотр включён у автора: вступление всё равно ничего не открывает кроме названия
    await setPreview(request, a, g1, false);
    const j = await join(request, e, code1);
    expect(j.ok(), await j.text()).toBeTruthy();

    expect(await lectureListIds(request, e)).toEqual([]);
    expect(await canGetLecture(request, e, l1)).toBe(false);
    expect(await canGetLecture(request, e, l2)).toBe(false);
    expect(await previews(request, e)).toEqual([]);

    // видит только свою группу, и без кода
    const gl = await request.get(`${PB}/api/collections/groups/records`, { headers: h(e) });
    const groups = (await gl.json()).items as Record<string, unknown>[];
    expect(groups.map((g) => g.id)).toEqual([g1]);
    expect(JSON.stringify(groups)).not.toContain(code1);
    expect(groups[0]).not.toHaveProperty("invite_code");
    const other = await request.get(`${PB}/api/collections/groups/records/${g2}`, { headers: h(e) });
    expect(other.status()).toBe(404);
    // маршрута поиска групп нет (B-5, tests/security-groups.spec.ts)
    const search = await request.get(`${PB}/api/groups/search`, { headers: h(e), params: { q: "C-группа" } });
    expect(search.status()).toBe(404);
    // перепрыгнуть в другую группу сменой строки членства нельзя
    const mine = await myMembership(request, e, g1);
    const hop = await request.patch(`${PB}/api/collections/group_members/records/${mine.id}`, {
      headers: h(e),
      data: { group: g2 },
    });
    expect(hop.ok(), "смена группы в строке членства").toBeFalsy();
    // чужие профили закрыты (только через ростер своей группы)
    const u = await request.get(`${PB}/api/collections/users/records/${a.id}`, { headers: h(e) });
    expect(u.status()).toBe(404);
    const ul = await request.get(`${PB}/api/collections/users/records`, { headers: h(e) });
    expect(((await ul.json()).items as { id: string }[]).map((x) => x.id)).toEqual([e.id]);
  });

  test("ростер: имена одногруппников без почты и кодов; посторонний отказ", async ({ request }) => {
    const r = await request.get(`${PB}/api/groups/${g1}/roster`, { headers: h(b) });
    expect(r.ok()).toBeTruthy();
    const body = JSON.stringify(await r.json());
    expect(body).toContain("C a");
    expect(body).not.toContain("@example.test");
    expect(body).not.toContain(code1);
    expect((await request.get(`${PB}/api/groups/${g1}/roster`, { headers: h(c) })).status()).toBe(403);
  });

  test("код приглашения видит, копирует и сбрасывает только владелец", async ({ request }) => {
    expect(await inviteCode(request, a, g1)).toBe(code1);
    // участник: отказ; посторонний: группа не раскрывается
    expect((await request.get(`${PB}/api/groups/${g1}/invite`, { headers: h(b) })).status()).toBe(403);
    expect((await request.get(`${PB}/api/groups/${g1}/invite`, { headers: h(c) })).status()).toBe(404);
    expect((await request.post(`${PB}/api/groups/${g1}/invite/reset`, { headers: h(b) })).status()).toBe(403);
    expect((await request.post(`${PB}/api/groups/${g1}/invite/reset`, { headers: h(c) })).status()).toBe(404);
    // в обычном API кода нет ни у участника, ни у владельца
    for (const s of [a, b]) {
      const r = await request.get(`${PB}/api/collections/groups/records/${g1}`, { headers: h(s) });
      expect(r.ok()).toBeTruthy();
      expect(JSON.stringify(await r.json())).not.toContain(code1);
    }
    // по фильтру код тоже не угадать
    const probe = await request.get(`${PB}/api/collections/groups/records`, {
      headers: h(b),
      params: { filter: `invite_code="${code1}"` },
    });
    if (probe.ok()) expect((await probe.json()).items).toEqual([]);
    // участник не меняет код и владельца напрямую
    const patch = await request.patch(`${PB}/api/collections/groups/records/${g1}`, {
      headers: h(b),
      data: { invite_code: "hacked99" },
    });
    expect(patch.ok()).toBeFalsy();
    const own = await request.patch(`${PB}/api/collections/groups/records/${g1}`, {
      headers: h(a),
      data: { invite_code: "hacked99" },
    });
    // скрытое поле PocketBase молча игнорирует при записи; главное — код не изменился
    if (own.ok()) expect(await inviteCode(request, a, g1), "код правкой через API").toBe(code1);

    // сброс: старый код нерабочий, участники остаются
    const f = await register(request, "f");
    const reset = await request.post(`${PB}/api/groups/${g1}/invite/reset`, { headers: h(a) });
    expect(reset.ok(), await reset.text()).toBeTruthy();
    const fresh = (await reset.json()).code as string;
    expect(fresh).not.toBe(code1);
    expect((await join(request, f, code1)).status(), "старый код после сброса").toBe(404);
    expect((await join(request, f, fresh)).ok()).toBeTruthy();
    const roster = await (await request.get(`${PB}/api/groups/${g1}/roster`, { headers: h(a) })).json();
    expect((roster as { user: { id: string } }[]).map((x) => x.user.id)).toEqual(
      expect.arrayContaining([a.id, b.id, e.id, f.id])
    );
    code1 = fresh;
    await request.delete(`${PB}/api/collections/users/records/${f.id}`, { headers: h(f) });
  });

  test("лекция в корзине закрыта для одногруппников, после восстановления снова доступна", async ({ request }) => {
    const ok = await grant(request, a, l1, b, g1);
    expect(ok.ok(), await ok.text()).toBeTruthy();
    await setPreview(request, a, g1, true);
    expect(await canGetLecture(request, b, l1)).toBe(true);
    expect((await previews(request, b, g1)).map((p) => p.lecture)).toContain(l1);

    const del = await request.post(`${PB}/api/trash/delete`, { headers: h(a), data: { type: "lecture", id: l1 } });
    expect(del.ok(), await del.text()).toBeTruthy();
    expect(await canGetLecture(request, b, l1), "после удаления в корзину").toBe(false);
    expect(await lectureListIds(request, b)).not.toContain(l1);
    expect((await previews(request, b, g1)).map((p) => p.lecture), "превью из корзины").not.toContain(l1);

    const restore = await request.post(`${PB}/api/trash/restore`, { headers: h(a), data: { type: "lecture", id: l1 } });
    expect(restore.ok(), await restore.text()).toBeTruthy();
    expect(await canGetLecture(request, b, l1), "после восстановления").toBe(true);
    expect((await previews(request, b, g1)).map((p) => p.lecture)).toContain(l1);

    // убираем за собой доступ и предпросмотр
    const shares = await (
      await request.get(`${PB}/api/collections/lecture_shares/records`, { headers: h(a), params: { filter: `lecture="${l1}"` } })
    ).json();
    for (const s of shares.items as { id: string }[]) {
      await request.delete(`${PB}/api/collections/lecture_shares/records/${s.id}`, { headers: h(a) });
    }
    await setPreview(request, a, g1, false);
  });

  test("владелец: выйти и удалить аккаунт можно только передав группу", async ({ request }) => {
    // выйти напрямую (удалить строку членства) нельзя никому: выход идёт серверной логикой
    for (const s of [a, b]) {
      const m = await myMembership(request, s, g1);
      const del = await request.delete(`${PB}/api/collections/group_members/records/${m.id}`, { headers: h(s) });
      expect(del.ok(), "удаление членства в обход выхода").toBeFalsy();
    }
    // владельца самой группы не удалить напрямую и не сменить в обход передачи
    expect((await request.delete(`${PB}/api/collections/groups/records/${g1}`, { headers: h(a) })).ok()).toBeFalsy();
    expect(
      (await request.patch(`${PB}/api/collections/groups/records/${g1}`, { headers: h(a), data: { owner: b.id } })).ok()
    ).toBeFalsy();

    // удаление аккаунта: владелец группы с участниками получает отказ
    const refuse = await request.post(`${PB}/api/account/delete-request`, { headers: h(a) });
    expect(refuse.status()).toBe(409);
    expect((await refuse.json()).code).toBe("group_owner");

    // передать может только владелец, и только участнику
    expect((await request.post(`${PB}/api/groups/${g1}/transfer`, { headers: h(b), data: { user: b.id } })).status()).toBe(403);
    expect((await request.post(`${PB}/api/groups/${g1}/transfer`, { headers: h(c), data: { user: c.id } })).status()).toBe(404);
    expect((await request.post(`${PB}/api/groups/${g1}/transfer`, { headers: h(a), data: { user: c.id } })).status()).toBe(400);
    expect((await request.post(`${PB}/api/groups/${g1}/transfer`, { headers: h(a), data: { user: a.id } })).status()).toBe(400);

    // передали: новый владелец видит код, прежний — нет
    const t = await request.post(`${PB}/api/groups/${g1}/transfer`, { headers: h(a), data: { user: b.id } });
    expect(t.ok(), await t.text()).toBeTruthy();
    expect((await request.get(`${PB}/api/groups/${g1}/invite`, { headers: h(b) })).ok()).toBeTruthy();
    expect((await request.get(`${PB}/api/groups/${g1}/invite`, { headers: h(a) })).status()).toBe(403);
    // у остальных (e) в группе осталось не-владельцем; прежний владелец теперь обычный участник
    // и всё ещё владеет только своими лекциями
    expect(await canGetLecture(request, a, l1)).toBe(true);
    expect(await canGetLecture(request, b, l1)).toBe(false);

    // передав группу, прежний владелец может запросить удаление аккаунта
    const allowed = await request.post(`${PB}/api/account/delete-request`, { headers: h(a) });
    expect(allowed.ok(), await allowed.text()).toBeTruthy();
    await request.post(`${PB}/api/account/delete-cancel`, { headers: h(a) });

    // возвращаем, чтобы последующие проверки (если будут) шли с прежним владельцем
    const back = await request.post(`${PB}/api/groups/${g1}/transfer`, { headers: h(b), data: { user: a.id } });
    expect(back.ok(), await back.text()).toBeTruthy();
  });
});
