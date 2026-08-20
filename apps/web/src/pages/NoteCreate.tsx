/**
 * ============================================
 *  NoteCreate.tsx — новая заметка (без курса)
 * ============================================
 *
 * Маршрут `/note/new`. Использует тот же карточный интерфейс, что и редактор
 * лекций (LectureEdit): `.lecture-card` с полем заголовка + полный Tiptap-
 * редактор. После сохранения перенаправляет на просмотр созданной заметки.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";

import { errorMessage } from "../lib/format";
import { lastSemesterSlug } from "../lib/lastSemester";
import { createUnassignedLecture } from "../services/lectureService";

import Header from "../components/Header";
import Editor from "../components/Editor";
import ErrorBanner from "../components/ErrorBanner";

export default function NoteCreate() {
  const navigate = useNavigate();
  const semSlug = lastSemesterSlug();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const created = await createUnassignedLecture(title.trim(), content);
      navigate(`/note/${created.slug}`);
    } catch (e) {
      console.error("Ошибка создания заметки:", e);
      setError("Не удалось создать заметку: " + errorMessage(e));
      setSaving(false);
    }
  };

  const crumbs = [
    { label: "Рабочий стол", to: `/s/${semSlug}` },
    { label: "Заметки", to: "/notes" },
    { label: "Новая заметка" },
  ];

  return (
    <>
      <Header crumbs={crumbs} />
      <div className="page">
        <div className="workspace-simple">
          <div className="lecture-card">
            <div className="edit-meta-row">
              <p className="lecture-card-meta">Новая заметка</p>
              <span className="save-indicator idle">Черновик</span>
            </div>

            <input
              className="lecture-title-input"
              value={title}
              placeholder="Название заметки"
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />

            <div className="lecture-card-body">
              <Editor
                value={content}
                onUpdate={setContent}
                className="editor-inline"
                placeholder="Начните писать заметку…"
              />
            </div>

            <div className="actions-row">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => navigate("/notes")}
                disabled={saving}
              >
                <ArrowLeft size={15} /> Отмена
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={!title.trim() || saving}
              >
                {saving && <Loader2 size={15} className="spin" />}
                {saving ? "Сохраняем…" : "Сохранить заметку"}
              </button>
            </div>

            {error && <ErrorBanner message={error} />}
          </div>
        </div>
      </div>
    </>
  );
}
