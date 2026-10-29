/**
 * ============================================
 *  tests/security-ownership.spec.ts — смена владельца и родителя при правке (A-4, A-5, A-6, A-7)
 * ============================================
 *
 * Аудит 2026-10. Без браузера, через API. Раньше правило updateRule проверяло старого владельца и не запрещало
 * менять владельца или родителя, так что свою запись можно было подбросить в чужой контейнер
 * (квиз в чужую лекцию, карточку в чужую публичную колоду, задачу в чужой аккаунт).
 * Миграция 1790015000 добавляет `@request.body.<поле>:isset = false` для каждого такого поля.
 * Для каждой коллекции: смена каждого поля отклоняется, обычная правка проходит, запись не изменилась.
 */
import { test, expect, type APIRequestContext } from "@playwright/test";
import { PB, cleanup, createCourse, createExam, createLecture, createTicket, h, register, uid, type Session } from "./group-api";

const rejected = (s: number) => [400, 403, 404].includes(s);

async function post(request: APIRequestContext, s: Session, collection: string, data: Record<string, unknown>): Promise<string> {
  const r = await request.post(`${PB}/api/collections/${collection}/records`, { headers: h(s), data });
  expect(r.ok(), `${collection}: ${await r.text()}`).toBeTruthy();
  return (await r.json()).id as string;
}

/** Набор записей одного пользователя: по нему строятся и «свои» записи, и «чужие» цели подброса. */
async function world(request: APIRequestContext, s: Session) {
  const course = await createCourse(request, s, `Предмет ${uid()}`);
  const lecture = await createLecture(request, s, `Лекция ${uid()}`);
  const deck = await post(request, s, "decks", { title: `Колода ${uid()}`, owner: s.id, is_public: true });
  const card = await post(request, s, "deck_cards", { deck, front: "<p>q</p>", back: "<p>a</p>" });
  const quiz = await post(request, s, "quizzes", { owner: s.id, lecture });
  const question = await post(request, s, "quiz_questions", { owner: s.id, quiz, lecture, type: "recall", prompt: "Вопрос" });
  const answer = await post(request, s, "quiz_answers", { owner: s.id, question, lecture });
  const task = await post(request, s, "tasks", { owner: s.id, title: `Задача ${uid()}` });
  const slot = await post(request, s, "schedule_slots", { owner: s.id, subject: course, weekday: 1, pair_number: 1 });
  const settings = await post(request, s, "schedule_settings", { owner: s.id });
  const slotLecture = await post(request, s, "schedule_slot_lectures", { owner: s.id, slot, lecture, date: "2026-10-01 00:00:00.000Z" });
  const semester = await post(request, s, "semesters", { user: s.id, slug: `s-${uid()}` });
  const exam = await createExam(request, s, course);
  const ticket = await createTicket(request, s, exam, 1, "Вопрос билета");
  return { course, lecture, deck, card, quiz, question, answer, task, slot, settings, slotLecture, semester, exam, ticket };
}
type World = Awaited<ReturnType<typeof world>>;

interface Case {
  collection: string;
  record: (w: World) => string;
  /** поле → значение «из чужого мира» (victim) */
  moves: Record<string, (v: World, victim: Session) => unknown>;
  fine: Record<string, unknown>;
}

const OWNER = (_v: World, victim: Session) => victim.id;
const CASES: Case[] = [
  { collection: "quizzes", record: (w) => w.quiz, moves: { lecture: (v) => v.lecture, owner: OWNER }, fine: { size: 5 } },
  {
    collection: "quiz_questions",
    record: (w) => w.question,
    moves: { lecture: (v) => v.lecture, quiz: (v) => v.quiz, owner: OWNER },
    fine: { flagged: true },
  },
  {
    collection: "quiz_answers",
    record: (w) => w.answer,
    moves: { owner: OWNER, lecture: (v) => v.lecture, question: (v) => v.question },
    fine: { correct: true },
  },
  { collection: "deck_cards", record: (w) => w.card, moves: { deck: (v) => v.deck }, fine: { front: "<p>новый вопрос</p>" } },
  { collection: "exam_tickets", record: (w) => w.ticket, moves: { exam: (v) => v.exam }, fine: { question: "Новая формулировка" } },
  { collection: "tasks", record: (w) => w.task, moves: { owner: OWNER }, fine: { title: "Новое название" } },
  { collection: "schedule_slots", record: (w) => w.slot, moves: { owner: OWNER }, fine: { room: "101" } },
  { collection: "schedule_settings", record: (w) => w.settings, moves: { owner: OWNER }, fine: { show_saturday: true } },
  {
    collection: "schedule_slot_lectures",
    record: (w) => w.slotLecture,
    moves: { owner: OWNER, slot: (v) => v.slot, lecture: (v) => v.lecture },
    fine: { date: "2026-10-02 00:00:00.000Z" },
  },
  { collection: "semesters", record: (w) => w.semester, moves: { user: OWNER }, fine: { label: "Осень" } },
  { collection: "exams", record: (w) => w.exam, moves: { owner: OWNER }, fine: { title: "Новое название экзамена" } },
];

test.describe("смена владельца и родителя запрещена", () => {
  let a: Session;
  let b: Session;
  let mine: World;
  let theirs: World;

  test.beforeAll(async ({ request }) => {
    a = await register(request, "own-a");
    b = await register(request, "own-b");
    mine = await world(request, a);
    theirs = await world(request, b);
  });
  test.afterAll(async ({ request }) => {
    await cleanup(request, [a, b]);
  });

  for (const c of CASES) {
    test(`${c.collection}: перенос в чужой контейнер отклонён, обычная правка проходит`, async ({ request }) => {
      const id = c.record(mine);
      const url = `${PB}/api/collections/${c.collection}/records/${id}`;
      const before = await (await request.get(url, { headers: h(a) })).json();
      for (const [field, valueOf] of Object.entries(c.moves)) {
        const r = await request.patch(url, { headers: h(a), data: { [field]: valueOf(theirs, b) } });
        expect(rejected(r.status()), `${c.collection}.${field} → ${r.status()}`).toBeTruthy();
        // и «то же самое значение» тоже не принимается: поле неизменяемо целиком
        const same = await request.patch(url, { headers: h(a), data: { [field]: before[field] } });
        expect(rejected(same.status()), `${c.collection}.${field} (то же значение) → ${same.status()}`).toBeTruthy();
      }
      const after = await (await request.get(url, { headers: h(a) })).json();
      for (const field of Object.keys(c.moves)) expect(after[field], `${c.collection}.${field} не изменилось`).toBe(before[field]);

      const ok = await request.patch(url, { headers: h(a), data: c.fine });
      expect(ok.status(), `${c.collection}: обычная правка → ${await ok.text()}`).toBe(200);
    });
  }

  test("квиз и карточка не появились у владельца цели", async ({ request }) => {
    const quizzes = await request.get(`${PB}/api/collections/quizzes/records`, { headers: h(b), params: { filter: `lecture="${theirs.lecture}"` } });
    expect(((await quizzes.json()).items as unknown[]).length).toBe(1);
    const cards = await request.get(`${PB}/api/collections/deck_cards/records`, { headers: h(b), params: { filter: `deck="${theirs.deck}"` } });
    expect(((await cards.json()).items as unknown[]).length).toBe(1);
  });
});
