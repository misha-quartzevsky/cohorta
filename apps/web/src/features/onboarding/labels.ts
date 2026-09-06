import type { PeriodType } from "../../lib/types";

/** Слово для типа периода в единственном числе. */
const PERIOD_WORD: Record<PeriodType, string> = {
  semester: "семестр",
  trimester: "триместр",
  quarter: "четверть",
  module: "модуль",
  custom: "",
};

/** Родительный падеж мн. ч. для заголовка экрана 6 («Сколько всего …?»). */
const PERIOD_WORD_PLURAL: Record<PeriodType, string> = {
  semester: "семестров",
  trimester: "триместров",
  quarter: "четвертей",
  module: "модулей",
  custom: "периодов",
};

/** Слово периода: пользовательское для `custom`, иначе словарное. */
export function periodWord(type: PeriodType, customWord = ""): string {
  if (type === "custom") return customWord.trim() || "период";
  return PERIOD_WORD[type] || "период";
}

export function periodWordPlural(type: PeriodType, customWord = ""): string {
  if (type === "custom") {
    const w = customWord.trim();
    return w ? `${w}` : "периодов";
  }
  return PERIOD_WORD_PLURAL[type] || "периодов";
}

/** Подпись периода: «1 семестр», «2 триместр», «1 модуль». */
export function periodLabel(
  index: number,
  type: PeriodType,
  customWord = ""
): string {
  return `${index} ${periodWord(type, customWord)}`;
}
