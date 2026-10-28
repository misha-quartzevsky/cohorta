/**
 * Автозадачи повторения (spec 5.3) — данные для lib/getReviewSuggestions.ts.
 * Источник тот же, что у «Все лекции» (services/lectureReadinessService.ts), текст лекций не
 * тянем. Запросы идут один раз; когда меняется набор уже выполненных/скрытых подсказок
 * (`existingDedupeKeys`) или семестры, список только пересчитывается, без новой загрузки.
 */

import { useMemo } from "react";
import { getReviewSuggestions, type ReviewSuggestion } from "../lib/getReviewSuggestions";
import { todayStr, pbDateOnly } from "../lib/localDate";
import { useAsyncData } from "./useAsyncData";
import { lectureTitle, lectureHref } from "../lib/types";
import { semesterSlugForLecture } from "../lib/lectureSemester";
import { useSemester } from "../lib/semesterContext";
import type { Semester } from "../lib/types";
import { loadLectureReadinessRows, type LectureReadinessData } from "../services/lectureReadinessService";

const loadRows = () => loadLectureReadinessRows({ lectureContent: false });
const NONE: ReviewSuggestion[] = [];

function buildSuggestions(
  { rows, now }: LectureReadinessData,
  existingDedupeKeys: ReadonlySet<string>,
  semesters: Semester[]
): ReviewSuggestion[] {
  const suggestionLectures = rows.map(({ lecture, questions, answers, readiness }) => {
    const lastAnswerDate = readiness.lastActivityAt ? pbDateOnly(readiness.lastActivityAt.toISOString()) : null;
    const updatedDate = pbDateOnly(lecture.updated);
    return {
      id: lecture.id,
      title: lectureTitle(lecture),
      subjectId: lecture.field || undefined,
      lectureHref: lectureHref(lecture, semesterSlugForLecture(lecture, semesters)),
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
  const { semesters } = useSemester();
  const { data, loading, error, refetch } = useAsyncData<LectureReadinessData>(loadRows);
  const suggestions = useMemo(
    () => (data ? buildSuggestions(data, existingDedupeKeys, semesters) : NONE),
    [data, existingDedupeKeys, semesters]
  );
  return { suggestions, loading, error, refetch };
}
