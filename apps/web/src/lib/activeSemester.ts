import type { Semester } from "./types";
import { semesterSlug } from "./types";
import { lastSemesterSlug } from "./lastSemester";

/**
 * Активный семестр для глобальных экранов (расписание). Решение проекта:
 * текущий определяется флагом is_current, иначе — последний посещённый,
 * иначе — старший по order (см. docs/decisions.md).
 */
export function pickActiveSemester(semesters: Semester[]): Semester | null {
  if (semesters.length === 0) return null;
  const flagged = semesters.find((s) => s.is_current === true);
  if (flagged) return flagged;
  const last = lastSemesterSlug();
  const byLast = semesters.find((s) => semesterSlug(s) === last);
  if (byLast) return byLast;
  return [...semesters].sort((a, b) => (b.order ?? 0) - (a.order ?? 0))[0];
}
