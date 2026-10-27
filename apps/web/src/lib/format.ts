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

/** «АК» из «Анастасия К.» — первые буквы первых двух слов имени. */
export function nameInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
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

/** Месяцы в родительном падеже: «12 января». */
export const MONTHS_GENITIVE = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

/** Короткие названия месяцев: «12 янв». */
export const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

/** «12 января» (long) или «12 янв» (short) по локальному времени. */
export function formatDayMonth(d: Date, style: "long" | "short" = "long"): string {
  return `${d.getDate()} ${(style === "long" ? MONTHS_GENITIVE : MONTHS_SHORT)[d.getMonth()]}`;
}

/**
 * День и месяц из строки даты через Intl: «26 октября» (long) или «26 окт» (short, без точки).
 * Пусто, если даты нет или она не разбирается. Для списков лекций (строка читается как есть).
 */
export function formatLocaleDayMonth(dateStr: string | undefined, month: "long" | "short"): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month }).replace(".", "");
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
  const hasZone = /[zZ]|[+-]\d\d:?\d\d$/.test(iso);
  // Дата без времени («2026-10-26») — полночь UTC, как у `new Date("2026-10-26")`.
  const withZone = hasZone ? iso : /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00Z` : `${iso}Z`;
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
  const base = e instanceof Error ? e.message : String(e);
  // Ошибка PocketBase «Failed to create record» без причины бесполезна: добавляем поля с замечаниями.
  const data = (e as { response?: { data?: Record<string, { message?: string }> } } | null)?.response?.data;
  const details =
    data && typeof data === "object"
      ? Object.entries(data)
          .map(([k, v]) => `${k}: ${v?.message ?? ""}`.trim())
          .join("; ")
      : "";
  return details ? `${base} (${details})` : base;
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