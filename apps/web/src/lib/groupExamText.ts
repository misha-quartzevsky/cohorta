import { formatDayMonth, parsePbDate, pluralRu } from "./format";
import { calendarDaysUntil } from "./localDate";

/** Дней до даты экзамена (ISO или «ГГГГ-ММ-ДД чч:мм»); null — даты нет. Прошедшая дата даёт 0. */
export function daysUntil(iso: string, now: Date = new Date()): number | null {
  const days = calendarDaysUntil(iso, now);
  return days === null ? null : Math.max(0, days);
}

/** «через 87 дней», «завтра», «сегодня». */
export function daysLabel(days: number): string {
  if (days === 0) return "сегодня";
  if (days === 1) return "завтра";
  return `через ${days} ${pluralRu(days, ["день", "дня", "дней"])}`;
}

/** Подпись строки экзамена: «12 января · через 87 дней» (без даты — «Дата не задана»). */
export function examWhen(iso: string, dateText: (iso: string) => string): string {
  const days = daysUntil(iso);
  if (days === null) return "Дата не задана";
  return `${dateText(iso)} · ${daysLabel(days)}`;
}

/** «экзамен 12 января» или «дата экзамена не задана» (подпись под заголовком импорта и экзамена). */
export function examDateLabel(iso: string | undefined | null): string {
  const d = parsePbDate(iso);
  if (!d) return "дата экзамена не задана";
  return `экзамен ${formatDayMonth(d)}`;
}
