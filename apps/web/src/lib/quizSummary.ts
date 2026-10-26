/**
 * Итог одного прохождения квиза (Screen-quiz-summary): «6 из 8», темы с долей
 * верных, «слабее всего», «понимание темы 36% → 52%». Чистые функции.
 */
import {
  computeLectureReadiness,
  MAX_WEAK_TOPICS,
  normalizeTopic,
  WEAK_TOPIC_ACCURACY,
  type ReadinessAnswer,
  type ReadinessQuestion,
} from "./computeLectureReadiness";

export interface QuestionRef {
  id: string;
  topic?: string;
}

export interface AnswerRef {
  questionId: string;
  correct: boolean;
}

export interface AttemptTopic {
  /** Нормализованный ключ темы (нижний регистр) — по нему же считает панель. */
  key: string;
  /** Как тема записана в вопросе — для показа. */
  label: string;
  correct: number;
  total: number;
  accuracy: number;
}

export interface AttemptStats {
  correct: number;
  total: number;
  topics: AttemptTopic[];
  /** Темы с долей верных ниже 0.6, от самой слабой, не больше трёх (как «слабые темы» в формуле). */
  weak: AttemptTopic[];
}

export function topicKey(topic: string): string {
  return normalizeTopic(topic);
}

/** Если вопрос в прохождении отвечали несколько раз, считается последний ответ. */
export function attemptStats(questions: QuestionRef[], answers: AnswerRef[]): AttemptStats {
  const last = new Map<string, boolean>();
  for (const a of answers) last.set(a.questionId, a.correct);

  const byTopic = new Map<string, AttemptTopic>();
  let correct = 0;
  let total = 0;
  for (const q of questions) {
    if (!last.has(q.id)) continue;
    const ok = last.get(q.id)!;
    total += 1;
    if (ok) correct += 1;
    const key = topicKey(q.topic ?? "");
    const t = byTopic.get(key) ?? { key, label: (q.topic ?? "").trim(), correct: 0, total: 0, accuracy: 0 };
    t.total += 1;
    if (ok) t.correct += 1;
    byTopic.set(key, t);
  }
  const topics = Array.from(byTopic.values()).map((t) => ({ ...t, accuracy: t.correct / t.total }));
  const weak = topics
    .filter((t) => t.accuracy < WEAK_TOPIC_ACCURACY)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, MAX_WEAK_TOPICS);
  return { correct, total, topics, weak };
}

/**
 * Понимание темы до и после этого прохождения: «до» — формула без ответов этого
 * прохождения. `before` = null, если до него ответов не было.
 */
export function understandingBeforeAfter(
  questions: ReadinessQuestion[],
  answers: (ReadinessAnswer & { attempt?: string })[],
  attempt: string,
  now: Date
): { before: number | null; after: number | null } {
  const after = computeLectureReadiness(questions, answers, now).percent;
  const before = computeLectureReadiness(
    questions,
    answers.filter((a) => a.attempt !== attempt),
    now
  ).percent;
  return { before, after };
}

/** Подпись для плашки: «Понимание темы 36% → 52%» или без стрелки, если сравнивать не с чем. */
export function understandingLabel(before: number | null, after: number | null): string | null {
  if (after === null) return null;
  if (before === null || before === after) return `Понимание темы ${after}%`;
  return `Понимание темы ${before}% → ${after}%`;
}
