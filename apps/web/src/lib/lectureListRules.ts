/**
 * Чистые правила экранов B2 (вынесены ради тестов): какие шаги «С чего начать»
 * ещё открыты, входит ли лекция в выбранный период, а также какой период выбран сохранённым значением.
 */

import { courseSemesterId, type Lecture } from "./types";

export type StartStepKey = "subjects" | "pairs" | "lecture";

/** Шаги карточки «С чего начать», которые ещё не выполнены (выполненные исчезают). */
export function openStartSteps(state: {
  hasSubjects: boolean;
  hasPairs: boolean;
  hasLectures: boolean;
}): StartStepKey[] {
  const open: StartStepKey[] = [];
  if (!state.hasSubjects) open.push("subjects");
  if (!state.hasPairs) open.push("pairs");
  if (!state.hasLectures) open.push("lecture");
  return open;
}

export const ALL_PERIODS = "all";

/** Лекция относится к периоду своего предмета; без предмета видна в любом периоде. */
export function lectureInPeriod(lecture: Lecture, period: string): boolean {
  if (period === ALL_PERIODS) return true;
  const course = lecture.field ? lecture.expand?.field : undefined;
  if (!course) return true;
  return courseSemesterId(course) === period;
}
