import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useCourses } from "../hooks/useCourses";
import { useRecentLectures } from "../hooks/useRecentLectures";

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
  lectureCourseId,
} from "../lib/types";

import { COURSE_COLORS, randomCourseColor } from "../lib/colors";

import { deleteLecture, assignLecture } from "../services/lectureService";

function Dashboard() {
  const navigate = useNavigate();

  const {
    courses,
    featured,
    loading: coursesLoading,
    error: coursesError,
    createCourse,
    updateCourse,
    deleteCourse,
  } = useCourses();

  const {
    lectures,
    loading: lecturesLoading,
    error: lecturesError,
    refetch: refetchLectures,
  } = useRecentLectures(30);

  const [creatingCourse, setCreatingCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseColor, setNewCourseColor] = useState<string>(randomCourseColor());

  const [creatingNote, setCreatingNote] = useState(false);

  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editCourseName, setEditCourseName] = useState("");
  const [editCourseColor, setEditCourseColor] = useState("");

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
    await createCourse(newCourseName.trim(), newCourseColor);
    setNewCourseName("");
    setNewCourseColor(randomCourseColor());
    setCreatingCourse(false);
  };

  const handleSaveEditedCourse = async () => {
    if (!editingCourse || !editCourseName.trim()) return;
    await updateCourse(editingCourse.id, editCourseName.trim(), editCourseColor);
    setEditingCourse(null);
    setEditCourseName("");
    setEditCourseColor("");
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

  const loading = coursesLoading || lecturesLoading;
  const error = coursesError || lecturesError;

  if (loading && courses.length === 0 && lectures.length === 0) {
    return <LoadingState />;
  }

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
    <div className="page">
      <Header />

      <ErrorBanner message={error} />

      <section className="dashboard-section">
        <div className="section-head">
          <h2 className="section-title">Мои курсы</h2>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => navigate("/courses")}
          >
            Все курсы →
          </button>
        </div>

        <div className="bento">
          {courses.map((course, i) => {
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
                  }}
                  placeholder="Название курса"
                  color={editCourseColor}
                  onColorChange={setEditCourseColor}
                  colors={COURSE_COLORS}
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
                onClick={() => navigate(`/courses/${course.id}`)}
                onEdit={(c) => {
                  setEditingCourse(c);
                  setEditCourseName(courseName(c));
                  setEditCourseColor(courseColor(c));
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
            />
          ) : (
            <AddTile
              label="+ Добавить курс"
              onClick={() => {
                setNewCourseColor(randomCourseColor());
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

          {lectures.map((lec, i) => {
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
                onClick={() => navigate(`/lectures/${lec.id}`)}
                onEdit={setEditingNote}
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
  );
}

export default Dashboard;