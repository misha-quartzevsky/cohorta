/**
 * ============================================
 *  semesterContext.ts — Semester Context Core
 * ============================================
 *
 * React context + `useSemester` hook for the
 * global semester state.  The provider component
 * lives in `SemesterContext.tsx`; this file holds
 * only non-component exports so Fast Refresh
 * keeps working.
 */

import { createContext, useContext } from "react";
import type { Semester } from "./types";

/** localStorage key for the last visited semester slug. */
export const LAST_SEMESTER_KEY = "cohorta:lastSemester";

export interface SemesterContextValue {
  /** All semesters, numerically ordered. */
  semesters: Semester[];
  /** Loading flag for the semester list. */
  loading: boolean;
  /** Error message (empty when OK). */
  error: string;
  /** Semester record matching the URL slug, or null. */
  current: Semester | null;
  /** Semester slug taken from the URL ("" when not on /s/…). */
  semesterSlug: string;
  /** Switch to another semester (updates URL + localStorage). */
  setSemester: (slug: string) => void;
  /** Reload the semester list. */
  refetch: () => Promise<void>;
}

export const SemesterContext = createContext<SemesterContextValue | null>(
  null
);

/**
 * Access the global semester state.
 * Must be used inside <SemesterProvider>.
 */
export function useSemester(): SemesterContextValue {
  const ctx = useContext(SemesterContext);
  if (!ctx) {
    throw new Error("useSemester must be used within SemesterProvider");
  }
  return ctx;
}
