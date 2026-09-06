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

/**
 * Имя участника для ростера группы / списка участников экзамена:
 * `name` → часть email до «@» → «Участник». Отличается от userName() тем,
 * что не показывает полный email и падает на «Участник», а не «Пользователь».
 */
export function memberDisplayName(user: Pick<User, "name" | "email">): string {
  const name = user.name ? String(user.name).trim() : "";
  if (name) return name;
  const email = user.email ? String(user.email).trim() : "";
  const local = email.split("@")[0];
  return local || "Участник";
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

/**
 * PocketBase отдаёт datetime как «2026-01-15 10:00:00.123Z» — пробел вместо `T`,
 * это не валидный ISO-8601. Chrome такое парсит, Firefox/Safari возвращают
 * Invalid Date. Нормализуем в ISO и подставляем `Z`, если зоны нет вовсе.
 */
export function parsePbDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const iso = String(value).trim().replace(" ", "T");
  const withZone = /[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`;
  const date = new Date(withZone);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Относительное русское время («15 мин. назад», «вчера», …). */
export function timeAgo(iso: string): string {
  const date = parsePbDate(iso);
  if (!date) return "";
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
  const date = parsePbDate(iso);
  if (!date) return "";
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Короткая локальная дата-время для таймстампа строки при диктовке
 * (эпоха мс или ISO-строка → «6 сент., 14:32»).
 */
export function formatDateTime(value: number | string): string {
  const date =
    typeof value === "number" ? new Date(value) : parsePbDate(value);
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}