import { describe, it, expect } from "vitest";
import {
  computeLectureReadiness,
  lectureStatus,
  lectureListStatus,
  type ReadinessQuestion,
  type ReadinessAnswer,
  type ReadinessResult,
} from "./computeLectureReadiness";

const quizDate = new Date(2026, 9, 1, 10, 0);

function mkQuestions(n: number, topic = "Тема"): ReadinessQuestion[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `q${i + 1}`,
    quiz: "quiz1",
    quizCreatedAt: quizDate,
    topic,
  }));
}

describe("computeLectureReadiness", () => {
  it("нет ответов -> percent null", () => {
    const r = computeLectureReadiness(mkQuestions(8), [], new Date());
    expect(r.percent).toBeNull();
    expect(r.topics).toEqual([]);
    expect(r.lastActivityAt).toBeNull();
  });

  it("8/8 верных вчера -> ≈100", () => {
    const questions = mkQuestions(8);
    const yesterday = new Date(2026, 9, 15, 12);
    const now = new Date(2026, 9, 16, 12);
    const answers: ReadinessAnswer[] = questions.map((q) => ({
      questionId: q.id,
      correct: true,
      answeredAt: yesterday,
    }));
    const r = computeLectureReadiness(questions, answers, now);
    expect(r.percent).not.toBeNull();
    expect(r.percent!).toBeGreaterThanOrEqual(95);
    expect(r.percent!).toBeLessThanOrEqual(100);
  });

  it("4/8 правильных, все отвечены сегодня -> 50 (при свежести 1)", () => {
    const questions = mkQuestions(8);
    const now = new Date(2026, 9, 16, 12);
    const answers: ReadinessAnswer[] = questions.map((q, i) => ({
      questionId: q.id,
      correct: i < 4,
      answeredAt: now,
    }));
    const r = computeLectureReadiness(questions, answers, now);
    expect(r.percent).toBe(50);
  });

  it("отвечено только 3 из 8 -> не выше 60", () => {
    const questions = mkQuestions(8);
    const now = new Date(2026, 9, 16, 12);
    const answers: ReadinessAnswer[] = questions.slice(0, 3).map((q) => ({
      questionId: q.id,
      correct: true,
      answeredAt: now,
    }));
    const r = computeLectureReadiness(questions, answers, now);
    expect(r.percent).not.toBeNull();
    expect(r.percent!).toBeLessThanOrEqual(60);
  });

  it("две попытки (сначала неверно, потом верно) -> score 0.6", () => {
    const questions = mkQuestions(1);
    const now = new Date(2026, 9, 16, 12);
    const answers: ReadinessAnswer[] = [
      { questionId: "q1", correct: false, answeredAt: new Date(2026, 9, 15, 10) },
      { questionId: "q1", correct: true, answeredAt: new Date(2026, 9, 16, 10) },
    ];
    const r = computeLectureReadiness(questions, answers, now);
    // accuracy=0.6, coverage=1/1=1, freshness≈1 (тот же день) -> ~60
    expect(r.percent).not.toBeNull();
    expect(r.percent!).toBeGreaterThanOrEqual(58);
    expect(r.percent!).toBeLessThanOrEqual(60);
  });

  it("давний ответ снижает процент (свежесть падает)", () => {
    const questions = mkQuestions(8);
    const now = new Date(2026, 9, 16, 12);
    const longAgo = new Date(2026, 8, 1, 12); // ~45 дней назад
    const answersFresh: ReadinessAnswer[] = questions.map((q) => ({
      questionId: q.id,
      correct: true,
      answeredAt: now,
    }));
    const answersOld: ReadinessAnswer[] = questions.map((q) => ({
      questionId: q.id,
      correct: true,
      answeredAt: longAgo,
    }));
    const fresh = computeLectureReadiness(questions, answersFresh, now);
    const old = computeLectureReadiness(questions, answersOld, now);
    expect(old.percent!).toBeLessThan(fresh.percent!);
  });

  it("скрытые и помеченные плохими вопросы не учитываются", () => {
    const questions: ReadinessQuestion[] = [
      ...mkQuestions(4),
      { id: "qh", quiz: "quiz1", quizCreatedAt: quizDate, topic: "Тема", hidden: true },
      { id: "qf", quiz: "quiz1", quizCreatedAt: quizDate, topic: "Тема", flagged: true },
    ];
    const now = new Date(2026, 9, 16, 12);
    const answers: ReadinessAnswer[] = [
      ...questions.slice(0, 4).map((q) => ({
        questionId: q.id,
        correct: true,
        answeredAt: now,
      })),
      { questionId: "qh", correct: false, answeredAt: now },
      { questionId: "qf", correct: false, answeredAt: now },
    ];
    const r = computeLectureReadiness(questions, answers, now);
    // Если бы скрытые/плохие учитывались, accuracy упала бы ниже 100%.
    expect(r.percent).toBeGreaterThanOrEqual(95);
  });

  it("темы: статус и подпись N из M", () => {
    const questions: ReadinessQuestion[] = [
      { id: "q1", quiz: "quiz1", quizCreatedAt: quizDate, topic: "Контракты" },
      { id: "q2", quiz: "quiz1", quizCreatedAt: quizDate, topic: "Контракты" },
      { id: "q3", quiz: "quiz1", quizCreatedAt: quizDate, topic: "Деликты" },
      { id: "q4", quiz: "quiz1", quizCreatedAt: quizDate, topic: "Деликты" },
    ];
    const now = new Date(2026, 9, 16, 12);
    const answers: ReadinessAnswer[] = [
      { questionId: "q1", correct: true, answeredAt: now },
      { questionId: "q2", correct: true, answeredAt: now },
      { questionId: "q3", correct: false, answeredAt: now },
      { questionId: "q4", correct: false, answeredAt: now },
    ];
    const r = computeLectureReadiness(questions, answers, now);
    const contracts = r.topics.find((t) => t.topic === "контракты");
    const torts = r.topics.find((t) => t.topic === "деликты");
    expect(contracts?.correct).toBe(2);
    expect(contracts?.total).toBe(2);
    expect(contracts?.status).toBe("success");
    expect(torts?.correct).toBe(0);
    expect(torts?.total).toBe(2);
    expect(torts?.status).toBe("danger");
    expect(r.weakTopics.some((t) => t.topic === "деликты")).toBe(true);
  });
});

