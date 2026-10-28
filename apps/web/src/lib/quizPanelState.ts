/**
 * Состояние правой панели «Твоё понимание темы» (Screen-understanding,
 * Screen-quiz-states блок 6) — чистая функция, без запросов.
 *
 *  none     — квиза по лекции нет
 *  created  — квиз собран, ответов нет
 *  started  — идёт прохождение: в последнем прохождении отвечено не на все вопросы
 *  done     — последнее прохождение закончено (показываем процент)
 *
 * Хватает существующих `quiz_answers` (owner, question, correct, answered_at,
 * attempt), новых таблиц не нужно: «прохождение» — это все ответы с одним
 * `attempt`, последнее определяется по времени самого свежего ответа.
 */

import type { ReadinessAnswer, ReadinessQuestion } from "./computeLectureReadiness";

/** Ответ для панели квиза: ReadinessAnswer, у которого `attempt` обязателен. */
export type PanelAnswer = Required<Pick<ReadinessAnswer, "questionId" | "attempt" | "answeredAt">>;

export type QuizPanelState =
  | { kind: "none" }
  | { kind: "created"; total: number }
  | { kind: "started"; answered: number; total: number; attempt: string }
  | { kind: "done"; total: number; attempt: string };

/**
 * @param questionIds видимые (не скрытые и не «плохие») вопросы последнего квиза лекции
 * @param answers     все ответы пользователя по лекции в порядке создания
 *                    (при равных `answeredAt` позднее в массиве — свежее)
 */
export function derivePanelState(questionIds: string[], answers: PanelAnswer[]): QuizPanelState {
  const total = questionIds.length;
  if (total === 0) return { kind: "none" };

  const ids = new Set(questionIds);
  const onQuiz = answers.filter((a) => ids.has(a.questionId));
  if (onQuiz.length === 0) return { kind: "created", total };

  let latest = onQuiz[0];
  for (const a of onQuiz) {
    if (a.answeredAt.getTime() >= latest.answeredAt.getTime()) latest = a;
  }
  const answeredInAttempt = new Set(
    onQuiz.filter((a) => a.attempt === latest.attempt).map((a) => a.questionId)
  );
  return answeredInAttempt.size < total
    ? { kind: "started", answered: answeredInAttempt.size, total, attempt: latest.attempt }
    : { kind: "done", total, attempt: latest.attempt };
}

/** Вопросы, на которые в этом прохождении ещё не отвечено (для «Продолжить»). */
export function unansweredIds(questionIds: string[], answers: PanelAnswer[], attempt: string): string[] {
  const done = new Set(answers.filter((a) => a.attempt === attempt).map((a) => a.questionId));
  return questionIds.filter((id) => !done.has(id));
}

/** Состояние панели по тем же данным, что считает формула: вопросы и ответы лекции. */
export function panelStateFor(
  questions: ReadinessQuestion[],
  answers: ReadinessAnswer[]
): QuizPanelState {
  const visible = questions.filter((q) => !q.hidden && !q.flagged);
  if (visible.length === 0) return { kind: "none" };
  const latest = visible.reduce((a, b) => (b.quizCreatedAt.getTime() > a.quizCreatedAt.getTime() ? b : a));
  const ids = visible.filter((q) => q.quiz === latest.quiz).map((q) => q.id);
  return derivePanelState(
    ids,
    answers.map((a) => ({ questionId: a.questionId, attempt: a.attempt ?? "", answeredAt: a.answeredAt }))
  );
}
