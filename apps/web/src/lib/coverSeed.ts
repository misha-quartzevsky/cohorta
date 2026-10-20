/**
 * Оттенок обложки нового предмета (docs/design/instructions/subject-cover-generator.md):
 * `round((20 + N * 137.5) mod 360)`, где N — число предметов пользователя
 * на момент создания. Задаётся один раз и потом не меняется.
 */
export function nextCoverSeed(existingCount: number): number {
  const n = Math.max(0, Math.floor(existingCount));
  return Math.round((20 + n * 137.5) % 360);
}
