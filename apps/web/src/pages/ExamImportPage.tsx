/**
 * ============================================
 *  ExamImportPage.tsx — вставка + разбор + превью
 * ============================================
 *
 * Студент вставляет список вопросов; разбор пробует структуру
 * буфера обмена (HTML-список), затем откатывается на построчный
 * текст (см. `lib/examImport.ts`). Превью — обязательный шаг:
 * никакого «слепого» импорта, строки редактируются и удаляются
 * до сохранения.
 *
 * Повторный импорт в существующий экзамен дописывает билеты:
 * номера, которые уже заняты, пропускаются, а не затираются —
 * иначе повторный импорт мог бы стереть написанные ответы.
 */

import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Trash2, Upload } from "lucide-react";

import { useSemester } from "../lib/semesterContext";
import { useCourseBySlug } from "../hooks/useCourseBySlug";
import { useExam } from "../hooks/useExam";
import { courseName, semesterSlug, ticketNumber } from "../lib/types";
import { errorMessage } from "../lib/format";
import {
  parseTicketsFromClipboard,
  type ParsedTicket,
} from "../lib/examImport";
import { createExam, createTicketsBulk } from "../services/examService";

import Header from "../components/Header";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import SemesterGate from "../components/SemesterGate";

type Source = "html-list" | "text-lines" | null;

function ExamImportPage() {
  const navigate = useNavigate();
  const { courseSlug: courseSlugParam } = useParams();
  const { current } = useSemester();
  const semSlug = current ? semesterSlug(current) : "";
  const base = `/s/${semSlug}/${courseSlugParam}`;

  const { course, loading: courseLoading } = useCourseBySlug(
    courseSlugParam ?? ""
  );
  const { exam, tickets: existingTickets } = useExam(
    course?.id ?? "",
    !!course
  );

  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<ParsedTicket[]>([]);
  const [source, setSource] = useState<Source>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const takenNumbers = new Set(existingTickets.map((t) => ticketNumber(t)));
  const skipped = preview.filter((t) => takenNumbers.has(t.number));
  const toImport = preview.filter((t) => !takenNumbers.has(t.number));

  const runParse = (html: string, text: string) => {
    const result = parseTicketsFromClipboard(html, text);
    setPreview(result.tickets);
    setSource(result.source);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    if (html || text) {
      e.preventDefault();
      setRaw(text);
      runParse(html, text);
    }
  };

  const updatePreviewQuestion = (index: number, value: string) => {
    setPreview((prev) =>
      prev.map((t, i) => (i === index ? { ...t, question: value } : t))
    );
  };

  const removePreviewRow = (index: number) => {
    setPreview((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!course) return;
    if (toImport.length === 0) {
      setError("Нечего сохранять — список пуст или все номера уже заняты.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const target = exam ?? (await createExam({ courseId: course.id }));
      await createTicketsBulk(target.id, toImport);
      navigate(`${base}/exam`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (courseLoading) {
    return (
      <SemesterGate>
        <Header crumbs={[{ label: "Рабочий стол", to: `/s/${semSlug}` }]} />
        <div className="page">
          <LoadingState />
        </div>
      </SemesterGate>
    );
  }

  return (
    <SemesterGate>
      <Header
        crumbs={[
          { label: "Рабочий стол", to: `/s/${semSlug}` },
          { label: course ? courseName(course) : "Курс", to: base },
          { label: "Экзамен", to: `${base}/exam` },
          { label: "Импорт" },
        ]}
      />
      <div className="page">
        <h1 className="page-title">Загрузи список билетов</h1>
        <p className="page-subtitle">
          Вставь список вопросов — по одному билету на пункт.
        </p>

        <ErrorBanner message={error} />

        <textarea
          className="exam-import-textarea"
          placeholder="Вставь список вопросов, по одному в строке…"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onPaste={handlePaste}
        />
        {preview.length === 0 && raw.trim() && (
          <button
            className="btn btn-outline"
            type="button"
            onClick={() => runParse("", raw)}
            style={{ marginTop: "0.6rem" }}
          >
            Разобрать текст
          </button>
        )}

        {preview.length > 0 && (
          <>
            <p className="exam-import-source">
              {source === "html-list"
                ? `Распознан список: ${preview.length} ${
                    preview.length === 1 ? "билет" : "пунктов"
                  }.`
                : `Разобрано по строкам: ${preview.length} ${
                    preview.length === 1 ? "билет" : "пунктов"
                  }.`}
              {skipped.length > 0 &&
                ` Номера уже заняты и будут пропущены: ${skipped
                  .map((t) => t.number)
                  .join(", ")}.`}
            </p>

            <div className="exam-preview-list">
              {preview.map((t, i) => (
                <div key={i} className="exam-preview-row">
                  <span className="exam-preview-number">
                    {t.number}
                    {takenNumbers.has(t.number) ? " ⚠" : ""}
                  </span>
                  <textarea
                    className="exam-preview-text"
                    value={t.question}
                    onChange={(e) => updatePreviewQuestion(i, e.target.value)}
                    rows={2}
                  />
                  <button
                    className="exam-preview-remove"
                    type="button"
                    onClick={() => removePreviewRow(i)}
                    aria-label="Удалить"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            <button
              className="btn btn-primary"
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || toImport.length === 0}
            >
              <Upload size={16} />
              {saving
                ? "Сохранение…"
                : `Сохранить ${toImport.length} ${
                    toImport.length === 1 ? "билет" : "билетов"
                  }`}
            </button>
          </>
        )}
      </div>
    </SemesterGate>
  );
}

export default ExamImportPage;
