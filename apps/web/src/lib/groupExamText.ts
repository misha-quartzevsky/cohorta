import { pluralRu } from "./format";

/** Дней до даты экзамена (ISO или «ГГГГ-ММ-ДД чч:мм»); null — даты нет. Прошедшая дата даёт 0. */
export function daysUntil(iso: string, now: Date = new Date()): number | null {
  if (!iso) return null;
  const d = new Date(iso.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return null;
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((a - b) / 86400000));
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
