import { pluralRu } from "./format";

/** «11 октября» (с годом, если не текущий). */
export function lectureDateLabel(date: Date, now: Date = new Date()): string {
  const opts: Intl.DateTimeFormatOptions =
    date.getFullYear() === now.getFullYear() ? { day: "numeric", month: "long" } : { day: "numeric", month: "long", year: "numeric" };
  return date.toLocaleDateString("ru-RU", opts);
}

/** «повторяли сегодня», «вчера», «4 дня назад» — по последнему ответу в квизах. */
export function repeatedAgoLabel(last: Date, now: Date = new Date()): string {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.max(0, Math.round((startOf(now) - startOf(last)) / 86_400_000));
  if (days === 0) return "повторяли сегодня";
  if (days === 1) return "повторяли вчера";
  return `повторяли ${days} ${pluralRu(days, ["день", "дня", "дней"])} назад`;
}
