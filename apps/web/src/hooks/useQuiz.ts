import { useCallback, useEffect, useRef, useState } from "react";
import type { QuizQuestion } from "../lib/types";
import type { ReadinessAnswer, ReadinessQuestion } from "../lib/computeLectureReadiness";
import { derivePanelState, unansweredIds } from "../lib/quizPanelState";
import { topicKey, type AnswerRef } from "../lib/quizSummary";
import {
  fetchLatestQuiz,
  fetchQuizQuestions,
  fetchReadinessAnswers,
  fetchReadinessQuestions,
  flagQuestion,
  hideQuestion,
  submitAnswer,
} from "../services/quizService";

/**
 * Как открыть прохождение:
 *  auto     — само: идёт прохождение → продолжить; пройден → «Проверить себя»; иначе с начала
 *  continue — с того же места (в прохождении, которое осталось незаконченным)
 *  restart  — «Начать заново»: новое прохождение с первого вопроса, прежние ответы остаются в истории
 *  again    — «Проверить себя»: новое прохождение, порядок вопросов перемешан
 */
export type QuizMode = "auto" | "continue" | "restart" | "again";

export type QuizPhase = "loading" | "ready" | "done" | "error" | "empty";

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
 * Прохождение квиза по лекции (spec 6.3). Квиз к этому моменту уже создан
 * (окно «Создать квиз» в панели) — здесь только прохождение: ответы пишутся в
 * `quiz_answers` сразу, поэтому выход посередине ничего не теряет, а возврат
 * продолжает с первого неотвеченного вопроса.
 */
export function useQuiz(lectureId: string, mode: QuizMode) {
  const [phase, setPhase] = useState<QuizPhase>("loading");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  /** Очередь на это прохождение (без уже отвеченных при продолжении). */
  const [queue, setQueue] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  /** Сколько вопросов этого прохождения отвечено до открытия экрана (при продолжении). */
  const [offset, setOffset] = useState(0);
  const [answers, setAnswers] = useState<AnswerRef[]>([]);
  const [attempt, setAttempt] = useState("");
  const [allAnswers, setAllAnswers] = useState<ReadinessAnswer[]>([]);
  const [readinessQuestions, setReadinessQuestions] = useState<ReadinessQuestion[]>([]);
  /** Вопросы, помеченные «плохими» в этом прохождении: из итога и формулы они уже выпали. */
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());
  const attemptRef = useRef("");

  const begin = useCallback((qs: QuizQuestion[], id: string, done: number, previous: AnswerRef[]) => {
    attemptRef.current = id;
    setAttempt(id);
    setQueue(qs);
    setIndex(0);
    setOffset(done);
    setAnswers(previous);
    setPhase(qs.length > 0 ? "ready" : "done");
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    void (async () => {
      try {
        const quiz = await fetchLatestQuiz(lectureId);
        if (!quiz) {
          if (!cancelled) setPhase("empty");
          return;
        }
        const [qs, ans, rqs] = await Promise.all([
          fetchQuizQuestions(quiz.id),
          fetchReadinessAnswers(lectureId),
          fetchReadinessQuestions(lectureId),
        ]);
        if (cancelled) return;
        if (qs.length === 0) {
          setPhase("empty");
          return;
        }
        setQuestions(qs);
        setAllAnswers(ans);
        setReadinessQuestions(rqs);

        const ids = qs.map((q) => q.id);
        const panel = derivePanelState(
          ids,
          ans.map((a) => ({ questionId: a.questionId, attempt: a.attempt ?? "", answeredAt: a.answeredAt }))
        );
        const resolved: Exclude<QuizMode, "auto"> =
          mode !== "auto"
            ? mode
            : panel.kind === "started"
              ? "continue"
              : panel.kind === "done"
                ? "again"
                : "restart";

        if (resolved === "continue" && panel.kind === "started") {
          const left = new Set(
            unansweredIds(
              ids,
              ans.map((a) => ({ questionId: a.questionId, attempt: a.attempt ?? "", answeredAt: a.answeredAt })),
              panel.attempt
            )
          );
          const previous = ans
            .filter((a) => (a.attempt ?? "") === panel.attempt && ids.includes(a.questionId))
            .map((a) => ({ questionId: a.questionId, correct: a.correct }));
          begin(
            qs.filter((q) => left.has(q.id)),
            panel.attempt,
            panel.answered,
            previous
          );
          return;
        }
        begin(resolved === "again" ? shuffle(qs) : qs, crypto.randomUUID(), 0, []);
      } catch {
        if (!cancelled) setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lectureId, mode, begin]);

  const current = queue[index] ?? null;
  const total = offset + queue.length;

  const answerCurrent = useCallback(
    async (correct: boolean) => {
      if (!current) return;
      setAnswers((prev) => [...prev, { questionId: current.id, correct }]);
      const record: ReadinessAnswer = {
        questionId: current.id,
        correct,
        answeredAt: new Date(),
        attempt: attemptRef.current,
      };
      setAllAnswers((prev) => [...prev, record]);
      try {
        await submitAnswer(current.id, lectureId, correct, attemptRef.current);
      } catch {
        // Не блокируем прохождение, если запись не удалась: ответ виден на экране.
      }
    },
    [current, lectureId]
  );

  const next = useCallback(() => {
    setIndex((i) => {
      const n = i + 1;
      if (n >= queue.length) {
        setPhase("done");
        return i;
      }
      return n;
    });
  }, [queue.length]);

  /** «Плохой вопрос»: больше не показываем, сразу к следующему. */
  const flagCurrent = useCallback(async () => {
    if (!current) return;
    const id = current.id;
    setFlaggedIds((prev) => new Set(prev).add(id));
    try {
      await flagQuestion(id);
    } finally {
      next();
    }
  }, [current, next]);

  const hideCurrent = useCallback(async () => {
    if (!current) return;
    await hideQuestion(current.id);
  }, [current]);

  /** «Повторить слабые темы»: новое прохождение только по вопросам этих тем. */
  const startWeak = useCallback(
    (topicKeys: string[]) => {
      const keys = new Set(topicKeys);
      const subset = questions.filter((q) => keys.has(topicKey(q.topic ?? "")));
      begin(shuffle(subset), crypto.randomUUID(), 0, []);
    },
    [questions, begin]
  );

  return {
    phase,
    questions: questions.filter((q) => !flaggedIds.has(q.id)),
    current,
    index,
    /** Вопросов в этом прохождении, включая отвеченные раньше. */
    total,
    /** Номер текущего вопроса, с единицы, считая отвеченные раньше. */
    position: offset + index + 1,
    answers,
    correctCount: answers.filter((a) => a.correct).length,
    attempt,
    allAnswers,
    readinessQuestions: readinessQuestions.map((q) => (flaggedIds.has(q.id) ? { ...q, flagged: true } : q)),
    answerCurrent,
    next,
    flagCurrent,
    hideCurrent,
    startWeak,
  };
}

export type UseQuizResult = ReturnType<typeof useQuiz>;
