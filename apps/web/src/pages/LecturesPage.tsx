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

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLectures } from "../hooks/useLectures";
import { useSemester } from "../lib/semesterContext";
import {
  courseName,
  courseSlug,
  courseSemesterId,
  lectureSlug,
  semesterSlug,
} from "../lib/types";
import Header from "../components/Header";
import LectureTile from "../components/LectureTile";
import AddTile from "../components/AddTile";
import LectureEditor from "../components/LectureEditor";
import ConfirmDialog from "../components/ConfirmDialog";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";

/**
 * Lectures page — displays all lectures for a course
 * as bento tiles with a plus-tile to create new lectures.
 */
function LecturesPage() {
  const navigate = useNavigate();
  const { semesterSlug: semesterSlugParam, courseSlug: courseSlugParam } =
    useParams();

  const { current, semesters, loading: semLoading } = useSemester();

  // Data layer (resolves the course by slug, then its lectures)
  const { course, lectures, loading, error, refetch, deleteLecture } =
    useLectures(courseSlugParam ?? "");

  // UI state for the "create lecture" flow
  const [editingPlusIndex, setEditingPlusIndex] = useState<number | null>(
    null
  );

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLectureId, setConfirmLectureId] = useState("");
  const [confirmTitle, setConfirmTitle] = useState("");

  /**
   * Called when a lecture is saved (created or updated).
   * Closes the editor and refreshes the list.
   */
  const handleSaved = () => {
    setEditingPlusIndex(null);
    void refetch();
  };

  // If the course belongs to another semester, redirect there.
  useEffect(() => {
    if (!course || !current || !courseSlugParam) return;
    const semId = courseSemesterId(course);
    if (semId && semId !== current.id) {
      const target = semesters.find((s) => s.id === semId);
      if (target) {
        navigate(`/s/${semesterSlug(target)}/${courseSlug(course)}`, {
          replace: true,
        });
      }
    }
  }, [course, current, semesters, courseSlugParam, navigate]);

  if (semLoading) return <LoadingState />;

  if (!current) {
    return (
      <>
        <Header crumbs={[{ label: "Рабочий стол" }]} />
        <div className="page">
          <ErrorBanner message={`Семестр «${semesterSlugParam}» не найден.`} />
        </div>
      </>
    );
  }

  const semSlug = semesterSlug(current);

  // --- Editor mode (full-page form) ---
  if (editingPlusIndex !== null) {
    if (!course) return <LoadingState />;
    return (
      <LectureEditor
        courseId={course.id}
        onSaved={handleSaved}
        onCancel={() => setEditingPlusIndex(null)}
      />
    );
  }

  if (loading) return <LoadingState />;

  const handleDelete = async () => {
    await deleteLecture(confirmLectureId);
    setConfirmOpen(false);
  };

  return (
    <>
      <Header
        crumbs={[
          { label: "Рабочий стол", to: `/s/${semSlug}` },
          { label: course ? courseName(course) : "Курс" },
        ]}
      />
      <div className="page">
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
            onClick={() =>
              navigate(`/s/${semSlug}/${courseSlugParam}/${lectureSlug(lec)}`)
            }
            onEdit={() =>
              navigate(
                `/s/${semSlug}/${courseSlugParam}/${lectureSlug(lec)}/edit`
              )
            }
            onDelete={() => {
              setConfirmLectureId(lec.id);
              setConfirmTitle(
                String((lec as Record<string, unknown>).title ?? "Без названия")
              );
              setConfirmOpen(true);
            }}
          />
        ))}

        <AddTile
          label="+ Добавить лекцию"
          onClick={() => setEditingPlusIndex(lectures.length)}
        />
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Удалить запись?"
        message={`Запись «${confirmTitle}» будет удалена.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
      </div>
    </>
  );
}

export default LecturesPage;