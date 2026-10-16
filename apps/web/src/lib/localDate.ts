/**
 * Локальные даты без времени (spec раздел 3). Храним как YYYY-MM-DD,
 * чтобы не ловить сдвиги часовых поясов. Недели — с понедельника.
 */

/** Сегодня в локальной зоне как YYYY-MM-DD. */
export function todayStr(now: Date = new Date()): string {
  return toDateStr(now);
}

/** Date → YYYY-MM-DD в локальной зоне. */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * PocketBase сериализует поля типа `date` как полный ISO-datetime
 * ("2026-10-25 00:00:00.000Z"), даже если писали только "YYYY-MM-DD".
 * Нормализуем обратно до чистой даты сразу на границе сервисного слоя,
 * чтобы строковые сравнения (`due === today`) и fromDateStr не ломались.
 */
export function pbDateOnly(value: string | null | undefined): string {
  if (!value) return "";
  return String(value).slice(0, 10);
}

/** YYYY-MM-DD → Date (полдень локально, чтобы DST не сдвигал день). */
export function fromDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** Понедельник недели данной даты (возвращает Date, полдень). */
export function mondayOf(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  const dow = (date.getDay() + 6) % 7; // 0 = понедельник
  date.setDate(date.getDate() - dow);
  return date;
}

/** Добавить дней к дате. */
export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

/** Целых дней между двумя датами (b - a), по локальной полуночи. */
export function daysBetween(a: Date, b: Date): number {
  const ma = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const mb = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((mb - ma) / 86400000);
}

/** 1 = понедельник … 7 = воскресенье. */
export function weekdayMon1(d: Date): number {
  return ((d.getDay() + 6) % 7) + 1;
}
