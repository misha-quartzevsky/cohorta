/**
 * ============================================
 *  format.ts — общие утилиты отображения
 * ============================================
 */

/** Акцентный CSS-класс градиента плитки (`tile-feature`). */
export type TileAccent = "lilac" | "ginger" | "black";

/** Выбирает акцент по индексу плитки в сетке (0 → lilac, 1 → ginger, 2 → black). */
export function tileAccent(index: number): TileAccent {
  const first = index % 3;
  return first === 0 ? "lilac" : first === 1 ? "ginger" : "black";
}

/**
 * Человекочитаемое сообщение об ошибке из любого значения.
 * Единая точка для блоков `catch (e)`: Error → message, всё остальное → String().
 */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Локальная русская дата из ISO-строки PocketBase
 * (например "2026-01-15 10:00:00.123Z" → "15 января 2026 г.").
 */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso || "";
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}