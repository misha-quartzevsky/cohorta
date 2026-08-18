import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useCourses } from "../hooks/useCourses";
import { useRecentLectures } from "../hooks/useRecentLectures";
import { useSemester } from "../lib/semesterContext";

import Header from "../components/Header";
import CourseTile from "../components/CourseTile";
import LectureTile from "../components/LectureTile";
import LectureEditor from "../components/LectureEditor";
import AddTile from "../components/AddTile";
import InlineEditor from "../components/InlineEditor";
import ConfirmDialog from "../components/ConfirmDialog";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";

import {
  type Course,
  type Lecture,
  courseName,
  courseColor,
  courseSlug,
  lectureSlug,
  lectureCourseId,
  courseSemesterId,
  semesterSlug,
} from "../lib/types";

import { COURSE_COLORS, randomCourseColor } from "../lib/colors";

import { deleteLecture, assignLecture } from "../services/lectureService";

function Dashboard() {
  const navigate = useNavigate();
  const { semesterSlug: semesterSlugParam } = useParams();

  const {
    current,
    semesters,
    loading: semLoading,
    error: semError,
  } = useSemester();
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

  const [creatingCourse, setCreatingCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseColor, setNewCourseColor] = useState<string>(randomCourseColor());
  const [newCourseSemester, setNewCourseSemester] = useState("");

  const [creatingNote, setCreatingNote] = useState(false);

  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editCourseName, setEditCourseName] = useState("");
  const [editCourseColor, setEditCourseColor] = useState("");
  const [editCourseSemester, setEditCourseSemester] = useState("");

  const [editingNote, setEditingNote] = useState<Lecture | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});

  const askConfirm = (title: string, message: string, action: () => void) => {
    setConfirmTitle(title);
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  };

  const handleSaveNewCourse = async () => {
    if (!newCourseName.trim()) return;
    await createCourse(
      newCourseName.trim(),
      newCourseColor,
      newCourseSemester || semesterId
    );
    setNewCourseName("");
    setNewCourseColor(randomCourseColor());
    setNewCourseSemester("");
    setCreatingCourse(false);
  };

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
    askConfirm(
      "Удалить курс?",
      `Курс «${courseName(course)}» будет удалён. Связанные лекции погибнут.`,
      async () => {
        await deleteCourse(course.id);
        setConfirmOpen(false);
      }
    );
  };

  const handleDeleteLecture = (lecture: Lecture) => {
    const t = String(
      (lecture as Record<string, unknown>).title ?? "Без названия"
    );
    askConfirm("Удалить запись?", `Запись «${t}» будет удалена.`, async () => {
      await deleteLecture(lecture.id);
      setConfirmOpen(false);
      void refetchLectures();
    });
  };

  const handleAssignCourse = async (lecture: Lecture, courseId: string) => {
    await assignLecture(lecture.id, courseId);
    void refetchLectures();
  };

  // Semester must be loaded and valid before showing content.
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

  if (loading) return <LoadingState />;

  // Full-page editor for creating a free (unassigned) note.
  if (creatingNote) {
    return (
      <LectureEditor
        isNote
        onSaved={() => {
          setCreatingNote(false);
          void refetchLectures();
        }}
        onCancel={() => setCreatingNote(false)}
      />
    );
  }

  // Full-page editor for editing a free (unassigned) note.
  if (editingNote) {
    return (
      <LectureEditor
        isNote
        lecture={editingNote}
        onSaved={() => {
          setEditingNote(null);
          void refetchLectures();
        }}
        onCancel={() => setEditingNote(null)}
      />
    );
  }

  return (
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
          {visibleCourses.map((course, i) => {
            const isEditing = editingCourse?.id === course.id;

            if (isEditing) {
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

          {creatingCourse ? (
            <InlineEditor
              value={newCourseName}
              onChange={setNewCourseName}
              onSave={handleSaveNewCourse}
              onCancel={() => setCreatingCourse(false)}
              placeholder="Название курса (например, «Философия»)"
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
                setCreatingCourse(true);
              }}
            />
          )}
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
                courseColorTag={lecCourse ? courseColor(lecCourse) : undefined}
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
        open={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        onConfirm={confirmAction}
        onCancel={() => setConfirmOpen(false)}
      />
      </div>
    </>
  );
}

export default Dashboard;