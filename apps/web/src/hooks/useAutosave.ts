/**
 * ============================================
 *  useAutosave.ts — debounced autosave lifecycle
 * ============================================
 *
 * Extracts the debounce + save-state machine that used to be copy-pasted into
 * LectureEdit / TicketEdit: ref-mirrored save fn, "first run" suppression,
 * setTimeout(delay) debounce, the idle|saving|saved|error indicator and the
 * "saved → idle" decay. The caller passes the raw values it wants watched via
 * `deps` (same shape as a useEffect dep array) and a `save` closure that reads
 * the freshest values (typically from its own refs).
 *
 * `flush()` runs the save immediately (used by the LectureFrame flush hook so
 * sidebar navigation persists pending edits before unmounting).
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

const SAVE_TEXT: Record<SaveState, string> = {
  idle: "Сохранено",
  saving: "Сохранение…",
  saved: "Обновлено только что",
  error: "Ошибка сохранения",
};

const SAVED_DECAY_MS = 3000;

interface UseAutosaveOptions {
  /** Persists the current values. Should read fresh state (refs), not close over stale props. */
  save: () => Promise<void>;
  /** Values to watch — same semantics as a useEffect dependency array. */
  deps: unknown[];
  /** Autosave is armed only while this is true (e.g. after the record loads). */
  enabled: boolean;
  /** Debounce delay in ms (default 1200). */
  delay?: number;
}

export interface UseAutosaveResult {
  saveState: SaveState;
  /** Localised label for the current state (for <SaveIndicator/>). */
  saveText: string;
  /** Save right now, bypassing the debounce. */
  flush: () => Promise<void>;
}

export function useAutosave({
  save,
  deps,
  enabled,
  delay = 1200,
}: UseAutosaveOptions): UseAutosaveResult {
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const saveRef = useRef(save);
  saveRef.current = save;

  // Suppresses the save that would otherwise fire from the initial value seed.
  const firstRun = useRef(true);

  const flush = useCallback(async () => {
    try {
      await saveRef.current();
      setSaveState("saved");
    } catch (e) {
      console.error("Ошибка автосохранения:", e);
      setSaveState("error");
    }
  }, []);

  // When the target changes (enabled flips back to false while the next record
  // loads), re-arm the first-run guard so seeding the new values doesn't save.
  useEffect(() => {
    if (!enabled) firstRun.current = true;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setSaveState("saving");
    const timer = setTimeout(() => {
      void flush();
    }, delay);
    return () => clearTimeout(timer);
    // deps is spread intentionally — the caller decides what to watch.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, delay, flush]);

  // «Обновлено только что» → «Сохранено».
  useEffect(() => {
    if (saveState !== "saved") return;
    const timer = setTimeout(() => setSaveState("idle"), SAVED_DECAY_MS);
    return () => clearTimeout(timer);
  }, [saveState]);

  return { saveState, saveText: SAVE_TEXT[saveState], flush };
}

export default useAutosave;
