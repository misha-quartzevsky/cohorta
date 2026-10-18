import { useCallback, useRef, useState } from "react";
import type { Lecture, QuizQuestion } from "../lib/types";
import {
  lectureTextAndHash,
  findCachedQuiz,
  fetchQuizQuestions,
  requestGeneration,
  saveQuiz,
  submitAnswer,
  flagQuestion,
  hideQuestion,
  QuizError,
  type QuizSize,
} from "../services/quizService";

export type QuizErrorCode =
  | "not_enough_text"
  | "daily_limit"
  | "generation_failed"
  | "unauthorized"
  | "network";

export type QuizPhase = "idle" | "loading" | "ready" | "error" | "done";

export interface AnswerRecord {
  questionId: string;
  correct: boolean;
}

/** Перемешать массив (Fisher–Yates), не мутируя исходный. */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Прохождение квиза по лекции (spec 6.2–6.3). Один хук владеет всем
 * жизненным циклом: запуск (кэш/генерация), текущий вопрос, запись
 * ответов, итог.
 */
export function useQuiz(lecture: Lecture) {
  const [phase, setPhase] = useState<QuizPhase>("idle");
  const [error, setError] = useState<QuizErrorCode | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const attemptRef = useRef<string>("");
  const lastSizeRef = useRef<QuizSize>(8);

  const run = useCallback(
    async (size: QuizSize, forceNew: boolean) => {
      setPhase("loading");
      setError(null);
      lastSizeRef.current = size;
      try {
        const { text, hash } = await lectureTextAndHash(lecture.content ?? "");

        let quizId: string;
        let qs: QuizQuestion[];

        const cached = forceNew ? null : await findCachedQuiz(lecture.id, hash, size);
        if (cached) {
          quizId = cached.id;
          qs = await fetchQuizQuestions(quizId);
        } else {
          const { model, questions: generated } = await requestGeneration(
            lecture.id,
            lecture.title,
            text,
            size
          );
          const saved = await saveQuiz(lecture.id, hash, size, model, generated);
          quizId = saved.quiz.id;
          qs = saved.questions;
        }

        attemptRef.current = crypto.randomUUID();
        setQuestions(qs);
        setIndex(0);
        setAnswers([]);
        setPhase(qs.length > 0 ? "ready" : "error");
        if (qs.length === 0) setError("generation_failed");
      } catch (e) {
        if (e instanceof QuizError) {
          setError(e.code as QuizErrorCode);
        } else {
          setError("network");
        }
        setPhase("error");
      }
    },
    [lecture]
  );

  const start = useCallback(
    (size: QuizSize = 8, forceNew = false) => void run(size, forceNew),
    [run]
  );

  const retry = useCallback(() => void run(lastSizeRef.current, false), [run]);

  /** «Ещё раз»: тот же набор вопросов, порядок перемешан. */
  const restartSame = useCallback(() => {
    setQuestions((qs) => shuffle(qs));
    setIndex(0);
    setAnswers([]);
    attemptRef.current = crypto.randomUUID();
    setPhase("ready");
  }, []);

  /** «Новый квиз»: игнорирует кэш, учитывает дневной лимит. */
  const restartNew = useCallback(() => void run(lastSizeRef.current, true), [run]);

  const current = questions[index] ?? null;

  const answerCurrent = useCallback(
    async (correct: boolean) => {
      if (!current) return;
      setAnswers((prev) => [...prev, { questionId: current.id, correct }]);
      try {
        await submitAnswer(current.id, lecture.id, correct, attemptRef.current);
      } catch {
        // Не блокируем прохождение, если запись ответа не удалась —
        // попытка уже видна на экране, при желании можно будет повторить.
      }
    },
    [current, lecture.id]
  );

  const next = useCallback(() => {
    setIndex((i) => {
      const n = i + 1;
      if (n >= questions.length) {
        setPhase("done");
        return i;
      }
      return n;
    });
  }, [questions.length]);

  const flagCurrent = useCallback(async () => {
    if (!current) return;
    await flagQuestion(current.id);
  }, [current]);

  const hideCurrent = useCallback(async () => {
    if (!current) return;
    await hideQuestion(current.id);
  }, [current]);

  const correctCount = answers.filter((a) => a.correct).length;

  return {
    phase,
    error,
    questions,
    index,
    current,
    answers,
    correctCount,
    attempt: attemptRef.current,
    start,
    retry,
    restartSame,
    restartNew,
    answerCurrent,
    next,
    flagCurrent,
    hideCurrent,
  };
}

export type UseQuizResult = ReturnType<typeof useQuiz>;
