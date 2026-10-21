import { useEffect, useState } from "react";
import { pb } from "../lib/pocketbase";
import { FIELDS } from "../lib/types";

/** Счётчики вкладок предмета: лекции и пары (у «Экзамен» счётчика нет). */
export function useSubjectTabCounts(courseId: string | undefined): { lectures?: number; pairs?: number } {
  const [counts, setCounts] = useState<{ lectures?: number; pairs?: number }>({});

  useEffect(() => {
    if (!courseId) return;
    let alive = true;
    const total = (collection: string, field: string) =>
      pb
        .collection(collection)
        .getList(1, 1, { filter: pb.filter(`${field} = {:id}`, { id: courseId }), skipTotal: false })
        .then((r) => r.totalItems)
        .catch(() => undefined);
    void Promise.all([total("lectures", FIELDS.lectureCourse), total("schedule_slots", FIELDS.slotSubject)]).then(
      ([lectures, pairs]) => {
        if (alive) setCounts({ lectures, pairs });
      }
    );
    return () => {
      alive = false;
    };
  }, [courseId]);

  return counts;
}
