/**
 * Автозадачи повторения (spec 5.3) — данные для lib/getReviewSuggestions.ts.
 * Переиспользует тот же слой, что и «Все лекции» (B2, useLecturesOverview):
 * fetchAllLectures + fetchReadinessQuestionsByLecture/AnswersByLecture,
 * один заход, без N+1.
 */

import { useCallback } from "react";
import { fetchAllLectures } from "../services/lectureService";
import {
  fetchReadinessAnswersByLecture,
  fetchReadinessQuestionsByLecture,
} from "../services/quizService";
import { computeLectureReadiness } from "../lib/computeLectureReadiness";
import { getReviewSuggestions, type ReviewSuggestion } from "../lib/getReviewSuggestions";
import { todayStr, pbDateOnly } from "../lib/localDate";
import { useAsyncData } from "./useAsyncData";
import { lectureTitle } from "../lib/types";

async function loadSuggestions(existingDedupeKeys: ReadonlySet<string>): Promise<ReviewSuggestion[]> {
  const [lectures, questionsByLecture, answersByLecture] = await Promise.all([
    fetchAllLectures(),
    fetchReadinessQuestionsByLecture(),
    fetchReadinessAnswersByLecture(),
  ]);
  const now = new Date();

  const suggestionLectures = lectures.map((lecture) => {
    const questions = questionsByLecture.get(lecture.id) ?? [];
    const answers = answersByLecture.get(lecture.id) ?? [];
    const readiness = computeLectureReadiness(questions, answers, now);
    const lastAnswerDate = readiness.lastActivityAt ? pbDateOnly(readiness.lastActivityAt.toISOString()) : null;
    const updatedDate = pbDateOnly(lecture.updated);
    return {
      id: lecture.id,
      title: lectureTitle(lecture),
      lectureDate: lecture.lecture_date ? pbDateOnly(lecture.lecture_date) : null,
      updatedDate,
      hasQuiz: questions.length > 0,
      hasAnyAttempt: answers.length > 0,
      readinessPercent: readiness.percent,
      lastActivityDate:
        lastAnswerDate && lastAnswerDate > updatedDate ? lastAnswerDate : updatedDate,
    };
  });

  return getReviewSuggestions(suggestionLectures, todayStr(now), existingDedupeKeys);
}

export function useReviewSuggestions(existingDedupeKeys: ReadonlySet<string>) {
  const fetcher = useCallback(() => loadSuggestions(existingDedupeKeys), [existingDedupeKeys]);
  const { data, loading, error, refetch } = useAsyncData<ReviewSuggestion[]>(fetcher);
  return { suggestions: data ?? [], loading, error, refetch };
}
