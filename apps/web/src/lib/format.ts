/**
 * ============================================
 *  format.ts — общие утилиты отображения
 * ============================================
 */

import type { User } from "./types";

/** Отображаемое имя пользователя (фолбэк на email или нейтральное). */
export function userName(user: User): string {
  const name = user.name ? String(user.name).trim() : "";
  return name || user.email || "Пользователь";
}

/** Русские формы множественного числа: [1, 2, 5] → ["материал","материала","материалов"]. */
export function pluralRu(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

/** Относительное русское время («15 мин. назад», «вчера», …). */
export function timeAgo(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин. назад`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} ч. назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "вчера";
  if (days < 30) return `${days} дн. назад`;
  return formatDate(iso);
}

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