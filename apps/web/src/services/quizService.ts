/**
 * ============================================
 *  quizService.ts — квиз по лекции (spec раздел 6)
 * ============================================
 * Генерация через Cloudflare Function, кэш по хешу текста, сохранение
 * квиза и вопросов, запись ответов, «плохой вопрос» / скрыть.
 */

import { pb, currentUserId } from "../lib/pocketbase";
import { FIELDS } from "../lib/types";
import type { Quiz, QuizQuestion, QuizAnswer, QuizQuestionType } from "../lib/types";
import { extractText, normalizeText } from "../lib/extractText";
import { sha256Hex } from "../lib/sha256";
import { parsePbDate } from "../lib/format";
import type { ReadinessQuestion, ReadinessAnswer } from "../lib/computeLectureReadiness";
import type { QuizSize } from "../lib/quizLimits";
import { fetchLecture } from "./lectureService";

export type { QuizSize };

/** Подробности ошибки от сервера: порог текста, лимит и сколько уже создано сегодня. */
export interface QuizErrorDetails {
  min?: number;
  limit?: number;
  used?: number;
}

export class QuizError extends Error {
  code: string;
  details: QuizErrorDetails;
  constructor(code: string, details: QuizErrorDetails = {}) {
    super(code);
    this.code = code;
    this.details = details;
  }
}

async function errorFrom(res: Response): Promise<QuizError> {
  const data = await res.json().catch(() => ({ error: "generation_failed" }));
  return new QuizError(data.error ?? "generation_failed", {
    min: typeof data.min === "number" ? data.min : undefined,
    limit: typeof data.limit === "number" ? data.limit : undefined,
    used: typeof data.used === "number" ? data.used : undefined,
  });
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
    filter: pb.filter(`${FIELDS.qqQuiz}={:q} && ${FIELDS.qqHidden}=false && ${FIELDS.qqFlagged}=false`, { q: quizId }),
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
  size: QuizSize,
  signal?: AbortSignal
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
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw new QuizError("aborted");
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
      signal,
    }).catch((e: unknown) => {
      if (e instanceof DOMException && e.name === "AbortError") throw new QuizError("aborted");
      throw new QuizError("network");
    });
    if (!retryRes.ok) throw await errorFrom(retryRes);
    return retryRes.json();
  }

  if (!res.ok) throw await errorFrom(res);

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

/** Самый свежий квиз лекции (по дате создания) или null. */
export async function fetchLatestQuiz(lectureId: string): Promise<Quiz | null> {
  try {
    return await pb
      .collection("quizzes")
      .getFirstListItem<Quiz>(`${FIELDS.quizLecture}="${lectureId}"`, { sort: "-created" });
  } catch {
    return null;
  }
}

/**
 * Создать квиз по тексту лекции (окно «Создать квиз»): готовый квиз с тем же
 * текстом и размером берётся из кэша без обращения к ИИ (и без траты лимита,
 * лимит считается по созданным квизам), иначе вызывается серверная функция
 * и результат сохраняется. `forceNew` («Собрать другой») кэш игнорирует.
 */
export async function createQuiz(
  lectureId: string,
  size: QuizSize,
  forceNew: boolean,
  signal?: AbortSignal
): Promise<Quiz> {
  // Текст берём из базы в момент создания, а не из того, что открыто на экране:
  // экран мог прочитать лекцию раньше, чем её дописали.
  const lecture = await fetchLecture(lectureId);
  const { text, hash } = await lectureTextAndHash(lecture.content ?? "");
  if (!forceNew) {
    const cached = await findCachedQuiz(lecture.id, hash, size);
    if (cached) return cached;
  }
  const { model, questions } = await requestGeneration(lecture.id, lecture.title, text, size, signal);
  // Отменили, пока шёл ответ ИИ: ничего не сохраняем, попытка не списывается.
  if (signal?.aborted) throw new QuizError("aborted");
  const saved = await saveQuiz(lecture.id, hash, size, model, questions);
  return saved.quiz;
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
    // Точное время, а не только дата: иначе два ответа за один день не отличить,
    // а «последний ответ» нужен и формуле понимания, и продолжению квиза.
    [FIELDS.qaAnsweredAt]: new Date().toISOString(),
    [FIELDS.qaAttempt]: attempt,
  });
}

export async function flagQuestion(questionId: string): Promise<void> {
  await pb.collection("quiz_questions").update(questionId, { [FIELDS.qqFlagged]: true });
}

export async function hideQuestion(questionId: string): Promise<void> {
  await pb.collection("quiz_questions").update(questionId, { [FIELDS.qqHidden]: true });
}

