/**
 * ============================================
 *  SemesterSwitcher.tsx
 * ============================================
 *
 * Dropdown in the top bar that switches the
 * current semester.  Changing the value calls
 * `setSemester` which rewrites the URL and
 * preserves the rest of the path.
 */

import { useSemester } from "../lib/semesterContext";
import { semesterSlug } from "../lib/types";

/**
 * Renders the "Семестр N" selector.
 * Hidden until the semester list is loaded.
 */
function SemesterSwitcher() {
  const { semesters, current, loading, setSemester } = useSemester();

  if (loading || semesters.length === 0) return null;

  return (
    <div className="semester-switcher">
      <label className="semester-switcher-label" htmlFor="semester-select">
        Семестр
      </label>
      <select
        id="semester-select"
        className="semester-select"
        value={current?.slug ?? ""}
        onChange={(e) => {
          if (e.target.value) setSemester(e.target.value);
        }}
      >
        {!current && (
          <option value="" disabled>
            Выбрать…
          </option>
        )}
        {semesters.map((s) => (
          <option key={s.id} value={semesterSlug(s)}>
            Семестр {semesterSlug(s)}
          </option>
        ))}
      </select>
    </div>
  );
}

export default SemesterSwitcher;
