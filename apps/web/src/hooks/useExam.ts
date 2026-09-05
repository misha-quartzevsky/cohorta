/**
 * ============================================
 *  useExam.ts — Exam / ExamTicket Hook
 * ============================================
 *
 * Экзамен резолвится по курсу, не по слагу (у экзамена его нет —
 * он singleton внутри курса), поэтому один фетчер сразу тянет
 * и сам экзамен, и его билеты одним заходом, как в `useDeck`.
 */

import { useCallback } from "react";
import type { Exam, ExamTicket } from "../lib/types";
import { examCourseId, ticketExamId, ticketStatus } from "../lib/types";
import {
  fetchExamByCourse,
  fetchExamsForCourses,
  fetchTickets,
  fetchTicketsForExams,
  fetchUpcomingExam,
} from "../services/examService";
import { useAsyncData } from "./useAsyncData";

export interface UseUpcomingExamResult {
  exam: Exam | null;
  loading: boolean;
}

export interface UseExamResult {
  /** null = экзамен ещё не заведён (штатное состояние курса). */
  exam: Exam | null;
  tickets: ExamTicket[];
  loading: boolean;
  error: string;
  setError: (message: string) => void;
  refetch: () => Promise<void>;
}

/** Экзамен курса (владельца — текущий пользователь) + его билеты. */
export function useExam(
  courseId: string,
  enabled: boolean = true
): UseExamResult {
  const fetcher = useCallback(async (): Promise<{
    exam: Exam | null;
    tickets: ExamTicket[];
  }> => {
    const exam = await fetchExamByCourse(courseId);
    const tickets = exam ? await fetchTickets(exam.id) : [];
    return { exam, tickets };
  }, [courseId]);

  const { data, loading, error, setError, refetch } = useAsyncData(
    fetcher,
    enabled && Boolean(courseId)
  );

  return {
    exam: data?.exam ?? null,
    tickets: data?.tickets ?? [],
    loading,
    error,
    setError,
    refetch,
  };
}

/** Ближайший экзамен пользователя с будущей датой (для дашборда). */
export function useUpcomingExam(): UseUpcomingExamResult {
  const fetcher = useCallback(() => fetchUpcomingExam(), []);
  const { data, loading } = useAsyncData<Exam | null>(fetcher);
  return { exam: data ?? null, loading };
}

export interface ExamSummary {
  exam: Exam;
  ready: number;
  total: number;
}

export interface UseExamsForSemesterResult {
  /** id курса → сводка по его экзамену; курса без экзамена в карте нет. */
  byCourseId: Record<string, ExamSummary>;
  loading: boolean;
}

/**
 * Экзамены + счётчики готовности для набора курсов одним заходом —
 * для сводного экрана «Все экзамены» семестра. Два запроса на весь
 * экран (см. `fetchExamsForCourses`/`fetchTicketsForExams`), не по
 * запросу на курс: с 5-8 курсами семестра параллельные `useExam`
 * на каждый — тот самый N+1, которого здесь нужно избежать.
 *
 * @param courseIds — id курсов текущего семестра (из `useCourses`)
 */
export function useExamsForSemester(
  courseIds: string[]
): UseExamsForSemesterResult {
  // Ключ по содержимому, не по ссылке на массив: `courses.map(c=>c.id)`
  // в родителе создаёт новый массив на каждый рендер, а нам нужна
  // стабильность фетчера при том же наборе id (тот же приём, что
  // `useLectures` — ключ строкой, не объектом).
  const key = courseIds.join(",");
  const fetcher = useCallback(async (): Promise<Record<string, ExamSummary>> => {
    const exams = await fetchExamsForCourses(courseIds);
    if (exams.length === 0) return {};
    const tickets = await fetchTicketsForExams(exams.map((e) => e.id));

    const ticketsByExam = new Map<string, ExamTicket[]>();
    for (const t of tickets) {
      const examId = ticketExamId(t);
      const list = ticketsByExam.get(examId);
      if (list) list.push(t);
      else ticketsByExam.set(examId, [t]);
    }

    const byCourseId: Record<string, ExamSummary> = {};
    for (const exam of exams) {
      const examTickets = ticketsByExam.get(exam.id) ?? [];
      const ready = examTickets.filter((t) => ticketStatus(t) === "ready").length;
      byCourseId[examCourseId(exam)] = { exam, ready, total: examTickets.length };
    }
    return byCourseId;
    // Ключ по содержимому (`key`), не по ссылке на массив: линтер хочет
    // `courseIds` буквально в зависимостях, но родитель пересоздаёт этот
    // массив на каждый рендер (`courses.map(c=>c.id)`) — с `courseIds` в
    // deps фетчер терял бы стабильность и рефетчил на каждый рендер.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const { data, loading } = useAsyncData(fetcher, courseIds.length > 0);
  return { byCourseId: data ?? {}, loading };
}
