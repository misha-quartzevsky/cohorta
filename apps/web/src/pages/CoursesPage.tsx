import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useCourses } from "../hooks/useCourses";
import { useCourseForm } from "../hooks/useCourseForm";
import { useConfirmDialog } from "../hooks/useConfirmDialog";
import { useSemester } from "../lib/semesterContext";
import { fetchCourses } from "../services/courseService";
import {
  type Course,
  courseSlug,
  courseSemesterId,
  semesterSlug,
} from "../lib/types";

import Header from "../components/Header";
import CourseTile from "../components/CourseTile";
import ConfirmDialog from "../components/ConfirmDialog";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import SemesterGate from "../components/SemesterGate";
import {
  CourseCreateSlot,
  CourseEditSlot,
} from "../components/CourseFormTile";

/**
 * Courses page — все курсы текущего семестра
 * (`/s/:semesterSlug/courses`) + секция «Без семестра».
 */
function CoursesPage() {
  const navigate = useNavigate();

  const { current, semesters } = useSemester();
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

  const form = useCourseForm(createCourse, updateCourse, semesterId);
  const confirm = useConfirmDialog();

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

  const handleDeleteCourse = (course: Course) => {
    confirm.ask(
      "Удалить курс?",
      "Курс будет удалён. Связанные лекции погибнут.",
      () => {
        void deleteCourse(course.id);
      }
    );
  };

  const semSlug = current ? semesterSlug(current) : "";

  return (
    <SemesterGate>
      {loading && courses.length === 0 ? (
        <LoadingState />
      ) : (
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
              {courses.map((course, i) => (
                <CourseEditSlot
                  key={`edit-${course.id}`}
                  course={course}
                  form={form}
                  semesters={semesters}
                  fallback={
                    <CourseTile
                      course={course}
                      index={i}
                      featured={featured[course.id]}
                      wide={i === 0}
                      onClick={() =>
                        navigate(`/s/${semSlug}/${courseSlug(course)}`)
                      }
                      onEdit={form.startEdit}
                      onDelete={handleDeleteCourse}
                    />
                  }
                />
              ))}

              <CourseCreateSlot form={form} semesters={semesters} />
            </div>

            {orphans.length > 0 && (
              <section className="dashboard-section">
                <h2 className="section-title">Без семестра</h2>
                <p className="page-subtitle">
                  Эти курсы ещё не привязаны ни к одному семестру. Нажмите
                  «Редактировать» и выберите семестр.
                </p>
                <div className="bento">
                  {orphans.map((course, i) => (
                    <CourseEditSlot
                      key={`edit-orphan-${course.id}`}
                      course={course}
                      form={form}
                      semesters={semesters}
                      fallback={
                        <CourseTile
                          course={course}
                          index={i}
                          featured={featured[course.id]}
                          onClick={() =>
                            navigate(`/s/${semSlug}/${courseSlug(course)}`)
                          }
                          onEdit={form.startEdit}
                          onDelete={handleDeleteCourse}
                        />
                      }
                    />
                  ))}
                </div>
              </section>
            )}

            <ConfirmDialog
              open={confirm.open}
              title={confirm.title}
              message={confirm.message}
              onConfirm={confirm.confirm}
              onCancel={confirm.cancel}
            />
          </div>
        </>
      )}
    </SemesterGate>
  );
}

export default CoursesPage;