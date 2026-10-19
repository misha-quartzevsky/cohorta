import { createContext, useContext } from "react";
import type { ReadinessResult } from "../../lib/computeLectureReadiness";
import type { QuizPanelState } from "../../lib/quizPanelState";
import type { Lecture } from "../../lib/types";

export interface Value {
  lecture: Lecture;
  readiness: ReadinessResult | null;
  panel: QuizPanelState;
  hasQuiz: boolean;
  loading: boolean;
  /** Владелец лекции создаёт квиз; гость (лекцию открыли ему) только проходит готовый. */
  isOwner: boolean;
  sheetOpen: boolean;
  setSheetOpen: (v: boolean) => void;
  /** «Создать квиз» / «Собрать другой». Свежую длину текста берём из базы, а не с экрана. */
  create: (forceNew: boolean) => Promise<void>;
}

export const Ctx = createContext<Value | null>(null);

export function useUnderstanding(): Value | null {
  return useContext(Ctx);
}
