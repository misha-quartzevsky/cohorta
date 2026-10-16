/**
 * ============================================
 *  quizService.ts — квиз по лекции (spec раздел 6)
 * ============================================
 * Генерация через Cloudflare Function, кэш по хешу текста, сохранение
 * квиза и вопросов, запись ответов, «плохой вопрос» / скрыть.
 */

import { pb } from "../lib/pocketbase";
import { FIELDS } from "../lib/types";
import type { Quiz, QuizQuestion, QuizAnswer, QuizQuestionType } from "../lib/types";
import { extractText, normalizeText } from "../lib/extractText";
import { sha256Hex } from "../lib/sha256";
import { todayStr } from "../lib/localDate";
import { parsePbDate } from "../lib/format";
import type { ReadinessQuestion, ReadinessAnswer } from "../lib/computeLectureReadiness";

export type QuizSize = 5 | 8 | 12;

export class QuizError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

function currentUserId(): string {
  return String(pb.authStore.record?.id ?? "");
}

/** Текст лекции и его хеш — используется и для кэша, и для запуска генерации. */
export async function lectureTextAndHash(
  html: string
): Promise<{ text: string; hash: string }> {
  const text = extractText(html);
  const hash = await sha256Hex(normalizeText(text));
  return { text, hash };
}

/** Найти уже сгенерированный квиз с тем же хешем и размером (кэш). */
export async function findCachedQuiz(
  lectureId: string,
  hash: string,
  size: QuizSize
): Promise<Quiz | null> {
  try {
    return await pb.collection("quizzes").getFirstListItem<Quiz>(
      `${FIELDS.quizLecture}="${lectureId}" && ${FIELDS.quizSourceHash}="${hash}" && ${FIELDS.quizSize}=${size}`,
      { sort: "-created" }
    );
  } catch {
    return null;
  }
}

/** Вопросы конкретного квиза, по порядку. */
export async function fetchQuizQuestions(quizId: string): Promise<QuizQuestion[]> {
  return pb.collection("quiz_questions").getFullList<QuizQuestion>({
    filter: `${FIELDS.qqQuiz}="${quizId}" && ${FIELDS.qqHidden}=false`,
    sort: FIELDS.qqPosition,
  });
}

export interface GeneratedQuestion {
  type: QuizQuestionType;
  topic: string;
  prompt: string;
  options?: string[];
  correct_index?: number;
  answer?: string;
  explanation: string;
  quote?: string | null;
}

/**
 * Вызов CF Function. Бросает QuizError с кодом из spec 6.2:
 * not_enough_text | daily_limit | generation_failed | unauthorized | network.
 */
export async function requestGeneration(
  lectureId: string,
  title: string,
  text: string,
  size: QuizSize
): Promise<{ model: string; questions: GeneratedQuestion[] }> {
  const token = pb.authStore.token;
  let res: Response;
  try {
    res = await fetch("/api/quiz/generate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify({ lectureId, title, text, size }),
    });
  } catch {
    throw new QuizError("network");
  }

  if (res.status === 401) {
    // Один повтор после тихого обновления токена (spec 6.2).
    try {
      await pb.collection("users").authRefresh();
    } catch {
      throw new QuizError("unauthorized");
    }
    const retryRes = await fetch("/api/quiz/generate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: pb.authStore.token,
      },
      body: JSON.stringify({ lectureId, title, text, size }),
    });
    if (!retryRes.ok) {
      const data = await retryRes.json().catch(() => ({ error: "generation_failed" }));
      throw new QuizError(data.error ?? "generation_failed");
    }
    return retryRes.json();
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "generation_failed" }));
    throw new QuizError(data.error ?? "generation_failed");
  }

  return res.json();
}

