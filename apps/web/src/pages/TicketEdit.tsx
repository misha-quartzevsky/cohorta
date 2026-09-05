/**
 * ============================================
 *  TicketEdit.tsx — написание ответа
 * ============================================
 *
 * Тот же автосейв (debounce 1.2 с) и та же карточка, что у
 * LectureEdit — билет отличается от конспекта только тем, что
 * заголовок неизменяем (это формулировка вопроса, а не название,
 * которое выбирает студент) и статус переключается вручную.
 *
 * Пустой ответ всегда откатывает статус в `empty` — см.
 * `statusForAnswer` в examService: это защита от «стёр текст,
 * а зелёная отметка осталась».
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, Loader2 } from "lucide-react";

import { useSemester } from "../lib/semesterContext";
import { useCourseBySlug } from "../hooks/useCourseBySlug";
import { useExam } from "../hooks/useExam";
import {
  courseName,
  semesterSlug,
  ticketAnswer,
  ticketNumber,
  ticketQuestion,
  ticketStatus,
} from "../lib/types";
import type { ExamTicket, TicketStatus } from "../lib/types";
import { resolveFileTokensFor, tokenizeFileUrlsFor } from "../lib/fileTokens";
import {
  statusForAnswer,
  updateTicket,
  uploadTicketImages,
} from "../services/examService";

import Header from "../components/Header";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import SemesterGate from "../components/SemesterGate";
import Editor from "../components/Editor";

type SaveState = "idle" | "saving" | "saved" | "error";

function TicketEdit() {
  const navigate = useNavigate();
  const { courseSlug: courseSlugParam, number: numberParam } = useParams();
  const { current } = useSemester();
  const semSlug = current ? semesterSlug(current) : "";
  const base = `/s/${semSlug}/${courseSlugParam}`;

  const { course, loading: courseLoading } = useCourseBySlug(
    courseSlugParam ?? ""
  );
  const { exam, tickets, loading: examLoading, refetch } = useExam(
    course?.id ?? "",
    !!course
  );
  const ticket = tickets.find((t) => ticketNumber(t) === Number(numberParam));

  const [content, setContent] = useState("");
  const [status, setStatus] = useState<TicketStatus>("empty");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [loaded, setLoaded] = useState(false);

  const contentRef = useRef("");
  const statusRef = useRef<TicketStatus>("empty");
  const ticketRef = useRef<ExamTicket | null>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    if (!ticket) return;
    const c = resolveFileTokensFor(ticketAnswer(ticket), ticket);
    contentRef.current = c;
    setContent(c);
    statusRef.current = ticketStatus(ticket);
    setStatus(ticketStatus(ticket));
    ticketRef.current = ticket;
    firstRun.current = true;
    setLoaded(true);
  }, [ticket]);

  const doSave = useCallback(async () => {
    const t = ticketRef.current;
    if (!t) return;
    try {
      const nextStatus = statusForAnswer(contentRef.current, statusRef.current);
      statusRef.current = nextStatus;
      setStatus(nextStatus);
      await updateTicket(t.id, {
        answer: tokenizeFileUrlsFor(contentRef.current, t, "exam_tickets"),
        status: nextStatus,
      });
      setSaveState("saved");
    } catch (e) {
      console.error("Ошибка автосохранения билета:", e);
      setSaveState("error");
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setSaveState("saving");
    const timer = setTimeout(() => {
      void doSave();
    }, 1200);
    return () => clearTimeout(timer);
  }, [content, loaded, doSave]);

  useEffect(() => {
    if (saveState !== "saved") return;
    const timer = setTimeout(() => setSaveState("idle"), 3000);
    return () => clearTimeout(timer);
  }, [saveState]);

  const updateContent = (v: string) => {
    contentRef.current = v;
    setContent(v);
  };

  const handleUploadImages = useCallback(async (files: File[]) => {
    const t = ticketRef.current;
    if (!t) {
      throw new Error("Билет ещё не создан.");
    }
    return uploadTicketImages(t, files);
  }, []);

  const markReady = async () => {
    const t = ticketRef.current;
    if (!t) return;
    statusRef.current = "ready";
    setStatus("ready");
    await updateTicket(t.id, { status: "ready" });
    void refetch();
    navigate(`${base}/exam`);
  };

  const loading = courseLoading || examLoading;
  const saveText =
    saveState === "saving"
      ? "Сохранение…"
      : saveState === "saved"
        ? "Обновлено только что"
        : saveState === "error"
          ? "Ошибка сохранения"
          : "Сохранено";

  return (
    <SemesterGate>
      <Header
        crumbs={[
          { label: "Рабочий стол", to: `/s/${semSlug}` },
          { label: course ? courseName(course) : "Курс", to: base },
          { label: "Экзамен", to: `${base}/exam` },
          { label: ticket ? `Билет ${ticketNumber(ticket)}` : "Билет" },
        ]}
      />
      <div className="page">
        {loading ? (
          <LoadingState />
        ) : !exam || !ticket ? (
          <ErrorBanner message="Билет не найден." />
        ) : (
          <div className="lecture-card">
            <div className="edit-meta-row">
              <p className="lecture-card-meta">Билет {ticketNumber(ticket)}</p>
              <span className={`save-indicator ${saveState}`}>
                {saveState === "saving" && (
                  <Loader2 size={14} className="spin" />
                )}
                {saveText}
              </span>
            </div>
            <h1 className="lecture-card-title">{ticketQuestion(ticket)}</h1>
            <Editor
              key={ticket.id}
              value={content}
              onUpdate={updateContent}
              className="editor-inline"
              placeholder="Пиши ответ…"
              onUploadImages={handleUploadImages}
            />
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => void markReady()}
              disabled={status === "ready"}
              style={{ marginTop: "1rem" }}
            >
              <Check size={16} />
              {status === "ready" ? "Готов" : "Отметить готовым"}
            </button>
          </div>
        )}
      </div>
    </SemesterGate>
  );
}

export default TicketEdit;
