/**
 * ============================================
 *  ExamImportPageNew.tsx — «Импорт билетов» (B4, 2026-10-20)
 * ============================================
 *
 * Вёрстка 1:1 по docs/design/screens/Screen-ticket-import.dc.html (своей
 * телефонной версии в макете нет — по разделу 10 инструкции делаем по
 * десктопной версии, две колонки складываются в одну на узком экране).
 *
 * Разбор без изменений: lib/examImport.ts (parseTicketsFromClipboard) —
 * тот же HTML-список/псевдо-список Word/построчный текст, что в старом
 * ExamImportPage.tsx. Повторный импорт пропускает занятые номера, не
 * затирая написанные ответы (см. комментарий в lib/examImport.ts).
 */

import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Button, EmptyState, Icon, StatusChip } from "../ui";
import { Textarea } from "../ui/Field";
import { useSemester } from "../lib/semesterContext";
import { useCourseBySlug } from "../hooks/useCourseBySlug";
import { useExam } from "../hooks/useExam";
import { courseName, semesterSlug, ticketNumber } from "../lib/types";
import { errorMessage, pluralRu } from "../lib/format";
import { parseTicketsFromClipboard, type ParsedTicket } from "../lib/examImport";
import { createExam, createTicketsBulk } from "../services/examService";

type Source = "html-list" | "text-lines" | null;

export default function ExamImportPageNew() {
  const navigate = useNavigate();
  const { courseSlug: courseSlugParam } = useParams();
  const { current } = useSemester();
  const semSlug = current ? semesterSlug(current) : "";
  const base = `/s/${semSlug}/${courseSlugParam}`;

  const { course } = useCourseBySlug(courseSlugParam ?? "");
  const { exam, tickets: existingTickets } = useExam(course?.id ?? "", !!course);

  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<ParsedTicket[]>([]);
  const [source, setSource] = useState<Source>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const takenNumbers = new Set(existingTickets.map((t) => ticketNumber(t)));
  const toImport = preview.filter((t) => !takenNumbers.has(t.number));
  const skippedCount = preview.length - toImport.length;

  const addLabel = saving
    ? "Сохранение…"
    : `Добавить ${toImport.length} ${pluralRu(toImport.length, ["билет", "билета", "билетов"])}`;

  function runParse(html: string, text: string) {
    const result = parseTicketsFromClipboard(html, text);
    setPreview(result.tickets);
    setSource(result.source);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    if (html || text) {
      e.preventDefault();
      setRaw(text);
      runParse(html, text);
    }
  }

  async function handleSave() {
    if (!course || toImport.length === 0) return;
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
  }

  return (
    <div className="c-import">
      <div className="c-exam-m-crumb">
        <Link to={`${base}/exam`}>
          <Icon name="chev" size={18} style={{ transform: "scaleX(-1)" }} />
          Экзамен
        </Link>
      </div>
      <div className="c-exam-crumb">
        <Link to={base}>{course ? courseName(course) : ""}</Link>
        <Icon name="chev" size={14} />
        <Link to={`${base}/exam`}>Экзамен</Link>
        <Icon name="chev" size={14} />
        <span className="current">Импорт</span>
      </div>
      <div className="c-import-head">
        <div>
          <h1>Импорт билетов</h1>
          <span>
            {course ? courseName(course) : ""}
            {exam?.exam_date ? ` · экзамен ${new Date(exam.exam_date).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}` : ""}
          </span>
        </div>
        {toImport.length > 0 && (
          <Button variant="primary" className="c-form-d" onClick={() => void handleSave()} disabled={saving}>
            {addLabel}
          </Button>
        )}
      </div>

      {error && (
        <EmptyState icon="info" title="Не удалось сохранить" description={error} />
      )}

      <div className="c-import-cols">
        <div className="c-import-col c-import-textarea">
          <span className="label">
            <span className="c-form-d">Вставь список билетов</span>
            <span className="c-form-m">Список билетов</span>
          </span>
          <Textarea
            placeholder="Вставь список вопросов, по одному в строке…"
            value={raw}
            onChange={(e) => {
              const value = e.target.value;
              setRaw(value);
              if (value.trim()) runParse("", value);
              else {
                setPreview([]);
                setSource(null);
              }
            }}
            onPaste={handlePaste}
            rows={8}
          />
          <span className="hint">
            <span className="c-form-d">Один билет на строку. Номера и точки в начале мы уберём сами.</span>
            <span className="c-form-m">Один билет на строку. Номера можно не писать.</span>
          </span>
        </div>

        <div className="c-import-col">
          <span className="label c-import-found">
            <span className="c-form-d">Так билеты добавятся</span>
            <span className="c-form-m">
              Найдено {preview.length} {pluralRu(preview.length, ["билет", "билета", "билетов"])}
            </span>
          </span>
          {preview.length === 0 ? (
            <span className="hint">Здесь появится список после вставки.</span>
          ) : (
            <>
              <span className="hint">
                {source === "html-list"
                  ? `Распознан список: ${preview.length} ${pluralRu(preview.length, ["билет", "билета", "билетов"])}.`
                  : `Разобрано по строкам: ${preview.length} ${pluralRu(preview.length, ["билет", "билета", "билетов"])}.`}
                {skippedCount > 0 &&
                  ` Номера уже заняты и будут пропущены: ${preview
                    .filter((t) => takenNumbers.has(t.number))
                    .map((t) => t.number)
                    .join(", ")}.`}
              </span>
              <div className="c-import-preview">
                {preview.map((t) => (
                  <div key={`${t.number}-${t.question}`} className="c-import-preview-row">
                    <span className="num">{t.number}</span>
                    <span className="q">{t.question}</span>
                    {takenNumbers.has(t.number) ? (
                      <StatusChip tone="warn">Номер занят</StatusChip>
                    ) : (
                      <StatusChip tone="neutral">Новый</StatusChip>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      {toImport.length > 0 && (
        <div className="c-import-m-cta">
          <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
            {addLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
