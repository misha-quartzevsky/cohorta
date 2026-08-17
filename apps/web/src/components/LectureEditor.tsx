/**
 * ============================================
 *  LectureEditor.tsx
 * ============================================
 *
 * Full-page form for creating or editing a lecture.
 * Uses the service layer (`createLecture` /
 * `updateLecture`) instead of calling `pb`
 * directly.
 *
 * When `lecture` is `null`  → create mode
 * When `lecture` is set    → edit mode
 */

import { useEffect, useState } from "react";
import type { Lecture } from "../lib/types";
import { FIELDS } from "../lib/types";
import {
  createLecture as createLectureService,
  createUnassignedLecture,
  updateLecture as updateLectureService,
} from "../services/lectureService";
import { X } from "lucide-react";
import Editor from "../components/Editor";

interface Props {
  /** Course this lecture belongs to (foreign-key field).
   *  If empty, an unassigned lecture is created instead. */
  courseId?: string;
  /** If provided, the form edits this lecture. If null, creates a new one. */
  lecture?: Lecture | null;
  /** True → labels the form as a "заметка" (note) instead of a lecture. */
  isNote?: boolean;
  /** Called after a successful save (refreshes the parent list). */
  onSaved: () => void;
  /** Exits the editor without saving. */
  onCancel: () => void;
}

/**
 * Full-page lecture editor form.
 *
 * @param Props.courseId  — foreign-key course ID
 * @param Props.lecture   — null for creation, object for editing
 * @param Props.onSaved   — refresh parent list
 * @param Props.onCancel  — dismiss the editor
 */
function LectureEditor({ courseId, lecture, isNote, onSaved, onCancel }: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // When editing, pre-fill the form with the lecture's data.
  useEffect(() => {
    if (lecture) {
      const t: unknown = lecture[FIELDS.lectureTitle];
      const c: unknown = lecture[FIELDS.lectureContent];
      setTitle(t ? String(t) : "");
      setContent(c ? String(c) : "");
    }
  }, [lecture]);

  /**
   * Persist the lecture (create or update) via the
   * service layer, then notify the parent.
   *
   * @param e — form submit event (prevent default)
   */
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    setError("");

    try {
      if (lecture) {
        // --- Edit mode ---
        await updateLectureService(lecture.id, title.trim(), content);
      } else if (courseId) {
        // --- Create mode: inside a course ---
        await createLectureService(title.trim(), content, courseId);
      } else {
        // --- Create mode: free / unassigned note ---
        await createUnassignedLecture(title.trim(), content);
      }
      onSaved();
    } catch (e) {
      console.error("Ошибка сохранения:", e);
      setError(
        "Не удалось сохранить лекцию: " +
          (e instanceof Error ? e.message : String(e))
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <button className="back-link" onClick={onCancel} type="button">
            <X size={18} /> Отмена
          </button>
          <img src="/cohorta-black.svg" alt="Cohorta" />
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleSave}>
        <div className="create-form">
          <h3>
            {lecture
              ? isNote
                ? "Редактирование заметки"
                : "Редактирование лекции"
              : isNote
                ? "Новая заметка"
                : "Новая лекция"}
          </h3>

          <input
            className="field"
            placeholder={
              isNote
                ? "Название заметки (например, «Идея для эссе»)"
                : "Название лекции (например, «Введение в логику»)"
            }
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />

<Editor
             value={content}
             onUpdate={setContent}
             placeholder="Начните писать текст лекции…"
           />

          <div className="actions-row">
            <button
              className="btn btn-primary"
              type="submit"
              disabled={!title.trim() || saving}
            >
              {saving
                ? "Сохраняем…"
                : lecture
                  ? "Сохранить изменения"
                  : isNote
                    ? "Сохранить заметку"
                    : "Сохранить лекцию"}
            </button>
            <button
              className="btn btn-outline"
              type="button"
              onClick={onCancel}
            >
              Отмена
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default LectureEditor;

