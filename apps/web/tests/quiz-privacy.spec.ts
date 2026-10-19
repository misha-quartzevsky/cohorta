/**
 * Ответы и квизы одного пользователя не видны другому (B5, раздел 5 инструкции:
 * «результаты видны только тебе»). Работает напрямую с PocketBase (без браузера):
 * создаёт двух одноразовых пользователей, у первого лекцию, квиз, вопрос и ответ,
 * проверяет, что второй не видит ничего из этого — ни списком, ни по id, ни
 * изменить, ни удалить, ни записать ответ «от имени» первого. В конце всё удаляет.
 */
import { test, expect, type APIRequestContext } from "@playwright/test";

const PB = process.env.PB_URL ?? "http://127.0.0.1:8090";
const stamp = Date.now();
const PASSWORD = "Test-pass-12345";

interface Session {
  id: string;
  token: string;
  email: string;
}

async function register(request: APIRequestContext, tag: string): Promise<Session> {
  const email = `b5-privacy-${tag}-${stamp}@example.test`;
  const created = await request.post(`${PB}/api/collections/users/records`, {
    data: { email, password: PASSWORD, passwordConfirm: PASSWORD, name: `B5 ${tag}` },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const auth = await request.post(`${PB}/api/collections/users/auth-with-password`, {
    data: { identity: email, password: PASSWORD },
  });
  expect(auth.ok()).toBeTruthy();
  const body = await auth.json();
  return { id: body.record.id, token: body.token, email };
}

const h = (s: Session) => ({ Authorization: s.token });

test.describe("квиз: данные одного пользователя не видны другому", () => {
  let a: Session;
  let b: Session;
  let lectureId = "";
  let quizId = "";
  let questionId = "";
  let answerId = "";

  test.beforeAll(async ({ request }) => {
    a = await register(request, "a");
    b = await register(request, "b");

    const lecture = await request.post(`${PB}/api/collections/lectures/records`, {
      headers: h(a),
      data: { title: "Лекция A", slug: `b5-priv-${stamp}`, content: "<p>текст</p>", owner: a.id },
    });
    expect(lecture.ok(), await lecture.text()).toBeTruthy();
    lectureId = (await lecture.json()).id;

    const quiz = await request.post(`${PB}/api/collections/quizzes/records`, {
      headers: h(a),
      data: { owner: a.id, lecture: lectureId, source_hash: "x", size: 5, model: "t" },
    });
    expect(quiz.ok(), await quiz.text()).toBeTruthy();
    quizId = (await quiz.json()).id;

    const question = await request.post(`${PB}/api/collections/quiz_questions/records`, {
      headers: h(a),
      data: {
        owner: a.id, quiz: quizId, lecture: lectureId, position: 0, type: "mcq", topic: "т",
        prompt: "?", options: ["1", "2", "3", "4"], correct_index: 0, explanation: "e",
      },
    });
    expect(question.ok(), await question.text()).toBeTruthy();
    questionId = (await question.json()).id;

    const answer = await request.post(`${PB}/api/collections/quiz_answers/records`, {
      headers: h(a),
      data: { owner: a.id, question: questionId, lecture: lectureId, correct: true, attempt: "u1" },
    });
    expect(answer.ok(), await answer.text()).toBeTruthy();
    answerId = (await answer.json()).id;
  });

  test.afterAll(async ({ request }) => {
    if (lectureId) await request.delete(`${PB}/api/collections/lectures/records/${lectureId}`, { headers: h(a) });
    for (const s of [a, b]) {
      if (s) await request.delete(`${PB}/api/collections/users/records/${s.id}`, { headers: h(s) });
    }
  });

  test("владелец видит свои ответы (контроль теста)", async ({ request }) => {
    const r = await request.get(`${PB}/api/collections/quiz_answers/records`, { headers: h(a) });
    expect((await r.json()).totalItems).toBe(1);
  });

  for (const [name, id] of [
    ["quiz_answers", () => answerId],
    ["quiz_questions", () => questionId],
    ["quizzes", () => quizId],
  ] as const) {
    test(`${name}: чужой список пуст, запись по id недоступна`, async ({ request }) => {
      const list = await request.get(`${PB}/api/collections/${name}/records`, { headers: h(b) });
      expect((await list.json()).totalItems).toBe(0);
      const one = await request.get(`${PB}/api/collections/${name}/records/${id()}`, { headers: h(b) });
      expect(one.status()).toBe(404);
      const noAuth = await request.get(`${PB}/api/collections/${name}/records/${id()}`);
      expect([401, 403, 404]).toContain(noAuth.status());
    });
  }

  test("чужой не может ни изменить, ни удалить ответ", async ({ request }) => {
    const upd = await request.patch(`${PB}/api/collections/quiz_answers/records/${answerId}`, {
      headers: h(b),
      data: { correct: false },
    });
    expect(upd.ok()).toBeFalsy();
    const del = await request.delete(`${PB}/api/collections/quiz_answers/records/${answerId}`, { headers: h(b) });
    expect(del.ok()).toBeFalsy();
    const still = await request.get(`${PB}/api/collections/quiz_answers/records/${answerId}`, { headers: h(a) });
    expect((await still.json()).correct).toBe(true);
  });

  test("чужой не может записать ответ от имени владельца", async ({ request }) => {
    const r = await request.post(`${PB}/api/collections/quiz_answers/records`, {
      headers: h(b),
      data: { owner: a.id, question: questionId, lecture: lectureId, correct: false, attempt: "evil" },
    });
    expect(r.ok()).toBeFalsy();
  });
});
