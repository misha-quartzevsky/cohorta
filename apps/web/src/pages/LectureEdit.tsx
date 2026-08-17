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
import { fetchLectureBySlug } from "../services/lectureService";

import LectureEditor from "../components/LectureEditor";
import LoadingState from "../components/LoadingState";

function LectureEdit() {
  const { semesterSlug, courseSlug, lectureSlug } = useParams();
  const navigate = useNavigate();

  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!lectureSlug) return;
    fetchLectureBySlug(lectureSlug)
      .then(setLecture)
      .catch((e) => {
        console.error("Ошибка загрузки записи:", e);
        setError(
          "Не удалось загрузить запись: " +
            (e instanceof Error ? e.message : String(e))
        );
      });
  }, [lectureSlug]);

  if (error) {
    return (
      <div className="page">
        <div className="error-banner">{error}</div>
      </div>
    );
  }

  if (!lecture) return <LoadingState />;

  const unassigned = !lectureCourseId(lecture);
  // "/note/" routes have no courseSlug segment.
  const isCourseContext = !!courseSlug;
  const back = () => {
    if (isCourseContext) {
      navigate(`/s/${semesterSlug}/${courseSlug}/${lectureSlug}`);
    } else {
      navigate(`/s/${semesterSlug}/note/${lectureSlug}`);
    }
  };

  return (
    <LectureEditor
      lecture={lecture}
      isNote={unassigned || !isCourseContext}
      courseId={lectureCourseId(lecture) || undefined}
      onSaved={back}
      onCancel={back}
    />
  );
}

export default LectureEdit;