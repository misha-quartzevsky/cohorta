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

import { createContext, useContext, type RefObject } from "react";
import type { SaveState } from "../hooks/useAutosave";

/** Состояние автосохранения лекции для верхней полосы редактора. */
export interface SaveIndicatorState {
  state: SaveState;
  text: string;
}

export interface LectureFrameApi {
  /**
   * Registers a flush callback (pending-save flush, used by the edit page)
   * that must run before the frame navigates away. Pass `null` to clear it.
   */
  registerFlush: (fn: (() => Promise<void>) | null) => void;
  /** Sets the lecture title shown as the last breadcrumb in the Header. */
  setTitle: (title: string) => void;
  /** Current lecture title (lives in the frame so the layout can build crumbs). */
  title: string;
  /** Ref to the content container (for TOC heading scan). */
  tocContainerRef: RefObject<HTMLElement | null>;
  /** Content version (triggers TOC re-scan). */
  tocVersion: number;
  /** Explicitly bump the TOC version (called when the lecture changes). */
  bumpToc: () => void;
  /** Статус сохранения («Сохранено» и др.) — публикует страница лекции, показывает верхняя полоса. */
  saveIndicator: SaveIndicatorState | null;
  setSaveIndicator: (s: SaveIndicatorState | null) => void;
  /** Счётчик запросов «открыть теги» из меню «···»; страница лекции открывает окно при росте. */
  tagsRequest: number;
  requestTags: () => void;
}

export const LectureFrameContext = createContext<LectureFrameApi | null>(null);

/**
 * Access the frame API. The provider lives in <AppLayout/>, so it is available
 * both to the GlobalSidebar (TOC section) and to pages inside LectureLayout.
 */
export function useLectureFrame(): LectureFrameApi {
  const ctx = useContext(LectureFrameContext);
  if (!ctx) {
    throw new Error("useLectureFrame must be used within <AppLayout>");
  }
  return ctx;
}
