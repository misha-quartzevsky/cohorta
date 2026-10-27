/**
 * ============================================
 *  TicketPage.tsx — «Билет» (B4, 2026-10-20)
 * ============================================
 *
 * Вёрстка 1:1 по docs/design/screens/Screen-ticket.dc.html (своей
 * телефонной версии в макете нет — раздел 10 инструкции разрешает делать
 * такие экраны по десктопной версии и правилам остальных телефонных
 * экранов волны; здесь это просто один узкий столбец).
 *
 * Отдельного макета «билет — редактирование» нет. Решение: одна
 * поверхность на чтение/правку, тот же приём, что у pages/LectureView.tsx
 * (Notion-стиль) — кнопка «Изменить» монтирует редактор на месте текста,
 * вместо отдельного маршрута. `/exam/:number/edit` остаётся рабочим
 * алиасом, который сразу открывает редактор (как у `/…/edit` лекции).
 *
 * «Связанные лекции» редактируются прямо здесь (components/exam/
 * TicketSourcesPanel.tsx) — в макете список и «Привязать лекцию» лежат
 * на этом же экране, отдельного режима правки связей нет.
 *
 * Удаления билета в новом макете нет (ни кнопки, ни меню) — в отличие от
 * старого TicketView.tsx. Решение не восстанавливать её молча записано
 * в docs/decisions.md как открытый вопрос.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { Button, Icon, StatusChip, Toggletip } from "../ui";
import TicketSourcesPanel from "../components/exam/TicketSourcesPanel";
import SaveIndicator from "../components/SaveIndicator";
import Editor from "../components/Editor";
import { useAutosave } from "../hooks/useAutosave";
import { useSemester } from "../lib/semesterContext";
import { useCourseBySlug } from "../hooks/useCourseBySlug";
import { useExam } from "../hooks/useExam";
import { useLectures } from "../hooks/useLectures";
import {
  courseName,
  semesterSlug,
  ticketAnswer,
  ticketNumber,
  ticketQuestion,
  ticketSourceIds,
  ticketStatus,
} from "../lib/types";
import type { ExamTicket, TicketStatus } from "../lib/types";
import { timeAgo } from "../lib/format";
import { resolveFileTokensFor, tokenizeFileUrlsFor } from "../lib/fileTokens";
import {
  statusForAnswer,
  updateTicket,
  uploadTicketImages,
} from "../services/examService";
import { renderLatexInto } from "../components/math/renderLatex";

const STATUS_LABEL: Record<TicketStatus, string> = {
  ready: "Готов",
  draft: "В работе",
  empty: "Не начат",
};
const STATUS_TONE: Record<TicketStatus, "ok" | "accent" | "neutral"> = {
  ready: "ok",
  draft: "accent",
  empty: "neutral",
};

export default function TicketPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { courseSlug: courseSlugParam, number: numberParam } = useParams();
  const { current } = useSemester();
  const semSlug = current ? semesterSlug(current) : "";
  const base = `/s/${semSlug}/${courseSlugParam}`;

  const { course } = useCourseBySlug(courseSlugParam ?? "");
  const { exam, tickets, refetch } = useExam(course?.id ?? "", !!course);
  const { lectures } = useLectures(courseSlugParam ?? "", !!courseSlugParam);

  const ticket = tickets.find((t) => ticketNumber(t) === Number(numberParam));

  const startLive = location.pathname.endsWith("/edit");
  const [mode, setMode] = useState<"view" | "edit">(startLive ? "edit" : "view");

  const [content, setContent] = useState("");
  const [status, setStatus] = useState<TicketStatus>("empty");
  const [loaded, setLoaded] = useState(false);

  const contentRef = useRef("");
  const statusRef = useRef<TicketStatus>("empty");
  const ticketRef = useRef<ExamTicket | null>(null);
  const viewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ticket) return;
    const c = resolveFileTokensFor(ticketAnswer(ticket), ticket);
    contentRef.current = c;
    setContent(c);
    statusRef.current = ticketStatus(ticket);
    setStatus(ticketStatus(ticket));
    ticketRef.current = ticket;
    setMode(location.pathname.endsWith("/edit") ? "edit" : "view");
    setLoaded(true);
    // Переоткрытие другого билета должно сбрасывать состояние — id в deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.id]);

  useLayoutEffect(() => {
    if (mode !== "view") return;
    const root = viewRef.current;
    if (!root) return;
    const renderBlocks = () => {
      root
        .querySelectorAll<HTMLElement>("[data-type='math-block']")
        .forEach((block) => void renderLatexInto(block, block.dataset.latex || ""));
    };
    renderBlocks();
    const t1 = window.setTimeout(renderBlocks, 120);
    const t2 = window.setTimeout(renderBlocks, 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [mode, content]);

  const doSave = useCallback(async () => {
    const t = ticketRef.current;
    if (!t) return;
    const nextStatus = statusForAnswer(contentRef.current, statusRef.current);
    statusRef.current = nextStatus;
    setStatus(nextStatus);
    await updateTicket(t.id, {
      answer: tokenizeFileUrlsFor(contentRef.current, t, "exam_tickets"),
      status: nextStatus,
    });
  }, []);

  const { saveState, saveText } = useAutosave({
    save: doSave,
    deps: [content],
    enabled: loaded && mode === "edit",
  });

  function updateContent(v: string) {
    contentRef.current = v;
    setContent(v);
  }

  const handleUploadImages = useCallback(async (files: File[]) => {
    const t = ticketRef.current;
    if (!t) throw new Error("Билет ещё не создан.");
    return uploadTicketImages(t, files);
  }, []);

  async function handleSourcesChange(next: string[]) {
    const t = ticketRef.current;
    if (!t) return;
    await updateTicket(t.id, { sources: next });
    void refetch();
  }

  async function markReady() {
    const t = ticketRef.current;
    if (!t) return;
    statusRef.current = "ready";
    setStatus("ready");
    await updateTicket(t.id, { status: "ready" });
    setMode("view");
    navigate(`${base}/exam/${ticketNumber(t)}`, { replace: true });
    void refetch();
  }

  /** Снять отметку «Готов»: билет возвращается в «В работе» (или «Не начат», если ответа нет). */
  async function unmarkReady() {
    const t = ticketRef.current;
    if (!t) return;
    const next = statusForAnswer(contentRef.current, "draft");
    statusRef.current = next;
    setStatus(next);
    await updateTicket(t.id, { status: next });
    void refetch();
  }

  function startEdit() {
    setMode("edit");
    navigate(`${base}/exam/${numberParam}/edit`, { replace: true });
  }

  function openNextTicket() {
    if (tickets.length === 0 || !ticket) return;
    const idx = tickets.findIndex((t) => t.id === ticket.id);
    const next = tickets[(idx + 1) % tickets.length];
    navigate(`${base}/exam/${ticketNumber(next)}`);
  }

  if (!exam || !ticket) return null;

  return (
    <div className="c-ticket">
      <div className="c-ticket-crumb">
        <Link to={base}>{course ? courseName(course) : ""}</Link>
        <Icon name="chev" size={14} />
        <Link to={`${base}/exam`}>Экзамен</Link>
        <Icon name="chev" size={14} />
        <span className="current">Билет {ticketNumber(ticket)}</span>
      </div>

      <div className="c-ticket-head">
        <h1>Билет {ticketNumber(ticket)}</h1>
        <div className="actions">
          <Toggletip>
            Статус билета переключается вручную при редактировании: «Отметить готовым» и «Снять отметку «Готов»».
            Один лишь текст ответа билет готовым не делает.
          </Toggletip>
          {mode === "view" && (
            <Button variant="secondary" onClick={startEdit}>
              <Icon name="edit" size={18} />
              Изменить
            </Button>
          )}
          {mode === "edit" && <SaveIndicator state={saveState} text={saveText} />}
          {mode === "view" && tickets.length > 1 && (
            <Button variant="primary" onClick={openNextTicket}>
              Следующий билет
            </Button>
          )}
          {mode === "edit" && status === "ready" && (
            <>
              <Button variant="secondary" onClick={() => void unmarkReady()}>
                Снять отметку «Готов»
              </Button>
              <Button variant="primary" onClick={() => void markReady()}>
                Готово
              </Button>
            </>
          )}
          {mode === "edit" && status !== "ready" && (
            <Button variant="primary" onClick={() => void markReady()}>
              <Icon name="check" size={16} />
              Отметить готовым
            </Button>
          )}
        </div>
      </div>

      <div className="c-ticket-cols">
        <div className="c-ticket-main">
          <div className="c-exam-card c-ticket-card">
            <div className="c-ticket-meta-row">
              <StatusChip tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</StatusChip>
              {ticket.updated && <span className="m">Изменён {timeAgo(ticket.updated)}</span>}
            </div>
            <h2>{ticketQuestion(ticket)}</h2>
            {mode === "edit" ? (
              <Editor
                key={ticket.id}
                value={content}
                onUpdate={updateContent}
                className="editor-inline"
                placeholder="Пиши ответ…"
                onUploadImages={handleUploadImages}
              />
            ) : (
              <div
                ref={viewRef}
                className="body lecture-view-content is-html"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            )}
          </div>
        </div>
        <TicketSourcesPanel
          lectures={lectures}
          selectedIds={ticketSourceIds(ticket)}
          onChange={handleSourcesChange}
          course={course}
          ticketNumber={ticketNumber(ticket)}
        />
      </div>
    </div>
  );
}
