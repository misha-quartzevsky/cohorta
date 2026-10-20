import type { Lecture, Semester } from "./types";
import { courseSemesterId, semesterSlug } from "./types";
import { lastSemesterSlug } from "./lastSemester";
import { pickActiveSemester } from "./activeSemester";

/**
 * Семестр для адреса лекции: период её предмета, иначе последний посещённый,
 * иначе текущий. Без этого свежий вход (пустой localStorage) давал адрес без семестра.
 */
export function semesterSlugForLecture(lecture: Lecture, semesters: Semester[]): string {
  const course = lecture.expand?.field;
  const own = course ? semesters.find((s) => s.id === courseSemesterId(course)) : undefined;
  if (own) return semesterSlug(own);
  const last = lastSemesterSlug();
  if (last) return last;
  const active = pickActiveSemester(semesters);
  return active ? semesterSlug(active) : "";
}
