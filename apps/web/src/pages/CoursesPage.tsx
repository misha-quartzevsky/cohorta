/**
 * ============================================
 *  CoursesPage.tsx
 * ============================================
 *
 * Course list view.  Uses the `useCourses` hook
 * for all data fetching and renders reusable UI
 * components (`Header`, `CourseTile`, `AddTile`,
 * `InlineEditor`, `ErrorBanner`, `LoadingState`).
 *
 * State machine for the "create course" flow:
 *   editingPlusIndex === null → show <AddTile> "+" button
 *   editingPlusIndex !== null → show <InlineEditor> form
 */

import { useState } from "react";
import { useCourses } from "../hooks/useCourses";
import { COURSE_COLORS, randomCourseColor } from "../lib/colors";
import Header from "../components/Header";
import CourseTile from "../components/CourseTile";
import AddTile from "../components/AddTile";
import InlineEditor from "../components/InlineEditor";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";

interface Props {
  /** Opens the lecture list for the given course ID. */
  onOpen: (courseId: string) => void;
}

/**
 * Courses page — displays all courses as bento tiles
 * with a plus-tile to create new courses inline.
 *
 * @param Props.onOpen — navigates to the lecture list for a course
 */
function CoursesPage({ onOpen }: Props) {
  // Data layer
  const { courses, featured, loading, error, createCourse } = useCourses();

  // UI state for the "create course" inline editor
  const [editingPlusIndex, setEditingPlusIndex] = useState<number | null>(
    null
  );
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseColor, setNewCourseColor] = useState<string>(
    randomCourseColor()
  );

  /**
   * Persist a new course via the hook and exit edit mode.
   */
  const handleSaveCourse = async () => {
    if (!newCourseName.trim()) return;
    await createCourse(newCourseName.trim(), newCourseColor);
    setNewCourseName("");
    setNewCourseColor(randomCourseColor());
    setEditingPlusIndex(null);
  };

  if (loading) return <LoadingState />;

  return (
    <div className="page">
      <Header />

      <ErrorBanner message={error} />

      <h1 className="page-title">Мои курсы</h1>
      <p className="page-subtitle">
        Твои предметы и конспекты — в одном месте.
      </p>

      {courses.length === 0 ? (
        <div className="empty">
          Пока нет курсов. Создайте их в админке PocketBase.
        </div>
      ) : (
        <div className="bento">
          {courses.map((course, i) => (
            <CourseTile
              key={course.id}
              course={course}
              index={i}
              featured={featured[course.id]}
              wide={i === 0}
              onClick={() => onOpen(course.id)}
            />
          ))}

          {editingPlusIndex !== null ? (
            <InlineEditor
              value={newCourseName}
              onChange={setNewCourseName}
              onSave={handleSaveCourse}
              onCancel={() => setEditingPlusIndex(null)}
              color={newCourseColor}
              onColorChange={setNewCourseColor}
              colors={COURSE_COLORS}
            />
          ) : (
            <AddTile
              label="+ Добавить курс"
              onClick={() => {
                setNewCourseColor(randomCourseColor());
                setEditingPlusIndex(courses.length);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default CoursesPage;