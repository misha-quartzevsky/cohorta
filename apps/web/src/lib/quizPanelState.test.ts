import { describe, expect, it } from "vitest";
import { derivePanelState, unansweredIds, type PanelAnswer } from "./quizPanelState";

const ids = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"];
let t = 0;
const ans = (questionId: string, attempt: string): PanelAnswer => ({
  questionId,
  attempt,
  answeredAt: new Date(2026, 9, 19, 12, 0, t++),
});

describe("derivePanelState", () => {
  it("квиза нет — none", () => {
    expect(derivePanelState([], [])).toEqual({ kind: "none" });
  });

  it("квиз есть, ответов нет — created", () => {
    expect(derivePanelState(ids, [])).toEqual({ kind: "created", total: 8 });
  });

  it("ответы только на вопросы другого квиза не считаются — created", () => {
    expect(derivePanelState(ids, [ans("old1", "a0")])).toEqual({ kind: "created", total: 8 });
  });

  it("3 из 8 в одном прохождении — started (прогресс «3 из 8»)", () => {
    const a = [ans("q1", "a1"), ans("q2", "a1"), ans("q3", "a1")];
    expect(derivePanelState(ids, a)).toEqual({ kind: "started", answered: 3, total: 8, attempt: "a1" });
  });

  it("все 8 в прохождении — done", () => {
    const a = ids.map((id) => ans(id, "a1"));
    expect(derivePanelState(ids, a)).toEqual({ kind: "done", total: 8, attempt: "a1" });
  });

  it("после законченного прохождения начато новое — снова started, считается только новое", () => {
    const a = [...ids.map((id) => ans(id, "a1")), ans("q4", "a2"), ans("q1", "a2")];
    expect(derivePanelState(ids, a)).toEqual({ kind: "started", answered: 2, total: 8, attempt: "a2" });
  });

  it("повторный ответ на тот же вопрос в прохождении не двигает прогресс", () => {
    const a = [ans("q1", "a1"), ans("q1", "a1")];
    expect(derivePanelState(ids, a)).toMatchObject({ kind: "started", answered: 1 });
  });

  it("скрытый вопрос не входит в total: 7 вопросов, 7 ответов — done", () => {
    const seven = ids.slice(0, 7);
    expect(derivePanelState(seven, seven.map((id) => ans(id, "a1"))).kind).toBe("done");
  });

  it("при равном времени свежее то, что позже в массиве", () => {
    const same = new Date(2026, 9, 19);
    const a: PanelAnswer[] = [
      { questionId: "q1", attempt: "a1", answeredAt: same },
      ...ids.slice(1).map((id) => ({ questionId: id, attempt: "a1", answeredAt: same })),
      { questionId: "q1", attempt: "a2", answeredAt: same },
    ];
    expect(derivePanelState(ids, a)).toMatchObject({ kind: "started", attempt: "a2", answered: 1 });
  });
});

describe("unansweredIds", () => {
  it("остаются вопросы без ответа в этом прохождении, в исходном порядке", () => {
    const a = [ans("q1", "a1"), ans("q3", "a1"), ans("q2", "other")];
    expect(unansweredIds(ids, a, "a1")).toEqual(["q2", "q4", "q5", "q6", "q7", "q8"]);
  });
});

import { panelStateFor } from "./quizPanelState";
import type { ReadinessAnswer, ReadinessQuestion } from "./computeLectureReadiness";

describe("panelStateFor", () => {
  const q = (id: string, quiz: string, day: number, extra: Partial<ReadinessQuestion> = {}): ReadinessQuestion => ({
    id,
    quiz,
    quizCreatedAt: new Date(2026, 9, day),
    topic: "т",
    ...extra,
  });
  const a = (questionId: string, attempt: string, s: number): ReadinessAnswer => ({
    questionId,
    correct: true,
    answeredAt: new Date(2026, 9, 19, 12, 0, s),
    attempt,
  });

  it("берёт последний по дате квиз: ответы на старый квиз его состояния не меняют", () => {
    const qs = [q("o1", "old", 1), q("o2", "old", 1), q("n1", "new", 5), q("n2", "new", 5)];
    const ans = [a("o1", "x", 1), a("o2", "x", 2)];
    expect(panelStateFor(qs, ans)).toEqual({ kind: "created", total: 2 });
  });

  it("плохие и скрытые вопросы не считаются", () => {
    const qs = [q("n1", "new", 5), q("n2", "new", 5, { flagged: true }), q("n3", "new", 5, { hidden: true })];
    expect(panelStateFor(qs, [a("n1", "x", 1)])).toMatchObject({ kind: "done", total: 1 });
  });

  it("нет вопросов — none", () => {
    expect(panelStateFor([], [])).toEqual({ kind: "none" });
  });
});
