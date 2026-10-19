import { describe, expect, it } from "vitest";
import { attemptStats, understandingBeforeAfter, understandingLabel } from "./quizSummary";
import type { ReadinessAnswer, ReadinessQuestion } from "./computeLectureReadiness";

const qs = [
  { id: "q1", topic: "Понятие договора" },
  { id: "q2", topic: "Понятие договора" },
  { id: "q3", topic: "Заключение договора" },
  { id: "q4", topic: "Заключение договора" },
  { id: "q5", topic: "Заключение договора" },
  { id: "q6", topic: "Заключение договора" },
  { id: "q7", topic: "Расторжение договора" },
  { id: "q8", topic: "расторжение договора " },
];

describe("attemptStats", () => {
  it("как на макете итога: 6 из 8, темы 2/2, 3/4, 1/2, слабее всего — расторжение", () => {
    const correct = new Set(["q1", "q2", "q3", "q4", "q5", "q7"]);
    const s = attemptStats(
      qs,
      qs.map((q) => ({ questionId: q.id, correct: correct.has(q.id) }))
    );
    expect(s.correct).toBe(6);
    expect(s.total).toBe(8);
    expect(s.topics.map((t) => [t.label, t.correct, t.total])).toEqual([
      ["Понятие договора", 2, 2],
      ["Заключение договора", 3, 4],
      ["Расторжение договора", 1, 2],
    ]);
    // «Расторжение» (1 из 2 = 0.5) слабее порога 0.6; «Заключение» (0.75) — нет.
    expect(s.weak.map((t) => t.label)).toEqual(["Расторжение договора"]);
  });

  it("считает только отвеченные вопросы (прохождение прервано)", () => {
    const s = attemptStats(qs, [
      { questionId: "q1", correct: true },
      { questionId: "q3", correct: false },
    ]);
    expect(s.total).toBe(2);
    expect(s.correct).toBe(1);
  });

  it("повторный ответ на тот же вопрос в прохождении — считается последний", () => {
    const s = attemptStats(qs, [
      { questionId: "q1", correct: false },
      { questionId: "q1", correct: true },
    ]);
    expect(s.total).toBe(1);
    expect(s.correct).toBe(1);
  });

  it("слабые темы — от самой слабой, не больше трёх", () => {
    const many = ["a", "b", "c", "d"].map((t, i) => ({ id: `x${i}`, topic: t }));
    const s = attemptStats(
      many,
      many.map((q) => ({ questionId: q.id, correct: false }))
    );
    expect(s.weak).toHaveLength(3);
  });

  it("всё верно — слабых тем нет", () => {
    const s = attemptStats(qs, qs.map((q) => ({ questionId: q.id, correct: true })));
    expect(s.weak).toEqual([]);
  });
});

describe("understandingBeforeAfter", () => {
  const quizDate = new Date(2026, 9, 1);
  const rq: ReadinessQuestion[] = qs.map((q) => ({ id: q.id, quiz: "z", quizCreatedAt: quizDate, topic: q.topic }));
  const now = new Date(2026, 9, 19, 12);
  const ans = (id: string, correct: boolean, attempt: string, s: number): ReadinessAnswer & { attempt: string } => ({
    questionId: id,
    correct,
    attempt,
    answeredAt: new Date(2026, 9, 19, 11, 0, s),
  });

  it("первое прохождение: «до» нет", () => {
    const answers = qs.map((q, i) => ans(q.id, true, "a1", i));
    const r = understandingBeforeAfter(rq, answers, "a1", now);
    expect(r.before).toBeNull();
    expect(r.after).toBe(100);
  });

  it("второе прохождение: «до» считается без его ответов и меньше «после»", () => {
    const first = qs.map((q, i) => ans(q.id, i < 2, "a1", i)); // 2 из 8 верно
    const second = qs.map((q, i) => ans(q.id, true, "a2", 20 + i)); // все верно
    const r = understandingBeforeAfter(rq, [...first, ...second], "a2", now);
    expect(r.before).toBe(25);
    expect(r.after).toBeGreaterThan(r.before!);
  });
});

describe("understandingLabel", () => {
  it("со стрелкой, когда есть что сравнить", () => {
    expect(understandingLabel(36, 52)).toBe("Понимание темы 36% → 52%");
  });
  it("без стрелки: первого «до» нет или процент не изменился", () => {
    expect(understandingLabel(null, 52)).toBe("Понимание темы 52%");
    expect(understandingLabel(52, 52)).toBe("Понимание темы 52%");
  });
  it("нет «после» — плашки нет", () => {
    expect(understandingLabel(10, null)).toBeNull();
  });
});
