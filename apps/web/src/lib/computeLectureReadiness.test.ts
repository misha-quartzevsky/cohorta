import { describe, it, expect } from "vitest";
import {
  computeLectureReadiness,
  lectureStatus,
  type ReadinessQuestion,
  type ReadinessAnswer,
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
