/**
 * ============================================
 *  AppLayout.tsx — Global application shell
 * ============================================
 *
 * Wraps all protected routes with:
 *  - GlobalSidebar (fixed left, 280px)
 *  - Main content area (flex-1, offset by sidebar width)
 *
 * Also owns the shared LectureFrame context (breadcrumb title, TOC container
 * ref/version, pending-save flush). It is provided HERE — ABOVE the lecture
 * routes — so the GlobalSidebar (rendered by this very layout, outside
 * LectureLayout) can show the lecture TOC. LectureLayout and its pages are
 * consumers of the same context.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import GlobalSidebar from "./GlobalSidebar";
import {
  LectureFrameContext,
  type LectureFrameApi,
} from "../lib/lectureFrame";

export default function AppLayout() {
  // Lecture frame state (shared with GlobalSidebar + LectureLayout pages).
  const [title, setTitle] = useState("");
  const flushRef = useRef<(() => Promise<void>) | null>(null);
  const tocContainerRef = useRef<HTMLElement | null>(null);
  const [tocVersion, setTocVersion] = useState(0);

  const registerFlush = useCallback(
    (fn: (() => Promise<void>) | null) => {
      flushRef.current = fn;
    },
    []
  );
  const setTitleCb = useCallback((t: string) => setTitle(t), []);
  const bumpToc = useCallback(() => setTocVersion((v) => v + 1), []);

  const api = useMemo<LectureFrameApi>(
    () => ({
      registerFlush,
      setTitle: setTitleCb,
      title,
      tocContainerRef,
      tocVersion,
      bumpToc,
    }),
    [registerFlush, setTitleCb, title, tocVersion, bumpToc]
  );

  return (
    <LectureFrameContext.Provider value={api}>
      <div className="app-shell">
        <GlobalSidebar />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </LectureFrameContext.Provider>
  );
}
