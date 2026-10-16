import { useEffect, useState } from "react";
import {
  computeLectureReadiness,
  type ReadinessResult,
} from "../lib/computeLectureReadiness";
import { fetchReadinessQuestions, fetchReadinessAnswers } from "../services/quizService";

/** Готовность лекции (spec 6.4), с перезагрузкой по изменению lectureId/version. */
export function useLectureReadiness(lectureId: string | undefined, version = 0) {
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!lectureId) {
      setReadiness(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [qs, ans] = await Promise.all([
          fetchReadinessQuestions(lectureId),
          fetchReadinessAnswers(lectureId),
        ]);
        if (cancelled) return;
        setReadiness(computeLectureReadiness(qs, ans, new Date()));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lectureId, version]);

  return { readiness, loading };
}
