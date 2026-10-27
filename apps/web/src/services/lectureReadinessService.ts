/**
 * Лекции пользователя вместе с вопросами, ответами и готовностью каждой — один заход
 * (3 запроса вместо N+1). Общий источник для «Все лекции» (useLecturesOverview) и
 * автозадач повторения (useReviewSuggestions).
 */

import { computeLectureReadiness, type ReadinessAnswer, type ReadinessQuestion, type ReadinessResult } from "../lib/computeLectureReadiness";
import type { Lecture } from "../lib/types";
import { fetchAllLectures } from "./lectureService";
import { fetchReadinessAnswersByLecture, fetchReadinessQuestionsByLecture } from "./quizService";

export interface LectureReadinessRow {
  lecture: Lecture;
  questions: ReadinessQuestion[];
  answers: ReadinessAnswer[];
  readiness: ReadinessResult;
}

export interface LectureReadinessData {
  rows: LectureReadinessRow[];
  /** Момент расчёта: от него считаются «дней назад» и сегодняшняя дата. */
  now: Date;
}

/** @param options.lectureContent false — не тянуть текст лекций (нужен только «Все лекции» для счётчика слов черновиков). */
export async function loadLectureReadinessRows(options: { lectureContent?: boolean } = {}): Promise<LectureReadinessData> {
  const [lectures, questionsByLecture, answersByLecture] = await Promise.all([
    fetchAllLectures({ content: options.lectureContent }),
    fetchReadinessQuestionsByLecture(),
    fetchReadinessAnswersByLecture(),
  ]);
  const now = new Date();
  const rows = lectures.map((lecture) => {
    const questions = questionsByLecture.get(lecture.id) ?? [];
    const answers = answersByLecture.get(lecture.id) ?? [];
    return { lecture, questions, answers, readiness: computeLectureReadiness(questions, answers, now) };
  });
  return { rows, now };
}
