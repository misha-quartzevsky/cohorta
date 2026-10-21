import { createContext, useContext } from "react";

export type NotifySection = "group" | "access" | "exams";

export interface NotifyValue {
  /** Точки: на «Группа» (в Соло и на кружке «Профиль»), у «Мой доступ» и у «Экзамены». */
  dots: Record<NotifySection, boolean>;
  /** Человек открыл раздел: точка гаснет (время «последний раз смотрел» хранится на устройстве). */
  markSeen: (section: NotifySection) => void;
}

export const NotifyCtx = createContext<NotifyValue>({ dots: { group: false, access: false, exams: false }, markSeen: () => undefined });

export function useNotify(): NotifyValue {
  return useContext(NotifyCtx);
}

const SEEN_PREFIX = "cohorta:seen:";

export function readSeen(key: string): string {
  try {
    return localStorage.getItem(SEEN_PREFIX + key) ?? "";
  } catch {
    return "";
  }
}

export function writeSeen(key: string, iso: string): void {
  try {
    localStorage.setItem(SEEN_PREFIX + key, iso);
  } catch {
    /* без хранилища точка вернётся при следующей загрузке */
  }
}

/** Лекция открыта (значок «Новое» пропадает). */
export function markLectureSeen(lectureId: string): void {
  writeSeen(`lecture:${lectureId}`, new Date().toISOString());
}

/** Выдан ли доступ позже, чем человек открыл лекцию в последний раз. */
export function isLectureNew(lectureId: string, sharedAt: string): boolean {
  const seen = readSeen(`lecture:${lectureId}`);
  return !seen || seen < sharedAt.replace(" ", "T");
}
