/**
 * ============================================
 *  useLecturesOverview.ts — «Все лекции» (B2)
 * ============================================
 *
 * Все лекции пользователя + готовность и статус каждой (lib/
 * computeLectureReadiness) одним заходом — 3 запроса вместо N+1
 * (services/quizService.ts: fetchReadinessQuestionsByLecture/
 * fetchReadinessAnswersByLecture).
 */

import { useCallback } from "react";
import type { Lecture } from "../lib/types";
import { fetchAllLectures } from "../services/lectureService";
import {
  fetchReadinessAnswersByLecture,
  fetchReadinessQuestionsByLecture,
} from "../services/quizService";
import {
  computeLectureReadiness,
  lectureListStatus,
  type LectureListStatus,
  type ReadinessResult,
} from "../lib/computeLectureReadiness";
import { useAsyncData } from "./useAsyncData";
import { useLecturesChanged } from "../lib/lecturesChanged";

export interface LectureOverviewRow {
  lecture: Lecture;
  readiness: ReadinessResult;
  status: LectureListStatus;
}

async function loadOverview(): Promise<LectureOverviewRow[]> {
  const [lectures, questionsByLecture, answersByLecture] = await Promise.all([
    fetchAllLectures(),
    fetchReadinessQuestionsByLecture(),
    fetchReadinessAnswersByLecture(),
  ]);
  const now = new Date();
  return lectures.map((lecture) => {
    const readiness = computeLectureReadiness(
      questionsByLecture.get(lecture.id) ?? [],
      answersByLecture.get(lecture.id) ?? [],
      now
    );
    return { lecture, readiness, status: lectureListStatus(readiness) };
  });
}

export function useLecturesOverview() {
  const fetcher = useCallback(() => loadOverview(), []);
  const { data, loading, error, refetch } = useAsyncData<LectureOverviewRow[]>(fetcher);
  useLecturesChanged(refetch);
  return { rows: data ?? [], loading, error, refetch };
}
