/**
 * ============================================
 *  lib/uiShellContext.ts — mobile drawer state
 * ============================================
 *
 * Tiny UI-shell context shared between:
 *  - <AppLayout/>     — owner of the open state
 *  - <GlobalSidebar/> — the drawer itself
 *  - <Header/>        — the mobile burger toggle
 *
 * Kept separate from LectureFrameContext so pages don't re-render when the
 * drawer opens/closes (the sidebar and header are the only consumers).
 */

import { createContext, useContext } from "react";

export interface UIShellApi {
  /** Whether the global sidebar drawer is open on mobile (<1024px). */
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  /**
   * Поиск по продукту (B2): открывается из строки в шапке
   * (components/AppShell.tsx) или из иконки поиска на странице
   * «Все лекции» (pages/LecturesAllPage.tsx) — одно состояние на
   * оба входа, вид (оверлей/полный экран) решает CSS по ширине.
   */
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
}

const noop = () => {};

/**
 * Default no-op value keeps <Header/> safe even if it is ever rendered
 * outside <AppLayout/> (all current usages are inside the provider).
 */
export const UIShellContext = createContext<UIShellApi>({
  sidebarOpen: false,
  setSidebarOpen: noop,
  toggleSidebar: noop,
  closeSidebar: noop,
  searchOpen: false,
  openSearch: noop,
  closeSearch: noop,
});

export function useUiShell(): UIShellApi {
  return useContext(UIShellContext);
}