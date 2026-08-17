/**
 * ============================================
 *  LectureEdit.tsx — Редактирование лекции
 * ============================================
 *
 * Загружает запись по её ID и открывает
 * полноэкранный редактор (`LectureEditor`)
 * с уже заполненными данными.
 */

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import type { Lecture } from "../lib/types";
import { lectureCourseId } from "../lib/types";
import { fetchLecture } from "../services/lectureService";

import LectureEditor from "../components/LectureEditor";
import LoadingState from "../components/LoadingState";

function LectureEdit() {
  const { lectureId } = useParams();
  const navigate = useNavigate();

  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!lectureId) return;
    fetchLecture(lectureId)
      .then(setLecture)
      .catch((e) => {
        console.error("Ошибка загрузки записи:", e);
        setError(
          "Не удалось загрузить запись: " +
            (e instanceof Error ? e.message : String(e))
        );
      });
  }, [lectureId]);

  if (error) {
    return (
      <div className="page">
        <div className="error-banner">{error}</div>
      </div>
    );
  }

  if (!lecture) return <LoadingState />;

  const unassigned = !lectureCourseId(lecture);
  const back = () => navigate(`/lectures/${lecture.id}`);

  return (
    <LectureEditor
      lecture={lecture}
      isNote={unassigned}
      courseId={lectureCourseId(lecture) || undefined}
      onSaved={back}
      onCancel={back}
    />
  );
}

export default LectureEdit;