import { useCallback, useEffect, useState } from "react";
import {
  computeLectureReadiness,
  type ReadinessResult,
} from "../lib/computeLectureReadiness";
import { panelStateFor, type QuizPanelState } from "../lib/quizPanelState";
import { fetchReadinessQuestions, fetchReadinessAnswers } from "../services/quizService";

/**
 * Понимание темы по лекции (spec 6.4) и состояние панели (none / created /
 * started / done). Перезагружается по изменению lectureId/version; `refetch`
 * нужен после ответов в квизе и после сборки нового квиза.
 */
export function useLectureReadiness(lectureId: string | undefined, version = 0) {
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [panel, setPanel] = useState<QuizPanelState>({ kind: "none" });
  const [hasQuiz, setHasQuiz] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!lectureId) {
      setReadiness(null);
      setPanel({ kind: "none" });
      setHasQuiz(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [qs, ans] = await Promise.all([
          fetchReadinessQuestions(lectureId),
          fetchReadinessAnswers(lectureId),
        ]);
        if (cancelled) return;
        setHasQuiz(qs.length > 0);
        setReadiness(computeLectureReadiness(qs, ans, new Date()));
        setPanel(panelStateFor(qs, ans));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lectureId, version, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { readiness, hasQuiz, panel, loading, refetch };
}
