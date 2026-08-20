/**
 * ============================================
 *  lib/lastVisited.ts — «Продолжить» (последняя лекция)
 * ============================================
 *
 * Хранит в localStorage последнюю открытую лекцию, чтобы Dashboard мог
 * показать блок «Продолжить» сразу при заходе (без повторного запроса к БД).
 * Не-component модуль — поэтому Fast Refresh не ломается.
 */

export interface LastVisitedEntry {
  /** Навигационный путь, напр. `/s/5/math/limit` или `/note/idea`. */
  to: string;
  title: string;
  /** Название курса (для независимых заметок — отсутствует). */
  courseName?: string;
  /** Plain-text выдержка контента. */
  excerpt: string;
  /** ISO-метка времени визита. */
  savedAt: string;
}

export const LAST_VISITED_KEY = "cohorta:lastVisited";

/** Читает последнюю посещённую лекцию (null, если её нет или битая). */
export function readLastVisited(): LastVisitedEntry | null {
  try {
    const raw = localStorage.getItem(LAST_VISITED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastVisitedEntry;
    if (!parsed || !parsed.to || !parsed.title) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Записывает последнюю посещённую лекцию. */
export function writeLastVisited(entry: LastVisitedEntry): void {
  try {
    localStorage.setItem(LAST_VISITED_KEY, JSON.stringify(entry));
  } catch {
    /* приватный режим / переполнение — молча игнорируем */
  }
}
