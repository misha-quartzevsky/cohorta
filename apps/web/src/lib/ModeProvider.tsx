/**
 * ============================================
 *  ModeProvider.tsx — Solo / Группа mode provider
 * ============================================
 *
 * Owns the mode state, mirrors it to localStorage, and keeps
 * it in sync across tabs (storage event). Reads are wrapped in
 * try/catch — private mode / disabled storage must not crash.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ModeContext, MODE_KEY, type Mode } from "./modeContext";

function readStored(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === "group" ? "group" : "solo";
  } catch {
    return "solo";
  }
}

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>(readStored);

  const setMode = useCallback((next: Mode) => {
    setModeState(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      /* storage disabled — session-only is acceptable */
    }
  }, []);

  // Keep multiple tabs consistent.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === MODE_KEY) setModeState(readStored());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(
    () => ({ mode, setMode, isGroup: mode === "group" }),
    [mode, setMode]
  );

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}
