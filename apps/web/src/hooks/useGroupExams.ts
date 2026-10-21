import { useCallback, useEffect, useState } from "react";
import { fetchGroupExams, type GroupExamRow } from "../services/groupExamApi";

/** Экзамены выбранной группы (обновляются при возврате на вкладку). */
export function useGroupExams(groupId: string) {
  const [exams, setExams] = useState<GroupExamRow[]>([]);
  const [loading, setLoading] = useState(!!groupId);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!groupId) return;
    try {
      setExams(await fetchGroupExams(groupId));
      setError("");
    } catch {
      setError("Не удалось загрузить экзамены. Проверь связь и попробуй ещё раз.");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    setLoading(!!groupId);
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [groupId, load]);

  return { exams, loading, error, refetch: load };
}
