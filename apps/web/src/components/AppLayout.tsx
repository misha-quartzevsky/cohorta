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
import BottomTabBar from "./BottomTabBar";
import AppShellNew from "./AppShellNew";
import DocumentScrollbar from "./scrollbar/DocumentScrollbar";
import {
  LectureFrameContext,
  type LectureFrameApi,
  type SaveIndicatorState,
} from "../lib/lectureFrame";
import { UIShellContext, type UIShellApi } from "../lib/uiShellContext";
import { isNewUI } from "../lib/featureFlags";

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
  const [saveIndicator, setSaveIndicator] = useState<SaveIndicatorState | null>(null);
  const [tagsRequest, setTagsRequest] = useState(0);
  const requestTags = useCallback(() => setTagsRequest((n) => n + 1), []);

  // Mobile drawer state: the header burger toggles it, the sidebar + backdrop
  // render from it. On desktop (>=1024px) the sidebar is always visible.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarOpen((open) => !open), []);

  // Поиск по продукту (B2) — своё состояние, не завязано на sidebarOpen.
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

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
      saveIndicator,
      setSaveIndicator,
      tagsRequest,
      requestTags,
    }),
    [registerFlush, setTitleCb, title, tocVersion, bumpToc, saveIndicator, tagsRequest, requestTags]
  );

  const uiShell = useMemo<UIShellApi>(
    () => ({
      sidebarOpen,
      setSidebarOpen,
      toggleSidebar,
      closeSidebar,
      searchOpen,
      openSearch,
      closeSearch,
    }),
    [sidebarOpen, toggleSidebar, closeSidebar, searchOpen, openSearch, closeSearch]
  );

  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  // Новый каркас (A4, components/AppShellNew.tsx) — за флагом VITE_NEW_UI,
  // пока волны A и B1 не закрыты (раздел 3 инструкции). Старые экраны,
  // ещё не перенесённые по волнам B, рендерятся внутри него как есть —
  // это ожидаемое промежуточное состояние предпросмотра, не баг.
  if (isNewUI()) {
    return (
      <LectureFrameContext.Provider value={api}>
        <UIShellContext.Provider value={uiShell}>
          <AppShellNew />
        </UIShellContext.Provider>
      </LectureFrameContext.Provider>
    );
  }

  return (
    <LectureFrameContext.Provider value={api}>
      <UIShellContext.Provider value={uiShell}>
        <div className="app-shell">
          <GlobalSidebar open={sidebarOpen} onClose={closeSidebar} />
          <main className="app-main">
            <Outlet />
          </main>
          <BottomTabBar />
          <DocumentScrollbar />
        </div>
      </UIShellContext.Provider>
    </LectureFrameContext.Provider>
  );
}
