import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useCourses } from "../hooks/useCourses";
import { useRecentLectures } from "../hooks/useRecentLectures";
import { useCourseForm } from "../hooks/useCourseForm";
import { useConfirmDialog } from "../hooks/useConfirmDialog";
import { useSemester } from "../lib/semesterContext";

import Header from "../components/Header";
import LectureEditor from "../components/LectureEditor";
import ConfirmDialog from "../components/ConfirmDialog";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import SemesterGate from "../components/SemesterGate";
import CoursesSection from "./dashboard/CoursesSection";
import RecentSection from "./dashboard/RecentSection";

import {
  type Course,
  type Lecture,
  courseName,
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

  // Navigation handlers for the extracted section components.
  const handleOpenAllCourses = () => navigate(`/s/${semSlug}/courses`);

  const handleOpenCourse = (course: Course) =>
    navigate(`/s/${semSlug}/${courseSlug(course)}`);

  const handleOpenLecture = (lec: Lecture) => {
    const unassigned = !lectureCourseId(lec);
    const lecCourse = unassigned
      ? undefined
      : courses.find((c) => c.id === lectureCourseId(lec));
    if (unassigned || !lecCourse) {
      navigate(`/s/${semSlug}/note/${lectureSlug(lec)}`);
    } else {
      navigate(`/s/${semSlug}/${courseSlug(lecCourse)}/${lectureSlug(lec)}`);
    }
  };

  const handleEditLecture = (lec: Lecture) => {
    const unassigned = !lectureCourseId(lec);
    const lecCourse = unassigned
      ? undefined
      : courses.find((c) => c.id === lectureCourseId(lec));
    if (unassigned || !lecCourse) {
      setEditingNote(lec);
    } else {
      navigate(
        `/s/${semSlug}/${courseSlug(lecCourse)}/${lectureSlug(lec)}/edit`
      );
    }
  };

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
            <div className="content-canvas">
              <ErrorBanner message={error} />

              <h1 className="page-title">Семестр {semSlug}</h1>
              <p className="page-subtitle">
                Недавно изменённые курсы и последние записи.
              </p>

              <CoursesSection
                courses={visibleCourses}
                featured={featured}
                form={form}
                semesters={semesters}
                onOpenAll={handleOpenAllCourses}
                onOpenCourse={handleOpenCourse}
                onDeleteCourse={handleDeleteCourse}
              />

              <RecentSection
                lectures={visibleLectures}
                courses={courses}
                onCreateNote={() => setCreatingNote(true)}
                onOpenLecture={handleOpenLecture}
                onEditLecture={handleEditLecture}
                onDeleteLecture={handleDeleteLecture}
                onAssignCourse={handleAssignCourse}
              />

              <ConfirmDialog
                open={confirm.open}
                title={confirm.title}
                message={confirm.message}
                onConfirm={confirm.confirm}
                onCancel={confirm.cancel}
              />
            </div>
          </div>
        </>
      )}
    </SemesterGate>
  );
}

export default Dashboard;
