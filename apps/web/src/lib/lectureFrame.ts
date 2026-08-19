/**
 * ============================================
 *  lectureFrame.ts — LectureLayout context API
 * ============================================
 *
 * Lets the pages rendered inside <LectureLayout>'s <Outlet/> talk to the
 * persistent frame (Header breadcrumbs + lecture sidebar) that stays mounted
 * while the user switches between lecture view/edit — so switching lectures
 * never unmounts the whole screen and there is no flicker.
 */

import { createContext, useContext } from "react";

export interface LectureFrameApi {
  /**
   * Registers a flush callback (pending-save flush, used by the edit page)
   * that must run before the frame navigates away. Pass `null` to clear it.
   */
  registerFlush: (fn: (() => Promise<void>) | null) => void;
  /** Sets the lecture title shown as the last breadcrumb in the Header. */
  setTitle: (title: string) => void;
}

export const LectureFrameContext = createContext<LectureFrameApi | null>(null);

/** Access the LectureLayout frame API (must be rendered inside the layout). */
export function useLectureFrame(): LectureFrameApi {
  const ctx = useContext(LectureFrameContext);
  if (!ctx) {
    throw new Error("useLectureFrame must be used within <LectureLayout>");
  }
  return ctx;
}
