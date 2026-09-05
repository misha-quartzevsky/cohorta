/**
 * ============================================
 *  modeContext.ts — Solo / Группа mode core
 * ============================================
 *
 * React context + `useMode` hook for the global product mode.
 * The provider lives in `ModeProvider.tsx`; this file holds
 * only non-component exports so Fast Refresh keeps working.
 *
 * Solo   — текущее поведение без изменений: личное пространство.
 * Группа — осознанно включаемое collaborative-пространство
 *          (ростер, превью, точечный шеринг — P1 этапы B+).
 *
 * Режим глобальный (не per-course), хранится в localStorage.
 * По умолчанию — solo: пользователь, готовящийся в одиночку,
 * не должен видеть групповую механику вообще.
 */

import { createContext, useContext } from "react";

export type Mode = "solo" | "group";

/** localStorage key for the chosen product mode. */
export const MODE_KEY = "cohorta:mode";

export interface ModeContextValue {
  mode: Mode;
  setMode: (mode: Mode) => void;
  isGroup: boolean;
}

export const ModeContext = createContext<ModeContextValue | null>(null);

/**
 * Access the global Solo/Группа mode.
 * Must be used inside <ModeProvider>.
 */
export function useMode(): ModeContextValue {
  const ctx = useContext(ModeContext);
  if (!ctx) {
    throw new Error("useMode must be used within ModeProvider");
  }
  return ctx;
}