/** Сохранить квиз + вопросы (quiz создаётся первым, вопросы — параллельно). */
export async function saveQuiz(
  lectureId: string,
  hash: string,
  size: QuizSize,
  model: string,
  questions: GeneratedQuestion[]
): Promise<{ quiz: Quiz; questions: QuizQuestion[] }> {
  const owner = currentUserId();
  const quiz = await pb.collection("quizzes").create<Quiz>({
    [FIELDS.quizOwner]: owner,
    [FIELDS.quizLecture]: lectureId,
    [FIELDS.quizSourceHash]: hash,
    [FIELDS.quizSize]: size,
    [FIELDS.quizModel]: model,
  });

  const created = await Promise.all(
    questions.map((q, i) =>
      pb.collection("quiz_questions").create<QuizQuestion>({
        [FIELDS.qqOwner]: owner,
        [FIELDS.qqQuiz]: quiz.id,
        [FIELDS.qqLecture]: lectureId,
        [FIELDS.qqPosition]: i,
        [FIELDS.qqType]: q.type,
        [FIELDS.qqTopic]: q.topic,
        [FIELDS.qqPrompt]: q.prompt,
        [FIELDS.qqOptions]: q.options ?? null,
        [FIELDS.qqCorrectIndex]: q.correct_index ?? null,
        [FIELDS.qqAnswer]: q.answer ?? "",
        [FIELDS.qqExplanation]: q.explanation,
        [FIELDS.qqQuote]: q.quote ?? "",
      })
    )
  );

  return { quiz, questions: created.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)) };
}

/** Записать ответ на вопрос (spec 6.3: каждый ответ сразу пишется). */
export async function submitAnswer(
  questionId: string,
  lectureId: string,
  correct: boolean,
  attempt: string
): Promise<QuizAnswer> {
  return pb.collection("quiz_answers").create<QuizAnswer>({
    [FIELDS.qaOwner]: currentUserId(),
    [FIELDS.qaQuestion]: questionId,
    [FIELDS.qaLecture]: lectureId,
    [FIELDS.qaCorrect]: correct,
    [FIELDS.qaAnsweredAt]: todayStr(),
    [FIELDS.qaAttempt]: attempt,
  });
}

export async function flagQuestion(questionId: string): Promise<void> {
  await pb.collection("quiz_questions").update(questionId, { [FIELDS.qqFlagged]: true });
}

export async function hideQuestion(questionId: string): Promise<void> {
  await pb.collection("quiz_questions").update(questionId, { [FIELDS.qqHidden]: true });
}

/** Все не скрытые/не «плохие» вопросы лекции + дата создания их квиза (для готовности). */
export async function fetchReadinessQuestions(
  lectureId: string
): Promise<ReadinessQuestion[]> {
  const questions = await pb.collection("quiz_questions").getFullList<QuizQuestion>({
    filter: `${FIELDS.qqLecture}="${lectureId}" && ${FIELDS.qqHidden}=false && ${FIELDS.qqFlagged}=false`,
  });
  if (questions.length === 0) return [];

  const quizIds = Array.from(new Set(questions.map((q) => q.quiz)));
  const quizzes = await Promise.all(
    quizIds.map((id) => pb.collection("quizzes").getOne<Quiz>(id).catch(() => null))
  );
  const quizCreatedById = new Map<string, Date>();
  for (const q of quizzes) {
    const created = q && parsePbDate(q.created);
    if (q && created) quizCreatedById.set(q.id, created);
  }

  return questions
    .filter((q) => quizCreatedById.has(q.quiz))
    .map((q) => ({
      id: q.id,
      quiz: q.quiz,
      quizCreatedAt: quizCreatedById.get(q.quiz)!,
      topic: q.topic ?? "",
      hidden: q.hidden,
      flagged: q.flagged,
    }));
}

/** Все ответы по лекции (для готовности). */
export async function fetchReadinessAnswers(
  lectureId: string
): Promise<ReadinessAnswer[]> {
  const answers = await pb.collection("quiz_answers").getFullList<QuizAnswer>({
    filter: `${FIELDS.qaLecture}="${lectureId}"`,
    sort: FIELDS.qaAnsweredAt,
  });
  return answers.map((a) => ({
    questionId: a.question,
    correct: !!a.correct,
    answeredAt: parsePbDate(a.answered_at ?? a.created) ?? new Date(),
  }));
}