describe("lectureStatus", () => {
  it("null -> new", () => {
    expect(lectureStatus(null)).toBe("new");
  });
  it("< 40 -> review", () => {
    expect(lectureStatus(39)).toBe("review");
  });
  it("40-74 -> in_progress", () => {
    expect(lectureStatus(40)).toBe("in_progress");
    expect(lectureStatus(74)).toBe("in_progress");
  });
  it(">= 75 -> done", () => {
    expect(lectureStatus(75)).toBe("done");
    expect(lectureStatus(100)).toBe("done");
  });
});

function mkReadiness(partial: Partial<ReadinessResult>): ReadinessResult {
  return {
    percent: null,
    topics: [],
    lastActivityAt: null,
    weakTopics: [],
    ...partial,
  };
}

describe("lectureListStatus (Screen-lectures.dc.html)", () => {
  it("percent null -> Не начато", () => {
    expect(lectureListStatus(mkReadiness({ percent: null })).key).toBe("not_started");
  });

  it("есть слабая тема -> Слабо, даже при высоком percent", () => {
    const r = mkReadiness({
      percent: 90,
      weakTopics: [{ topic: "деликты", accuracy: 0.3, correct: 1, total: 3, status: "danger" }],
    });
    expect(lectureListStatus(r).key).toBe("weak");
  });

  it("percent < 75 без слабых тем -> Повторить", () => {
    const r = mkReadiness({ percent: 60, weakTopics: [] });
    expect(lectureListStatus(r).key).toBe("review");
  });

  it("percent >= 75 без слабых тем -> Выучено", () => {
    const r = mkReadiness({ percent: 80, weakTopics: [] });
    expect(lectureListStatus(r).key).toBe("learned");
  });
});

