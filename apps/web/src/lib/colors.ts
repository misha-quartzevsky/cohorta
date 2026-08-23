/**
 * ============================================
 *  colors.ts — Палитра курсов
 * ============================================
 *
 * Курируемая палитра из DESIGN.md §1.2: ровно шесть цветов, подобранных на
 * одной насыщенности. Это «тёмные концы» градиентов — сам градиент строит
 * `lib/courseGradient.ts`. Свободного выбора цвета нет намеренно: рандомные
 * оттенки на карточках читаются как шаблон (§0).
 */

export const COURSE_COLORS = [
  "#5843F6", // violet (brand)
  "#FF6B4A", // coral
  "#2F80ED", // blue
  "#C239B3", // magenta
  "#0F9D77", // green
  "#F5A623", // amber
];

/**
 * Pick a random color from the curated palette.
 *
 * @returns A HEX color string (with leading "#").
 */
export function randomCourseColor(): string {
  return COURSE_COLORS[Math.floor(Math.random() * COURSE_COLORS.length)];
}
