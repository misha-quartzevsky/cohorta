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
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import GlobalSidebar from "./GlobalSidebar";
import DocumentScrollbar from "./scrollbar/DocumentScrollbar";
import {
  LectureFrameContext,
  type LectureFrameApi,
} from "../lib/lectureFrame";
import { UIShellContext, type UIShellApi } from "../lib/uiShellContext";

export default function AppLayout() {
  // Онбординг-гейт: пока профиль не пройден — не пускаем в приложение.
  // fail-closed: любое значение, кроме явного true (в т.ч. отсутствие
  // поля в закешированной записи), уводит на мастер, а не в обход.
  // Проверка вынесена в JSX ниже, чтобы не нарушать rules-of-hooks.
  const { user } = useAuth();
  const needsOnboarding = Boolean(user) && user?.onboarding_completed !== true;

  // Lecture frame state (shared with GlobalSidebar + LectureLayout pages).
  const [title, setTitle] = useState("");
  const flushRef = useRef<(() => Promise<void>) | null>(null);
  const tocContainerRef = useRef<HTMLElement | null>(null);
  const [tocVersion, setTocVersion] = useState(0);

  // Mobile drawer state: the header burger toggles it, the sidebar + backdrop
  // render from it. On desktop (>=1024px) the sidebar is always visible.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarOpen((open) => !open), []);

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

  const uiShell = useMemo<UIShellApi>(
    () => ({
      sidebarOpen,
      setSidebarOpen,
      toggleSidebar,
      closeSidebar,
    }),
    [sidebarOpen, toggleSidebar, closeSidebar]
  );

  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <LectureFrameContext.Provider value={api}>
      <UIShellContext.Provider value={uiShell}>
        <div className="app-shell">
          <GlobalSidebar open={sidebarOpen} onClose={closeSidebar} />
          <main className="app-main">
            <Outlet />
          </main>
          <DocumentScrollbar />
        </div>
      </UIShellContext.Provider>
    </LectureFrameContext.Provider>
  );
}
