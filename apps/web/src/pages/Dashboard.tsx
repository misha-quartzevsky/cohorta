import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useCourses } from "../hooks/useCourses";
import { useRecentLectures } from "../hooks/useRecentLectures";
import { useCourseForm } from "../hooks/useCourseForm";
import { useConfirmDialog } from "../hooks/useConfirmDialog";
import { useSemester } from "../lib/semesterContext";

import Header from "../components/Header";
import CourseTile from "../components/CourseTile";
import LectureTile from "../components/LectureTile";
import LectureEditor from "../components/LectureEditor";
import AddTile from "../components/AddTile";
import ConfirmDialog from "../components/ConfirmDialog";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import SemesterGate from "../components/SemesterGate";
import {
  CourseCreateSlot,
  CourseEditSlot,
} from "../components/CourseFormTile";

import {
  type Course,
  type Lecture,
  courseName,
  courseColor,
  courseSlug,
  lectureSlug,
  lectureTitle,
  lectureCourseId,
  semesterSlug,
} from "../lib/types";

import { deleteLecture, assignLecture } from "../services/lectureService";

/**
 * Dashboard — дашборд текущего семестра.
 * Топ-3 курса (по `updated`) + «Последние» записи.
 */
function Dashboard() {
  const navigate = useNavigate();

  const { current, semesters, error: semError } = useSemester();
  const semesterId = current?.id ?? "";

  const {
    courses,
    featured,
    loading: coursesLoading,
    error: coursesError,
    createCourse,
    updateCourse,
    deleteCourse,
  } = useCourses(semesterId);

  const {
    lectures,
    loading: lecturesLoading,
    error: lecturesError,
    refetch: refetchLectures,
  } = useRecentLectures(30);

  const [creatingNote, setCreatingNote] = useState(false);
  const [editingNote, setEditingNote] = useState<Lecture | null>(null);

  // Form state for create/edit course (shared with CoursesPage via
  // useCourseForm + CourseFormTile render slots).
  const form = useCourseForm(createCourse, updateCourse, semesterId);
  const confirm = useConfirmDialog();

  const handleDeleteCourse = (course: Course) => {
    confirm.ask(
      "Удалить курс?",
      `Курс «${courseName(course)}» будет удалён. Связанные лекции погибнут.`,
      () => {
        void deleteCourse(course.id);
      }
    );
  };

  const handleDeleteLecture = (lecture: Lecture) => {
    const t = lectureTitle(lecture);
    confirm.ask("Удалить запись?", `Запись «${t}» будет удалена.`, () => {
      void deleteLecture(lecture.id);
      void refetchLectures();
    });
  };

  const handleAssignCourse = async (lecture: Lecture, courseId: string) => {
    await assignLecture(lecture.id, courseId);
    void refetchLectures();
  };

  const semSlug = current ? semesterSlug(current) : "";

  // Courses of the semester, top-3 by `updated`.
  const visibleCourses = courses.slice(0, 3);

  // Recent items: unassigned notes + lectures of this semester's courses.
  const semCourseIds = new Set(courses.map((c) => c.id));
  const visibleLectures = lectures.filter((lec) => {
    const cid = lectureCourseId(lec);
    return !cid || semCourseIds.has(cid);
  });

  const loading =
    (coursesLoading && courses.length === 0) ||
    (lecturesLoading && lectures.length === 0);
  const error = semError || coursesError || lecturesError;

  return (
    <SemesterGate>
      {loading ? (
        <LoadingState />
      ) : creatingNote ? (
        <LectureEditor
          isNote
          onSaved={() => {
            setCreatingNote(false);
            void refetchLectures();
          }}
          onCancel={() => setCreatingNote(false)}
        />
      ) : editingNote ? (
        <LectureEditor
          isNote
          lecture={editingNote}
          onSaved={() => {
            setEditingNote(null);
            void refetchLectures();
          }}
          onCancel={() => setEditingNote(null)}
        />
      ) : (
        <>
          <Header crumbs={[{ label: "Рабочий стол" }]} />
          <div className="page">
            <ErrorBanner message={error} />

            <h1 className="page-title">Семестр {semSlug}</h1>
            <p className="page-subtitle">
              Недавно изменённые курсы и последние записи.
            </p>

            <section className="dashboard-section">
              <div className="section-head">
                <h2 className="section-title">Курсы</h2>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => navigate(`/s/${semSlug}/courses`)}
                >
                  Все курсы →
                </button>
              </div>

              {courses.length === 0 && (
                <div className="empty">
                  Пока нет курсов в этом семестре — добавьте первый!
                </div>
              )}

              <div className="bento">
                {visibleCourses.map((course, i) => (
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
            </section>

            <section className="dashboard-section">
              <h2 className="section-title">Последние</h2>

              <div className="bento">
                <AddTile
                  label="+ Новая заметка"
                  onClick={() => setCreatingNote(true)}
                />

                {visibleLectures.map((lec, i) => {
                  const idx = i + 1;
                  const unassigned = !lectureCourseId(lec);
                  const lecCourse = unassigned
                    ? undefined
                    : courses.find((c) => c.id === lectureCourseId(lec));

                  return (
                    <LectureTile
                      key={`lec-${lec.id}`}
                      lecture={lec}
                      index={idx}
                      unassigned={unassigned}
                      courses={unassigned ? courses : undefined}
                      onAssignCourse={handleAssignCourse}
                      courseTag={lecCourse ? courseName(lecCourse) : undefined}
                      courseColorTag={
                        lecCourse ? courseColor(lecCourse) : undefined
                      }
                      onClick={() => {
                        if (unassigned || !lecCourse) {
                          navigate(`/s/${semSlug}/note/${lectureSlug(lec)}`);
                        } else {
                          navigate(
                            `/s/${semSlug}/${courseSlug(lecCourse)}/${lectureSlug(lec)}`
                          );
                        }
                      }}
                      onEdit={(lec) => {
                        if (unassigned || !lecCourse) {
                          setEditingNote(lec);
                        } else {
                          navigate(
                            `/s/${semSlug}/${courseSlug(lecCourse)}/${lectureSlug(lec)}/edit`
                          );
                        }
                      }}
                      onDelete={handleDeleteLecture}
                    />
                  );
                })}
              </div>
            </section>

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

export default Dashboard;
