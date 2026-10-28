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
import { loadLectureReadinessRows, type LectureReadinessRow } from "../services/lectureReadinessService";
import { lectureListStatus, type LectureListStatus } from "../lib/computeLectureReadiness";
import { useAsyncData } from "./useAsyncData";
import { useLecturesChanged } from "../lib/lecturesChanged";

export type LectureOverviewRow = Pick<LectureReadinessRow, "lecture" | "readiness"> & { status: LectureListStatus };

async function loadOverview(): Promise<LectureOverviewRow[]> {
  const { rows } = await loadLectureReadinessRows();
  return rows.map(({ lecture, readiness }) => ({ lecture, readiness, status: lectureListStatus(readiness) }));
}

export function useLecturesOverview() {
  const fetcher = useCallback(() => loadOverview(), []);
  const { data, loading, error, refetch } = useAsyncData<LectureOverviewRow[]>(fetcher);
  useLecturesChanged(refetch);
  return { rows: data ?? [], loading, error, refetch };
}
