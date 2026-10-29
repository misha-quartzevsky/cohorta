/**
 * ============================================
 *  tests/security-delete.spec.ts — удаление пользователя, выход автора экзамена (A-1, B-3, B-4)
 * ============================================
 *
 * Аудит 2026-10. Без браузера, через API.
 *  - users.deleteRule = null (миграция 1790014000): аккаунт удаляется только маршрутом и ночной задачей.
 *    Прямой DELETE владельца группы раньше сносил группу и экзамены её участников каскадом.
 *  - exams.group больше не cascadeDelete: удаление группы не стирает экзамены.
 *  - выход и исключение автора: его экзамен группы становится личным (group = ""), его подгруппы и
 *    чужие участники снимаются; участник группы билетов больше не видит. Экзамен автора не удаляется.
 *  Для проверки состояния нужен суперпользователь песочницы (SUPER_EMAIL, SUPER_PASS).
 */
import { test, expect } from "@playwright/test";
import { PB, cleanup, createCourse, createExam, createTicket, groupWith, h, list, register, superToken } from "./group-api";

const asSuper = async (request: import("@playwright/test").APIRequestContext, su: string, collection: string, filter: string) =>
  (((await (await request.get(`${PB}/api/collections/${collection}/records`, { headers: { Authorization: su }, params: { filter } })).json()).items ?? []) as Record<string, any>[]);

test("DELETE своей записи владельцем группы с участником отказан; группа и участник на месте", async ({ request }) => {
  const owner = await register(request, "del-owner");
  const member = await register(request, "del-member");
  const g = await groupWith(request, owner, [member], "Удаление");

  const del = await request.delete(`${PB}/api/collections/users/records/${owner.id}`, { headers: h(owner) });
  expect([400, 403, 404], `DELETE users → ${del.status()}`).toContain(del.status());
  expect(await list(request, member, "groups", `id="${g.id}"`)).toHaveLength(1);
  expect((await request.get(`${PB}/api/collections/users/records/${owner.id}`, { headers: h(owner) })).status()).toBe(200);
  await cleanup(request, [owner, member], [g.id]);
});

test("выход автора: его экзамен становится личным, участник билетов не видит", async ({ request }) => {
  test.skip(!process.env.SUPER_EMAIL, "нужен суперпользователь песочницы");
  const su = (await superToken(request)) as string;
  const owner = await register(request, "leave-owner");
  const author = await register(request, "leave-author");
  const member = await register(request, "leave-member");
  const g = await groupWith(request, owner, [author, member], "Выход автора");
  const exam = await createExam(request, author, await createCourse(request, author, "Предмет автора"), g.id);
  await createTicket(request, author, exam, 1, "Вопрос один");
  expect(await list(request, member, "exam_tickets", `exam="${exam}"`), "до выхода участник видит билеты").toHaveLength(1);

  const left = await request.post(`${PB}/api/groups/${g.id}/leave`, { headers: h(author), data: {} });
  expect(left.ok(), await left.text()).toBeTruthy();

  expect(await list(request, member, "exam_tickets", `exam="${exam}"`), "после выхода билетов не видно").toHaveLength(0);
  const rows = await asSuper(request, su, "exams", `id="${exam}"`);
  expect(rows, "экзамен автора не удалён").toHaveLength(1);
  expect(rows[0].group || "", "экзамен личный").toBe("");
  expect(await list(request, author, "exam_tickets", `exam="${exam}"`), "автор видит свои билеты").toHaveLength(1);
  await cleanup(request, [owner, author, member], [g.id]);
});

test("исключение автора владельцем группы тоже отвязывает экзамен", async ({ request }) => {
  test.skip(!process.env.SUPER_EMAIL, "нужен суперпользователь песочницы");
  const su = (await superToken(request)) as string;
  const owner = await register(request, "kick-owner");
  const author = await register(request, "kick-author");
  const member = await register(request, "kick-member");
  const g = await groupWith(request, owner, [author, member], "Исключение автора");
  const exam = await createExam(request, author, await createCourse(request, author, "Предмет автора"), g.id);
  await createTicket(request, author, exam, 1, "Вопрос");

  const kick = await request.post(`${PB}/api/groups/${g.id}/kick`, { headers: h(owner), data: { user: author.id } });
  expect(kick.ok(), await kick.text()).toBeTruthy();
  expect(await list(request, member, "exam_tickets", `exam="${exam}"`)).toHaveLength(0);
  const rows = await asSuper(request, su, "exams", `id="${exam}"`);
  expect(rows).toHaveLength(1);
  expect(rows[0].group || "").toBe("");
  await cleanup(request, [owner, author, member], [g.id]);
});

test("удаление пустой группы не сносит экзамен автора", async ({ request }) => {
  test.skip(!process.env.SUPER_EMAIL, "нужен суперпользователь песочницы");
  const su = (await superToken(request)) as string;
  const author = await register(request, "empty-author");
  const g = await groupWith(request, author, [], "Пустая");
  const exam = await createExam(request, author, await createCourse(request, author, "Предмет"), g.id);
  await createTicket(request, author, exam, 1, "Вопрос");

  const left = await request.post(`${PB}/api/groups/${g.id}/leave`, { headers: h(author), data: {} });
  expect(left.ok(), await left.text()).toBeTruthy();
  expect(await asSuper(request, su, "groups", `id="${g.id}"`), "группа удалена").toHaveLength(0);
  const rows = await asSuper(request, su, "exams", `id="${exam}"`);
  expect(rows, "экзамен автора остался").toHaveLength(1);
  expect(rows[0].group || "").toBe("");
  expect(await list(request, author, "exam_tickets", `exam="${exam}"`)).toHaveLength(1);
  await cleanup(request, [author]);
});

test("прямое удаление группы (cascadeDelete выключен) не сносит экзамен", async ({ request }) => {
  test.skip(!process.env.SUPER_EMAIL, "нужен суперпользователь песочницы");
  const su = (await superToken(request)) as string;
  const author = await register(request, "casc-author");
  const g = await groupWith(request, author, [], "Каскад");
  const exam = await createExam(request, author, await createCourse(request, author, "Предмет"), g.id);

  const del = await request.delete(`${PB}/api/collections/groups/records/${g.id}`, { headers: { Authorization: su } });
  expect(del.ok(), await del.text()).toBeTruthy();
  const rows = await asSuper(request, su, "exams", `id="${exam}"`);
  expect(rows, "экзамен остался").toHaveLength(1);
  expect(rows[0].group || "").toBe("");
  await cleanup(request, [author]);
});
