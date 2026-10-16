/**
 * Готовность лекции (spec 6.4) — чистая функция, без ИИ. Считается по
 * квизам и повторениям этой лекции. Билеты в расчёт не входят.
 */

export interface ReadinessQuestion {
  id: string;
  /** relation → quizzes, нужно для определения «последнего квиза». */
  quiz: string;
  /** Дата создания квиза, которому принадлежит вопрос. */
  quizCreatedAt: Date;
  topic: string;
  hidden?: boolean;
  flagged?: boolean;
}

export interface ReadinessAnswer {
  questionId: string;
  correct: boolean;
  answeredAt: Date;
}

export type TopicStatus = "danger" | "neutral" | "success";

export interface TopicStat {
  topic: string;
  accuracy: number;
  correct: number;
  total: number;
  status: TopicStatus;
}

export interface ReadinessResult {
  percent: number | null;
  topics: TopicStat[];
  lastActivityAt: Date | null;
  /** До 3 тем с accuracy < 0.6, по возрастанию. */
  weakTopics: TopicStat[];
}

export type LectureStatus = "new" | "review" | "in_progress" | "done";

/** Пороги статуса лекции (spec 6.4), вынесены в константы. */
export const READINESS_THRESHOLDS = {
  review: 40, // < 40 → «Повторить»
  done: 75, // >= 75 → «Готово»
} as const;

export function lectureStatus(percent: number | null): LectureStatus {
  if (percent === null) return "new";
  if (percent < READINESS_THRESHOLDS.review) return "review";
  if (percent < READINESS_THRESHOLDS.done) return "in_progress";
  return "done";
}

function normalizeTopic(topic: string): string {
  return topic.toLowerCase().trim();
}

function fullDaysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

/** score вопроса: последние два ответа, 0.6·последний + 0.4·предпоследний. */
function questionScore(answers: ReadinessAnswer[]): number {
  const sorted = [...answers].sort(
    (a, b) => a.answeredAt.getTime() - b.answeredAt.getTime()
  );
  const last = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  const lastScore = last.correct ? 1 : 0;
  if (!prev) return lastScore;
  const prevScore = prev.correct ? 1 : 0;
  return 0.6 * lastScore + 0.4 * prevScore;
}

function topicStatus(accuracy: number): TopicStatus {
  if (accuracy < 0.5) return "danger";
  if (accuracy < 0.8) return "neutral";
  return "success";
}

export function computeLectureReadiness(
  questions: ReadinessQuestion[],
  answers: ReadinessAnswer[],
  now: Date
): ReadinessResult {
  const visible = questions.filter((q) => !q.hidden && !q.flagged);
  if (visible.length === 0) {
    return { percent: null, topics: [], lastActivityAt: null, weakTopics: [] };
  }

  const answersByQuestion = new Map<string, ReadinessAnswer[]>();
  for (const a of answers) {
    const list = answersByQuestion.get(a.questionId) ?? [];
    list.push(a);
    answersByQuestion.set(a.questionId, list);
  }

  // Последний квиз лекции — тот, чьи вопросы имеют максимальный quizCreatedAt.
  const latestQuizCreatedAt = visible.reduce(
    (max, q) => (q.quizCreatedAt.getTime() > max.getTime() ? q.quizCreatedAt : max),
    visible[0].quizCreatedAt
  );
  const latestQuizId = visible.find(
    (q) => q.quizCreatedAt.getTime() === latestQuizCreatedAt.getTime()
  )!.quiz;
  const latestQuizQuestions = visible.filter((q) => q.quiz === latestQuizId);

  // Включаем вопросы последнего квиза + любые другие отвеченные хотя бы раз.
  const included = visible.filter(
    (q) => q.quiz === latestQuizId || (answersByQuestion.get(q.id)?.length ?? 0) > 0
  );
  const answeredIncluded = included.filter(
    (q) => (answersByQuestion.get(q.id)?.length ?? 0) > 0
  );

  if (answeredIncluded.length === 0) {
    return { percent: null, topics: [], lastActivityAt: null, weakTopics: [] };
  }

  const scores = answeredIncluded.map((q) => ({
    question: q,
    score: questionScore(answersByQuestion.get(q.id)!),
  }));

  const accuracy =
    scores.reduce((sum, s) => sum + s.score, 0) / scores.length;

  const coverage = Math.min(1, answeredIncluded.length / latestQuizQuestions.length);
  const underCovered = answeredIncluded.length < latestQuizQuestions.length / 2;

  let lastActivityAt: Date | null = null;
  for (const a of answers) {
    if (!answersByQuestion.has(a.questionId)) continue;
    if (!lastActivityAt || a.answeredAt.getTime() > lastActivityAt.getTime()) {
      lastActivityAt = a.answeredAt;
    }
  }
  const daysSinceLastAnswer = lastActivityAt
    ? fullDaysBetween(lastActivityAt, now)
    : 0;
  const freshness = Math.exp(-daysSinceLastAnswer / 21);

  let percent = Math.round(100 * accuracy * coverage * (0.7 + 0.3 * freshness));
  if (underCovered) percent = Math.min(percent, 60);
  percent = Math.max(0, Math.min(100, percent));

  // Темы: группируем отвеченные вопросы по нормализованному topic.
  const byTopic = new Map<string, { score: number; correct: boolean }[]>();
  for (const { question, score } of scores) {
    const key = normalizeTopic(question.topic);
    const list = byTopic.get(key) ?? [];
    const lastAnswer = answersByQuestion
      .get(question.id)!
      .reduce((latest, a) =>
        a.answeredAt.getTime() > latest.answeredAt.getTime() ? a : latest
      );
    list.push({ score, correct: lastAnswer.correct });
    byTopic.set(key, list);
  }

  const topics: TopicStat[] = Array.from(byTopic.entries()).map(
    ([topic, items]) => {
      const topicAccuracy =
        items.reduce((sum, i) => sum + i.score, 0) / items.length;
      const correct = items.filter((i) => i.correct).length;
      return {
        topic,
        accuracy: topicAccuracy,
        correct,
        total: items.length,
        status: topicStatus(topicAccuracy),
      };
    }
  );

  const weakTopics = [...topics]
    .filter((t) => t.accuracy < 0.6)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);

  return { percent, topics, lastActivityAt, weakTopics };
}
