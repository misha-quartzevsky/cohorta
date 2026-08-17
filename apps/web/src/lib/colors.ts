/**
 * ============================================
 *  colors.ts — Палитра курсов
 * ============================================
 *
 * Дефолтные цвета курсов.  При создании курса
 * без указанного цвета выбирается случайный
 * из этого списка.
 */

export const COURSE_COLORS = [
  "#9C8FE2",
  "#FE4E1C",
  "#5ACF65",
  "#5199FC",
  "#FFD13A",
];

/**
 * Pick a random color from the default palette.
 *
 * @returns A HEX color string (with leading "#").
 */
export function randomCourseColor(): string {
  return COURSE_COLORS[Math.floor(Math.random() * COURSE_COLORS.length)];
}