/**
 * ============================================
 *  LecturesPage.tsx
 * ============================================
 *
 * Lecture list for a single course.  Uses the
 * `useLectures` hook and reusable UI components.
 *
 * State machine for the "create lecture" flow:
 *   editingPlusIndex === null → show <AddTile> "+" button
 *   editingPlusIndex !== null → show <LectureEditor> full-page form
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLectures } from "../hooks/useLectures";
import { courseName } from "../lib/types";
import Header from "../components/Header";
import LectureTile from "../components/LectureTile";
import AddTile from "../components/AddTile";
import LectureEditor from "../components/LectureEditor";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";

interface Props {
  /** The currently-selected course ID. */
  courseId: string;
  /** Navigates back to the course list. */
  onBack: () => void;
}

/**
 * Lectures page — displays all lectures for a course
 * as bento tiles with a plus-tile to create new lectures.
 *
 * @param Props.courseId — parent course ID
 * @param Props.onBack   — returns to the course list
 */
function LecturesPage({ courseId, onBack }: Props) {
  const navigate = useNavigate();

  // Data layer (fetches both the course and its lectures)
  const { course, lectures, loading, error, refetch } = useLectures(courseId);

  // UI state for the "create lecture" flow
  const [editingPlusIndex, setEditingPlusIndex] = useState<number | null>(
    null
  );

  /**
   * Called when a lecture is saved (created or updated).
   * Closes the editor and refreshes the list.
   */
  const handleSaved = () => {
    setEditingPlusIndex(null);
    void refetch();
  };

  // --- Editor mode (full-page form) ---
  if (editingPlusIndex !== null) {
    return (
      <LectureEditor
        courseId={courseId}
        onSaved={handleSaved}
        onCancel={() => setEditingPlusIndex(null)}
      />
    );
  }

  if (loading) return <LoadingState />;

  return (
    <div className="page">
      <Header onBack={onBack} />

      <ErrorBanner message={error} />

      <h1 className="page-title">
                {course ? courseName(course) : "Курс"}
      </h1>
      <p className="page-subtitle">
        Отсортировано по дате — новые выше.
      </p>

      <div className="bento">
        {lectures.map((lec, i) => (
          <LectureTile
            key={lec.id}
            lecture={lec}
            index={i}
            onClick={() => navigate(`/lectures/${lec.id}`)}
          />
        ))}

        <AddTile
          label="+ Добавить лекцию"
          onClick={() => setEditingPlusIndex(lectures.length)}
        />
      </div>
    </div>
  );
}

export default LecturesPage;