import type { DegreeLevel } from "../../lib/types";

/**
 * Варианты курса для выбранной ступени.
 *
 * Возвращает список чисел для типовых ступеней и `null` для «Другое» —
 * это сигнал `StepCourse` рендерить открытый числовой инпут без
 * потолка, а не кнопки-пилюли (у «Другое» нет типового диапазона).
 */
export function getCourseOptions(degreeLevel: DegreeLevel | ""): number[] | null {
  switch (degreeLevel) {
    case "bachelor":
    case "specialist":
      return [1, 2, 3, 4, 5, 6];
    case "master":
      return [1, 2];
    case "other":
      return null;
    default:
      return [1, 2, 3, 4, 5, 6];
  }
}