describe("computeLectureReadiness: последний квиз и темы", () => {
  const now = new Date(2026, 9, 16, 12);
  const q = (id: string, quiz: string, createdAt: Date, topic: string): ReadinessQuestion => ({
    id,
    quiz,
    quizCreatedAt: createdAt,
    topic,
  });
  const ans = (questionId: string, correct: boolean): ReadinessAnswer => ({
    questionId,
    correct,
    answeredAt: now,
  });
  const older = new Date(2026, 9, 1, 10);
  const newer = new Date(2026, 9, 10, 10);

  it("покрытие считается по последнему квизу, ответы на старый квиз тоже учитываются", () => {
    const oldQuiz = ["a1", "a2", "a3", "a4"].map((id) => q(id, "quizOld", older, "Тема"));
    const newQuiz = ["b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8"].map((id) => q(id, "quizNew", newer, "Тема"));
    const answers = oldQuiz.map((x) => ans(x.id, true));
    const r = computeLectureReadiness([...oldQuiz, ...newQuiz], answers, now);
    // отвечено 4 из 8 вопросов последнего квиза: точность 1, покрытие 0.5, свежесть 1
    expect(r.percent).toBe(50);
  });

  it("все ответы на последний квиз верны и свежи — 100", () => {
    const oldQuiz = ["a1", "a2"].map((id) => q(id, "quizOld", older, "Тема"));
    const newQuiz = ["b1", "b2", "b3", "b4"].map((id) => q(id, "quizNew", newer, "Тема"));
    const answers = newQuiz.map((x) => ans(x.id, true));
    expect(computeLectureReadiness([...oldQuiz, ...newQuiz], answers, now).percent).toBe(100);
  });

  it("границы статуса темы: 0.5 — нейтральная, 0.8 — успех, 0.4 — опасная", () => {
    const qs = [
      ...["a1", "a2"].map((id) => q(id, "quiz1", quizDate, "А")),
      ...["b1", "b2", "b3", "b4", "b5"].map((id) => q(id, "quiz1", quizDate, "Б")),
      ...["c1", "c2", "c3", "c4", "c5"].map((id) => q(id, "quiz1", quizDate, "В")),
    ];
    const answers = [
      ans("a1", true), ans("a2", false), // 0.5
      ans("b1", true), ans("b2", true), ans("b3", true), ans("b4", true), ans("b5", false), // 0.8
      ans("c1", true), ans("c2", true), ans("c3", false), ans("c4", false), ans("c5", false), // 0.4
    ];
    const r = computeLectureReadiness(qs, answers, now);
    const status = (t: string) => r.topics.find((x) => x.topic === t)?.status;
    expect(status("а")).toBe("neutral");
    expect(status("б")).toBe("success");
    expect(status("в")).toBe("danger");
    // слабые: точность < 0.6, самая слабая первой
    expect(r.weakTopics.map((t) => t.topic)).toEqual(["в", "а"]);
  });

  it("слабых тем не больше трёх", () => {
    const qs = ["Т1", "Т2", "Т3", "Т4"].map((t, i) => q(`q${i}`, "quiz1", quizDate, t));
    const answers = qs.map((x) => ans(x.id, false));
    const r = computeLectureReadiness(qs, answers, now);
    expect(r.topics).toHaveLength(4);
    expect(r.weakTopics).toHaveLength(3);
  });

  it("темы с разным регистром и пробелами объединяются", () => {
    const qs = [q("q1", "quiz1", quizDate, "Этика "), q("q2", "quiz1", quizDate, "этика")];
    const r = computeLectureReadiness(qs, [ans("q1", true), ans("q2", true)], now);
    expect(r.topics).toHaveLength(1);
    expect(r.topics[0].total).toBe(2);
  });
});
