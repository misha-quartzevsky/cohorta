/**
 * Периоды учёбы по умолчанию (онбординг, шаг 4, и «Периоды учёбы» в
 * настройках). Решение 19.10: форма обучения × число периодов в году,
 * например специалитет 6 лет × 2 семестра = 12. Даты образцовые
 * (семестр 1: 01.09–31.01, семестр 2: 01.02–30.06), меняются в
 * настройках. Автопереключения семестра по датам пока нет.
 */

import type { DegreeLevel, PeriodType } from "./types";

/** Сколько лет длится обучение на ступени. */
export const DEGREE_YEARS: Record<DegreeLevel, number> = {
  bachelor: 4,
  specialist: 6,
  master: 2,
  // «Другое»: типового срока нет, берём как у бакалавриата (допущение, см. PROGRESS).
  other: 4,
};

/** Сколько периодов в учебном году. */
export const PERIODS_PER_YEAR: Record<PeriodType, number> = {
  semester: 2,
  trimester: 3,
  quarter: 4,
  module: 2,
  custom: 2,
};

const WORD: Record<PeriodType, string> = {
  semester: "Семестр",
  trimester: "Триместр",
  quarter: "Четверть",
  module: "Модуль",
  custom: "Период",
};

export interface PlannedPeriod {
  label: string;
  order: number;
  type: PeriodType;
  /** YYYY-MM-DD; только у семестров (образцовые даты). */
  date_from?: string;
  date_to?: string;
  is_current: boolean;
}

export interface PlanInput {
  degree: DegreeLevel;
  /** Курс (год обучения), 1…. */
  course: number;
  type: PeriodType;
  /** Своё слово для `custom` («модуль»). */
  customWord?: string;
  years?: number;
  perYear?: number;
  today?: Date;
}

/** Подпись периода: «Семестр 3», для своего названия — «Модуль 3». */
export function periodTitle(order: number, type: PeriodType, customWord = ""): string {
  let word = WORD[type];
  if (type === "custom") {
    const w = customWord.trim();
    if (w) word = w.charAt(0).toUpperCase() + w.slice(1);
  }
  return `${word} ${order}`;
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function toIso(d: Date): string {
  return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Первый год учебного года, в котором мы сейчас (учебный год начинается 1 сентября). */
export function academicYearStart(today: Date): number {
  return today.getMonth() + 1 >= 9 ? today.getFullYear() : today.getFullYear() - 1;
}

/** Образцовые даты семестра с номером `n` (1-based), курс 1 начался осенью `firstYear`. */
function sampleSemesterDates(n: number, firstYear: number): { from: string; to: string } {
  const year = Math.floor((n - 1) / 2);
  const autumn = (n - 1) % 2 === 0;
  const y = firstYear + year;
  return autumn ? { from: iso(y, 9, 1), to: iso(y + 1, 1, 31) } : { from: iso(y + 1, 2, 1), to: iso(y + 1, 6, 30) };
}

/**
 * Образцовые даты для периода с номером `order`, который добавляют к
 * существующим (кнопка «Добавить период»). Только у семестров; год начала
 * берём из первого периода, а если его даты пусты — от нынешнего учебного года.
 */
export function sampleDatesFor(
  order: number,
  type: PeriodType,
  firstFrom: string | undefined,
  today: Date = new Date()
): { from: string; to: string } | null {
  if (type !== "semester") return null;
  const y = firstFrom && /^\d{4}/.test(firstFrom) ? Number(firstFrom.slice(0, 4)) : academicYearStart(today);
  const d = sampleSemesterDates(order, y);
  return { from: d.from, to: d.to };
}

/**
 * Набор периодов по умолчанию. Текущий: у семестров — тот, чьи даты
 * включают сегодня (летом — ближайший следующий); у остальных типов дат
 * нет, текущим ставится первый период нынешнего курса.
 */
export function planPeriods(input: PlanInput): PlannedPeriod[] {
  const today = input.today ?? new Date();
  const years = input.years ?? DEGREE_YEARS[input.degree];
  const perYear = input.perYear ?? PERIODS_PER_YEAR[input.type];
  const total = Math.max(1, years * perYear);
  const course = Math.min(Math.max(1, Math.round(input.course)), years);
  const firstYear = academicYearStart(today) - (course - 1);

  const rows: PlannedPeriod[] = [];
  for (let n = 1; n <= total; n += 1) {
    const row: PlannedPeriod = {
      label: periodTitle(n, input.type, input.customWord),
      order: n,
      type: input.type,
      is_current: false,
    };
    if (input.type === "semester") {
      const d = sampleSemesterDates(n, firstYear);
      row.date_from = d.from;
      row.date_to = d.to;
    }
    rows.push(row);
  }

  let current = (course - 1) * perYear; // индекс первого периода нынешнего курса
  if (input.type === "semester") {
    const t = toIso(today);
    const inside = rows.findIndex((r) => r.date_from! <= t && t <= r.date_to!);
    const next = rows.findIndex((r) => r.date_from! > t);
    if (inside >= 0) current = inside;
    else if (next >= 0) current = next;
    else current = rows.length - 1;
  }
  rows[Math.min(current, rows.length - 1)].is_current = true;
  return rows;
}

// Как в макете: «1 сен – 31 янв», «1 фев – 30 июн».
const MONTHS_MOCK = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

/** «1 сен» из YYYY-MM-DD. */
export function shortDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return "";
  return `${Number(m[3])} ${MONTHS_MOCK[Number(m[2]) - 1]}`;
}

/** «1 сен – 31 янв» (без года) или «1 сен 2025 – 31 янв 2026» с годом. */
export function dateRangeLabel(from?: string, to?: string, withYear = false): string {
  if (!from || !to) return "";
  const y = (v: string) => v.slice(0, 4);
  return withYear ? `${shortDate(from)} ${y(from)} – ${shortDate(to)} ${y(to)}` : `${shortDate(from)} – ${shortDate(to)}`;
}

/** «01.09.2025» из YYYY-MM-DD (поля дат в настройках). */
export function ruDate(value?: string): string {
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

/** YYYY-MM-DD из «01.09.2025»; пусто, если разобрать нельзя. */
export function parseRuDate(text: string): string {
  const m = /^\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\s*$/.exec(text);
  if (!m) return "";
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  const probe = new Date(y, mo - 1, d);
  if (probe.getFullYear() !== y || probe.getMonth() !== mo - 1 || probe.getDate() !== d) return "";
  return iso(y, mo, d);
}