// Поля, которые читает расчёт готовности (остальное с сервера не тянем).
const READINESS_QUESTION_FIELDS = "id,quiz,topic,hidden,flagged";
const READINESS_QUIZ_FIELDS = "id,created";
const READINESS_ANSWER_FIELDS = "question,correct,answered_at,created,attempt";

/** Все не скрытые/не «плохие» вопросы лекции + дата создания их квиза (для готовности). */
export async function fetchReadinessQuestions(
  lectureId: string
): Promise<ReadinessQuestion[]> {
  const questions = await pb.collection("quiz_questions").getFullList<QuizQuestion>({
    filter: pb.filter(`${FIELDS.qqLecture}={:l} && ${FIELDS.qqHidden}=false && ${FIELDS.qqFlagged}=false`, { l: lectureId }),
    fields: READINESS_QUESTION_FIELDS,
  });
  if (questions.length === 0) return [];

  // Квизы этих вопросов одним запросом (раньше getOne на каждый квиз).
  const quizIds = Array.from(new Set(questions.map((q) => q.quiz)));
  const params: Record<string, string> = {};
  const quizFilter = quizIds
    .map((id, i) => {
      params[`q${i}`] = id;
      return `id={:q${i}}`;
    })
    .join(" || ");
  const quizzes = await pb
    .collection("quizzes")
    .getFullList<Quiz>({ filter: pb.filter(quizFilter, params), fields: READINESS_QUIZ_FIELDS })
    .catch(() => [] as Quiz[]);
  const quizCreatedById = new Map<string, Date>();
  for (const q of quizzes) {
    const created = parsePbDate(q.created);
    if (created) quizCreatedById.set(q.id, created);
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
    filter: pb.filter(`${FIELDS.qaLecture}={:l}`, { l: lectureId }),
    sort: "created",
    fields: READINESS_ANSWER_FIELDS,
  });
  return answers.map((a) => ({
    questionId: a.question,
    correct: !!a.correct,
    answeredAt: parsePbDate(a.answered_at || a.created) ?? new Date(),
    attempt: a.attempt ?? "",
  }));
}

/**
 * Готовность ВСЕХ лекций текущего пользователя одним заходом (3 запроса
 * вместо N+1) — для списка «Все лекции» (B2, Screen-lectures.dc.html),
 * где считать готовность по одной лекции за раз было бы слишком дорого.
 */
export async function fetchReadinessQuestionsByLecture(): Promise<
  Map<string, ReadinessQuestion[]>
> {
  const owner = currentUserId();
  if (!owner) return new Map();

  const [questions, quizzes] = await Promise.all([
    pb.collection("quiz_questions").getFullList<QuizQuestion>({
      filter: pb.filter(`${FIELDS.qqOwner}={:o} && ${FIELDS.qqHidden}=false && ${FIELDS.qqFlagged}=false`, { o: owner }),
      fields: `${READINESS_QUESTION_FIELDS},lecture`,
    }),
    pb.collection("quizzes").getFullList<Quiz>({
      filter: pb.filter(`${FIELDS.quizOwner}={:o}`, { o: owner }),
      fields: READINESS_QUIZ_FIELDS,
    }),
  ]);

  const quizCreatedById = new Map<string, Date>();
  for (const q of quizzes) {
    const created = parsePbDate(q.created);
    if (created) quizCreatedById.set(q.id, created);
  }

  const byLecture = new Map<string, ReadinessQuestion[]>();
  for (const q of questions) {
    const quizCreatedAt = quizCreatedById.get(q.quiz);
    if (!quizCreatedAt) continue;
    const list = byLecture.get(q.lecture) ?? [];
    list.push({
      id: q.id,
      quiz: q.quiz,
      quizCreatedAt,
      topic: q.topic ?? "",
      hidden: q.hidden,
      flagged: q.flagged,
    });
    byLecture.set(q.lecture, list);
  }
  return byLecture;
}

/** Ответы ВСЕХ лекций текущего пользователя, сгруппированные по лекции. */
export async function fetchReadinessAnswersByLecture(): Promise<
  Map<string, ReadinessAnswer[]>
> {
  const owner = currentUserId();
  if (!owner) return new Map();

  const answers = await pb.collection("quiz_answers").getFullList<QuizAnswer>({
    filter: pb.filter(`${FIELDS.qaOwner}={:o}`, { o: owner }),
    sort: FIELDS.qaAnsweredAt,
    fields: `${READINESS_ANSWER_FIELDS},lecture`,
  });

  const byLecture = new Map<string, ReadinessAnswer[]>();
  for (const a of answers) {
    const list = byLecture.get(a.lecture) ?? [];
    list.push({
      questionId: a.question,
      correct: !!a.correct,
      answeredAt: parsePbDate(a.answered_at || a.created) ?? new Date(),
    });
    byLecture.set(a.lecture, list);
  }
  return byLecture;
}
