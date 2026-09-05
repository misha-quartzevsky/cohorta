/**
 * ============================================
 *  TicketView.tsx — чтение билета
 * ============================================
 *
 * Не обёрнута в LectureLayout: у билетов нет своего оглавления
 * или диктофона, а Header/сайдбар здесь — обычные, страничные.
 */

import { useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";

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
import { resolveFileTokensFor } from "../lib/fileTokens";
import { deleteTicket } from "../services/examService";
import { useConfirmDialog } from "../hooks/useConfirmDialog";
import { useUndo } from "../lib/undoContext";

import Header from "../components/Header";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import ConfirmDialog from "../components/ConfirmDialog";
import SemesterGate from "../components/SemesterGate";
import { renderLatexInto } from "../components/math/renderLatex";

function TicketView() {
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
  const contentRef = useRef<HTMLDivElement | null>(null);
  const confirm = useConfirmDialog();
  const { scheduleDelete } = useUndo();

  useLayoutEffect(() => {
    if (!ticket) return;
    setContent(resolveFileTokensFor(ticketAnswer(ticket), ticket) || "");
  }, [ticket]);

  useLayoutEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const renderBlocks = () => {
      root
        .querySelectorAll<HTMLElement>("[data-type='math-block']")
        .forEach((block) => {
          void renderLatexInto(block, block.dataset.latex || "");
        });
    };
    renderBlocks();
    const t1 = window.setTimeout(renderBlocks, 120);
    const t2 = window.setTimeout(renderBlocks, 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [content]);

  const loading = courseLoading || examLoading;

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
            <div className="lecture-card-head">
              <p className="lecture-card-meta">
                Билет {ticketNumber(ticket)} ·{" "}
                {ticketStatus(ticket) === "ready" ? "готов" : "черновик"}
              </p>
              <h1 className="lecture-card-title">{ticketQuestion(ticket)}</h1>
              <div className="lecture-card-actions">
                <button
                  className="icon-btn"
                  title="Редактировать"
                  aria-label="Редактировать"
                  onClick={() => navigate(`${base}/exam/${numberParam}/edit`)}
                  type="button"
                >
                  <Pencil size={15} />
                </button>
                <button
                  className="icon-btn danger"
                  title="Удалить"
                  aria-label="Удалить"
                  onClick={() => {
                    const num = ticketNumber(ticket);
                    const ticketId = ticket.id;
                    confirm.ask(
                      "Удалить билет?",
                      `Билет ${num} будет удалён.`,
                      () => {
                        scheduleDelete(
                          `ticket:${ticketId}`,
                          `Билет ${num} удалён`,
                          () => deleteTicket(ticketId).then(() => refetch())
                        );
                        navigate(`${base}/exam`);
                      }
                    );
                  }}
                  type="button"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <div
              ref={contentRef}
              className="lecture-card-body lecture-view-content is-html"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        onConfirm={confirm.confirm}
        onCancel={confirm.cancel}
      />
    </SemesterGate>
  );
}

export default TicketView;
