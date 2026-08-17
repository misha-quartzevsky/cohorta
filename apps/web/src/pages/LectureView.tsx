/**
 * ============================================
 *  LectureView.tsx — Страница лекции / заметки
 * ============================================
 *
 * Показывает полное содержимое одной записи
 * (заголовок, текст, дата) с действиями
 * «Редактировать» и «Удалить».
 * 
 * Внедрена индикация сохранения с debounce (2 сек).
 */

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import type { Lecture } from "../lib/types";
import {
  lectureTitle,
  lectureContent,
  lectureCourseId,
} from "../lib/types";
import { fetchLectureBySlug, deleteLecture } from "../services/lectureService";

import Header from "../components/Header";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import ConfirmDialog from "../components/ConfirmDialog";

function LectureView() {
  const { semesterSlug, courseSlug, lectureSlug } = useParams();
  const navigate = useNavigate();

  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState<string>("");

  useEffect(() => {
    if (!lectureSlug) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setSaving(false);
    fetchLectureBySlug(lectureSlug)
      .then((rec) => {
        if (!cancelled) {
          setLecture(rec);
          setContent(lectureContent(rec) || "");
        }
      })
      .catch((e) => {
        if (!cancelled) {
          console.error("Ошибка загрузки записи:", e);
          setError(
            "Не удалось загрузить запись: " +
              (e instanceof Error ? e.message : String(e))
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lectureSlug]);

  // Debounced saving indicator
  useEffect(() => {
    const timer = setTimeout(() => setSaving(false), 2000);
    setSaving(true);
    return () => clearTimeout(timer);
  }, [content]);

  if (loading) return <LoadingState />;

  if (!lecture) {
    return (
      <div className="page">
        <Header onBack={() => navigate(-1)} />
        <ErrorBanner message={error || "Запись не найдена."} />
      </div>
    );
  }

  const title = lectureTitle(lecture);
  const unassigned = !lectureCourseId(lecture);
  // Route context: "/note/" routes have no courseSlug segment.
  const isCourseContext = !!courseSlug;

  const handleEdit = () => {
    if (isCourseContext) {
      navigate(`/s/${semesterSlug}/${courseSlug}/${lectureSlug}/edit`);
    } else {
      navigate(`/s/${semesterSlug}/note/${lectureSlug}/edit`);
    }
  };

  const handleDelete = async () => {
    await deleteLecture(lecture.id);
    setConfirmOpen(false);
    navigate(
      isCourseContext
        ? `/s/${semesterSlug}/${courseSlug}`
        : `/s/${semesterSlug}`
    );
  };

  return (
    <div className="page">
      <Header onBack={() => navigate(-1)} />

      <ErrorBanner message={error} />

      <article className="lecture-view">
        <p className="lecture-view-meta">
          {new Date(lecture.created).toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          {unassigned && " · Не привязана к курсу"}
        </p>

                <h1 className="lecture-view-title">{title}</h1>

        {saving ? (
          <p className="lecture-view-saving">Сохраняем…</p>
        ) : (
          <div className="lecture-view-content"
            dangerouslySetInnerHTML={{ __html: content || "" }} />

        )}

        <div className="actions-row">
          <button className="btn btn-primary" type="button" onClick={handleEdit}>
            Редактировать
          </button>
          <button
            className="btn btn-danger"
            type="button"
            onClick={() => setConfirmOpen(true)}
          >
            Удалить
          </button>
        </div>
      </article>

      <ConfirmDialog
        open={confirmOpen}
        title="Удалить запись?"
        message={`Запись «${title}» будет удалена.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

export default LectureView;
