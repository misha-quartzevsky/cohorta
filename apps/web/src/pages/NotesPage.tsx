/**
 * ============================================
 *  NotesPage.tsx — All unassigned notes
 * ============================================
 *
 * Shows all lectures without a course (course_id = null).
 * This is a quick capture space for thoughts that don't belong to any course yet.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useRecentLectures } from "../hooks/useRecentLectures";
import { useConfirmDialog } from "../hooks/useConfirmDialog";
import { useSemester } from "../lib/semesterContext";
import {
  type Lecture,
  lectureSlug,
  lectureTitle,
  lectureCourseId,
  semesterSlug,
} from "../lib/types";

import Header from "../components/Header";
import LectureTile from "../components/LectureTile";
import AddTile from "../components/AddTile";
import LectureEditor from "../components/LectureEditor";
import ConfirmDialog from "../components/ConfirmDialog";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";

import { deleteLecture } from "../services/lectureService";

function NotesPage() {
  const navigate = useNavigate();
  const { current } = useSemester();
  const semSlug = current ? semesterSlug(current) : "";

  const {
    lectures,
    loading,
    error,
    refetch,
  } = useRecentLectures(100);

  const [creatingNote, setCreatingNote] = useState(false);
  const [editingNote, setEditingNote] = useState<Lecture | null>(null);
  const confirm = useConfirmDialog();

  // Filter only unassigned notes
  const unassignedNotes = lectures.filter((lec) => !lectureCourseId(lec));

  const handleOpenNote = (lec: Lecture) => {
    navigate(`/note/${lectureSlug(lec)}`);
  };

  const handleEditNote = (lec: Lecture) => {
    setEditingNote(lec);
  };

  const handleDeleteNote = (lec: Lecture) => {
    const t = lectureTitle(lec);
    confirm.ask("Удалить заметку?", `Заметка «${t}» будет удалена.`, () => {
      void deleteLecture(lec.id);
      void refetch();
    });
  };

  if (loading && unassignedNotes.length === 0) {
    return <LoadingState />;
  }

  if (creatingNote) {
    return (
      <LectureEditor
        isNote
        onSaved={() => {
          setCreatingNote(false);
          void refetch();
        }}
        onCancel={() => setCreatingNote(false)}
      />
    );
  }

  if (editingNote) {
    return (
      <LectureEditor
        isNote
        lecture={editingNote}
        onSaved={() => {
          setEditingNote(null);
          void refetch();
        }}
        onCancel={() => setEditingNote(null)}
      />
    );
  }

  return (
    <>
      <Header
        crumbs={[
          { label: "Рабочий стол", to: `/s/${semSlug}` },
          { label: "Заметки" },
        ]}
      />
      <div className="page">
        <div className="content-canvas">
          <ErrorBanner message={error} />

          <h1 className="page-title">Все заметки</h1>
          <p className="page-subtitle">
            Быстрый захват мыслей без привязки к курсу.
          </p>

          {unassignedNotes.length === 0 ? (
            <div className="empty">
              Пока нет заметок — создайте первую!
            </div>
          ) : null}

          <div className="bento">
            <AddTile
              label="+ Новая заметка"
              onClick={() => setCreatingNote(true)}
            />

            {unassignedNotes.map((lec, i) => (
              <LectureTile
                key={lec.id}
                lecture={lec}
                index={i + 1}
                unassigned
                onClick={() => handleOpenNote(lec)}
                onEdit={() => handleEditNote(lec)}
                onDelete={() => handleDeleteNote(lec)}
              />
            ))}
          </div>

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
  );
}

export default NotesPage;
