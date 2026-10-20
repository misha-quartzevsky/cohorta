/**
 * Период для списка лекций («Семестр 3 · текущий», «Семестр 2», … «Все периоды»,
 * Screen-period-lists). По умолчанию текущий; выбор запоминается отдельно для
 * каждого списка (`listKey`). Лекция относится к периоду своего предмета;
 * лекция без предмета видна в любом периоде.
 */

import { useMemo, useState } from "react";

import { useSemester } from "../lib/semesterContext";
import { pickActiveSemester } from "../lib/activeSemester";
import { semesterLabel, type Lecture } from "../lib/types";
import { ALL_PERIODS, lectureInPeriod } from "../lib/lectureListRules";
import type { PeriodOption } from "../components/lectures/PeriodSelect";

const KEY = (listKey: string) => `cohorta:period:${listKey}`;

function readStored(listKey: string): string | null {
  try {
    return localStorage.getItem(KEY(listKey));
  } catch {
    return null;
  }
}

/** @param defaultId период по умолчанию вместо текущего (у предмета — его собственный семестр). */
export function useLecturePeriod(listKey: string, defaultId?: string) {
  const { semesters, current } = useSemester();
  const active = current ?? pickActiveSemester(semesters);
  const [chosen, setChosen] = useState<string | null>(() => readStored(listKey));

  const options = useMemo<PeriodOption[]>(() => {
    const sorted = [...semesters].sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
    return [
      ...sorted.map((s) => ({
        value: s.id,
        label: semesterLabel(s) + (s.id === active?.id ? ", сейчас" : ""),
      })),
      { value: ALL_PERIODS, label: "Все периоды" },
    ];
  }, [semesters, active?.id]);

  const valid = chosen !== null && options.some((o) => o.value === chosen) ? chosen : null;
  const fallback = defaultId && options.some((o) => o.value === defaultId) ? defaultId : (active?.id ?? ALL_PERIODS);
  const value = valid ?? fallback;

  const setValue = (next: string) => {
    setChosen(next);
    try {
      localStorage.setItem(KEY(listKey), next);
    } catch {
      /* хранилище недоступно */
    }
  };

  const includes = (lecture: Lecture): boolean => lectureInPeriod(lecture, value);

  /** Подпись периода для строки под заголовком: «семестр 3», «все периоды». */
  const caption = (() => {
    if (value === ALL_PERIODS) return "все периоды";
    const s = semesters.find((x) => x.id === value);
    return s ? semesterLabel(s).toLowerCase() : "";
  })();

  return { value, setValue, options, includes, caption, activeSemester: active, isCurrent: value === active?.id };
}
