/**
 * deck_cards.lecture (B5, миграция 1790008000): карточку можно привязать только к своей лекции,
 * чужая колода по-прежнему закрыта, при удалении лекции карточка остаётся с пустым полем.
 * Напрямую с PocketBase, одноразовые пользователи, в конце всё удаляется.
 */
import { test, expect, type APIRequestContext } from "@playwright/test";

const PB = process.env.PB_URL ?? "http://127.0.0.1:8090";
const stamp = Date.now();
const PASSWORD = "Test-pass-12345";

interface Session {
  id: string;
  token: string;
}

async function register(request: APIRequestContext, tag: string): Promise<Session> {
  const email = `b5-card-lec-${tag}-${stamp}@example.test`;
  const created = await request.post(`${PB}/api/collections/users/records`, {
    data: { email, password: PASSWORD, passwordConfirm: PASSWORD, name: `B5 ${tag}` },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const auth = await request.post(`${PB}/api/collections/users/auth-with-password`, {
    data: { identity: email, password: PASSWORD },
  });
  const body = await auth.json();
  return { id: body.record.id, token: body.token };
}

const h = (s: Session) => ({ Authorization: s.token });

test.describe("карточка колоды: необязательная лекция", () => {
  let a: Session;
  let b: Session;
  let lectureA = "";
  let lectureB = "";
  let deckA = "";

  test.beforeAll(async ({ request }) => {
    a = await register(request, "a");
    b = await register(request, "b");
    for (const [s, tag] of [[a, "a"], [b, "b"]] as const) {
      const r = await request.post(`${PB}/api/collections/lectures/records`, {
        headers: h(s),
        data: { title: `Лекция ${tag}`, slug: `b5-cl-${tag}-${stamp}`, content: "<p>т</p>", owner: s.id },
      });
      expect(r.ok(), await r.text()).toBeTruthy();
      if (tag === "a") lectureA = (await r.json()).id;
      else lectureB = (await r.json()).id;
    }
    const d = await request.post(`${PB}/api/collections/decks/records`, {
      headers: h(a),
      data: { title: "Колода A", slug: `b5-cl-deck-${stamp}`, owner: a.id },
    });
    expect(d.ok(), await d.text()).toBeTruthy();
    deckA = (await d.json()).id;
  });

  test.afterAll(async ({ request }) => {
    if (deckA) await request.delete(`${PB}/api/collections/decks/records/${deckA}`, { headers: h(a) });
    for (const [s, id] of [[a, lectureA], [b, lectureB]] as const) {
      if (id) await request.delete(`${PB}/api/collections/lectures/records/${id}`, { headers: h(s) });
    }
    for (const s of [a, b]) {
      if (s) await request.delete(`${PB}/api/collections/users/records/${s.id}`, { headers: h(s) });
    }
  });

  const card = (lecture?: string) => ({ deck: deckA, front: "<p>в</p>", back: "<p>о</p>", ...(lecture ? { lecture } : {}) });

  test("без лекции и со своей лекцией карточка создаётся", async ({ request }) => {
    const plain = await request.post(`${PB}/api/collections/deck_cards/records`, { headers: h(a), data: card() });
    expect(plain.ok(), await plain.text()).toBeTruthy();
    expect((await plain.json()).lecture).toBe("");
    const own = await request.post(`${PB}/api/collections/deck_cards/records`, { headers: h(a), data: card(lectureA) });
    expect(own.ok(), await own.text()).toBeTruthy();
    expect((await own.json()).lecture).toBe(lectureA);
  });

  test("чужую лекцию выбрать нельзя ни при создании, ни при правке", async ({ request }) => {
    const res = await request.post(`${PB}/api/collections/deck_cards/records`, { headers: h(a), data: card(lectureB) });
    expect(res.ok()).toBeFalsy();
    const own = await request.post(`${PB}/api/collections/deck_cards/records`, { headers: h(a), data: card() });
    const id = (await own.json()).id;
    const upd = await request.patch(`${PB}/api/collections/deck_cards/records/${id}`, {
      headers: h(a),
      data: { lecture: lectureB },
    });
    expect(upd.ok()).toBeFalsy();
  });

  test("чужой пользователь не видит и не меняет карточку", async ({ request }) => {
    const own = await request.post(`${PB}/api/collections/deck_cards/records`, { headers: h(a), data: card(lectureA) });
    const id = (await own.json()).id;
    expect((await request.get(`${PB}/api/collections/deck_cards/records/${id}`, { headers: h(b) })).ok()).toBeFalsy();
    const upd = await request.patch(`${PB}/api/collections/deck_cards/records/${id}`, {
      headers: h(b),
      data: { lecture: lectureB },
    });
    expect(upd.ok()).toBeFalsy();
  });

  test("при удалении лекции карточка остаётся, поле очищается", async ({ request }) => {
    const l = await request.post(`${PB}/api/collections/lectures/records`, {
      headers: h(a),
      data: { title: "Временная", slug: `b5-cl-tmp-${stamp}`, content: "<p>т</p>", owner: a.id },
    });
    const lid = (await l.json()).id;
    const c = await request.post(`${PB}/api/collections/deck_cards/records`, { headers: h(a), data: card(lid) });
    const cid = (await c.json()).id;
    const del = await request.delete(`${PB}/api/collections/lectures/records/${lid}`, { headers: h(a) });
    expect(del.ok(), await del.text()).toBeTruthy();
    const after = await request.get(`${PB}/api/collections/deck_cards/records/${cid}`, { headers: h(a) });
    expect(after.ok()).toBeTruthy();
    expect((await after.json()).lecture).toBe("");
  });
});
