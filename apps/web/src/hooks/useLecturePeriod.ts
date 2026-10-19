/**
 * Период для списка лекций («Семестр 3, сейчас», «Семестр 2», … «Весь архив»,
 * Screen-m-lectures-period). Лекция относится к периоду своего предмета;
 * лекция без предмета видна в любом периоде.
 */

import { useMemo, useState } from "react";

import { useSemester } from "../lib/semesterContext";
import { pickActiveSemester } from "../lib/activeSemester";
import { semesterLabel, type Lecture } from "../lib/types";
import { ALL_PERIODS, lectureInPeriod } from "../lib/lectureListRules";
import type { PeriodOption } from "../components/lectures/PeriodSelect";

export function useLecturePeriod(defaultToAll: boolean) {
  const { semesters, current } = useSemester();
  const active = current ?? pickActiveSemester(semesters);
  const [chosen, setChosen] = useState<string | null>(null);
  const value = chosen ?? (defaultToAll ? ALL_PERIODS : (active?.id ?? ALL_PERIODS));

  const options = useMemo<PeriodOption[]>(() => {
    const sorted = [...semesters].sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
    return [
      ...sorted.map((s) => ({
        value: s.id,
        label: semesterLabel(s) + (s.id === active?.id ? ", сейчас" : ""),
      })),
      { value: ALL_PERIODS, label: "Весь архив" },
    ];
  }, [semesters, active?.id]);

  const includes = (lecture: Lecture): boolean => lectureInPeriod(lecture, value);

  /** Подпись периода для строки под заголовком: «семестр 3», «весь архив». */
  const caption = (() => {
    if (value === ALL_PERIODS) return "весь архив";
    const s = semesters.find((x) => x.id === value);
    return s ? semesterLabel(s).toLowerCase() : "";
  })();

  return { value, setValue: setChosen, options, includes, caption, activeSemester: active };
}
