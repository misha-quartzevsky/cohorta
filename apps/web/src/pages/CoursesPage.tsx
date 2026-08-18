/**
 * ============================================
 *  CoursesPage.tsx
 * ============================================
 *
 * Course list view for a semester
 * (`/s/:semesterSlug/courses`).  Uses the
 * `useCourses` hook scoped to the current
 * semester and renders reusable UI components.
 *
 * Supports inline create, edit (incl. moving a
 * course to another semester) and delete.
 */

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useCourses } from "../hooks/useCourses";
import { useSemester } from "../lib/semesterContext";
import { fetchCourses } from "../services/courseService";
import { COURSE_COLORS, randomCourseColor } from "../lib/colors";
import {
  type Course,
  courseName,
  courseColor,
  courseSlug,
  courseSemesterId,
  semesterSlug,
} from "../lib/types";

import Header from "../components/Header";
import CourseTile from "../components/CourseTile";
import AddTile from "../components/AddTile";
import InlineEditor from "../components/InlineEditor";
import ConfirmDialog from "../components/ConfirmDialog";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";

/**
 * Courses page — displays all courses of the
 * current semester with a plus-tile to create
 * new courses inline.
 */
function CoursesPage() {
  const navigate = useNavigate();
  const { semesterSlug: semesterSlugParam } = useParams();

  const { current, semesters, loading: semLoading } = useSemester();
  const semesterId = current?.id ?? "";

  // Data layer (scoped to the current semester)
  const {
    courses,
    featured,
    loading,
    error,
    createCourse,
    updateCourse,
    deleteCourse,
  } = useCourses(semesterId);

  // UI state for the "create course" inline editor
  const [editingPlusIndex, setEditingPlusIndex] = useState<number | null>(
    null
  );
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseColor, setNewCourseColor] = useState<string>(
    randomCourseColor()
  );
  const [newCourseSemester, setNewCourseSemester] = useState("");

  // UI state for the "edit course" inline editor
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editCourseName, setEditCourseName] = useState("");
  const [editCourseColor, setEditCourseColor] = useState("");
  const [editCourseSemester, setEditCourseSemester] = useState("");

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});

  // Courses without a semester (legacy rows) — shown in a
  // separate section so they can be attached to a semester.
  const [orphans, setOrphans] = useState<Course[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchCourses()
      .then((all) => {
        if (!cancelled) {
          setOrphans(all.filter((c) => !courseSemesterId(c)));
        }
      })
      .catch((e) => {
        console.error("Ошибка загрузки курсов без семестра:", e);
        if (!cancelled) setOrphans([]);
      });
    return () => {
      cancelled = true;
    };
  }, [courses]);

  /**
   * Persist a new course via the hook and exit edit mode.
   */
  const handleSaveCourse = async () => {
    if (!newCourseName.trim()) return;
    await createCourse(
      newCourseName.trim(),
      newCourseColor,
      newCourseSemester || semesterId
    );
    setNewCourseName("");
    setNewCourseColor(randomCourseColor());
    setNewCourseSemester("");
    setEditingPlusIndex(null);
  };

  /**
   * Persist course changes (name/color/semester move).
   */
  const handleSaveEditedCourse = async () => {
    if (!editingCourse || !editCourseName.trim()) return;
    await updateCourse(
      editingCourse.id,
      editCourseName.trim(),
      editCourseColor,
      editCourseSemester
    );
    setEditingCourse(null);
    setEditCourseName("");
    setEditCourseColor("");
    setEditCourseSemester("");
  };

  const handleDeleteCourse = (course: Course) => {
    setConfirmAction(() => async () => {
      await deleteCourse(course.id);
      setConfirmOpen(false);
    });
    setConfirmOpen(true);
  };

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

  if (loading && courses.length === 0) return <LoadingState />;

  return (
    <>
      <Header
        crumbs={[
          { label: "Рабочий стол", to: `/s/${semSlug}` },
          { label: "Курсы" },
        ]}
      />
      <div className="page">
        <ErrorBanner message={error} />

      <h1 className="page-title">Все курсы</h1>
      <p className="page-subtitle">
        Семестр {semSlug} — все предметы и конспекты.
      </p>

      {courses.length === 0 ? (
        <div className="empty">
          Пока нет курсов в этом семестре — добавьте первый!
        </div>
      ) : null}

      <div className="bento">
        {courses.map((course, i) => {
          if (editingCourse?.id === course.id) {
            return (
              <InlineEditor
                key={`edit-${course.id}`}
                value={editCourseName}
                onChange={setEditCourseName}
                onSave={handleSaveEditedCourse}
                onCancel={() => {
                  setEditingCourse(null);
                  setEditCourseName("");
                  setEditCourseColor("");
                  setEditCourseSemester("");
                }}
                placeholder="Название курса"
                color={editCourseColor}
                onColorChange={setEditCourseColor}
                colors={COURSE_COLORS}
                semesters={semesters}
                semesterValue={editCourseSemester}
                onSemesterChange={setEditCourseSemester}
              />
            );
          }

          return (
            <CourseTile
              key={course.id}
              course={course}
              index={i}
              featured={featured[course.id]}
              wide={i === 0}
              onClick={() => navigate(`/s/${semSlug}/${courseSlug(course)}`)}
              onEdit={(c) => {
                setEditingCourse(c);
                setEditCourseName(courseName(c));
                setEditCourseColor(courseColor(c));
                setEditCourseSemester(courseSemesterId(c));
              }}
              onDelete={handleDeleteCourse}
            />
          );
        })}

        {editingPlusIndex !== null ? (
          <InlineEditor
            value={newCourseName}
            onChange={setNewCourseName}
            onSave={handleSaveCourse}
            onCancel={() => setEditingPlusIndex(null)}
            color={newCourseColor}
            onColorChange={setNewCourseColor}
            colors={COURSE_COLORS}
            semesters={semesters}
            semesterValue={newCourseSemester}
            onSemesterChange={setNewCourseSemester}
          />
        ) : (
          <AddTile
            label="+ Добавить курс"
            onClick={() => {
              setNewCourseColor(randomCourseColor());
              setNewCourseSemester(semesterId);
              setEditingPlusIndex(courses.length);
            }}
          />
        )}
      </div>

      {orphans.length > 0 && (
        <section className="dashboard-section">
          <h2 className="section-title">Без семестра</h2>
          <p className="page-subtitle">
            Эти курсы ещё не привязаны ни к одному семестру. Нажмите
            «Редактировать» и выберите семестр.
          </p>
          <div className="bento">
            {orphans.map((course, i) => {
              if (editingCourse?.id === course.id) {
                return (
                  <InlineEditor
                    key={`edit-orphan-${course.id}`}
                    value={editCourseName}
                    onChange={setEditCourseName}
                    onSave={handleSaveEditedCourse}
                    onCancel={() => {
                      setEditingCourse(null);
                      setEditCourseName("");
                      setEditCourseColor("");
                      setEditCourseSemester("");
                    }}
                    placeholder="Название курса"
                    color={editCourseColor}
                    onColorChange={setEditCourseColor}
                    colors={COURSE_COLORS}
                    semesters={semesters}
                    semesterValue={editCourseSemester}
                    onSemesterChange={setEditCourseSemester}
                  />
                );
              }
              return (
                <CourseTile
                  key={course.id}
                  course={course}
                  index={i}
                  featured={featured[course.id]}
                  onClick={() => navigate(`/s/${semSlug}/${courseSlug(course)}`)}
                  onEdit={(c) => {
                    setEditingCourse(c);
                    setEditCourseName(courseName(c));
                    setEditCourseColor(courseColor(c));
                    setEditCourseSemester(courseSemesterId(c));
                  }}
                  onDelete={handleDeleteCourse}
                />
              );
            })}
          </div>
        </section>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Удалить курс?"
        message="Курс будет удалён. Связанные лекции погибнут."
        onConfirm={confirmAction}
        onCancel={() => setConfirmOpen(false)}
      />
      </div>
    </>
  );
}

export default CoursesPage;