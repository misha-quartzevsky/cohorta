/**
 * ============================================
 *  ExamHubPage.tsx — «Центр подготовки»
 * ============================================
 *
 * Экзамен курса: карта билетов, честный прогресс, быстрый доступ
 * к следующему незаполненному билету и шпаргалке.
 *
 * Пустое состояние (экзамен ещё не заведён) ведёт на импорт —
 * это тот же экран, что открывается по прямому /exam/import.
 */

import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, FileText, Upload } from "lucide-react";

import { useSemester } from "../lib/semesterContext";
import { useCourseBySlug } from "../hooks/useCourseBySlug";
import { useExam } from "../hooks/useExam";
import {
  courseName,
  examTitle,
  examDaysLeft,
  semesterSlug,
  ticketNumber,
  ticketQuestion,
  ticketStatus,
} from "../lib/types";
import { pluralRu } from "../lib/format";
import { useUndo } from "../lib/undoContext";

import Header from "../components/Header";
import LoadingState from "../components/LoadingState";
import SemesterGate from "../components/SemesterGate";
import ExamParticipantsPanel from "../components/ExamParticipantsPanel";

function ExamHubPage() {
  const navigate = useNavigate();
  const { courseSlug: courseSlugParam } = useParams();
  const { current } = useSemester();
  const semSlug = current ? semesterSlug(current) : "";
  const base = `/s/${semSlug}/${courseSlugParam}`;

  const { course, loading: courseLoading } = useCourseBySlug(
    courseSlugParam ?? ""
  );
  const {
    exam,
    tickets: allTickets,
    loading: examLoading,
    refetch: refetchExam,
  } = useExam(course?.id ?? "", !!course);

  const loading = courseLoading || examLoading;

  // Билет, удалённый на TicketView, ещё сидит в окне отмены (undo-тост) —
  // не должен на секунду «воскресать» здесь после навигации назад.
  const { isPending } = useUndo();
  const tickets = allTickets.filter((t) => !isPending(`ticket:${t.id}`));

  const readyCount = tickets.filter((t) => ticketStatus(t) === "ready").length;
  const total = tickets.length;
  const percent = total > 0 ? Math.round((readyCount / total) * 100) : 0;
  const daysLeft = exam ? examDaysLeft(exam) : null;
  const nextToFill = tickets.find((t) => ticketStatus(t) !== "ready");

  return (
    <SemesterGate>
      <Header
        crumbs={[
          { label: "Рабочий стол", to: `/s/${semSlug}` },
          {
            label: course ? courseName(course) : "Курс",
            to: base,
          },
          { label: "Экзамен" },
        ]}
      />
      <div className="page">
        {loading ? (
          <LoadingState />
        ) : !exam ? (
          <div className="empty">
            <p>
              Загрузи список билетов — получишь карту подготовки со
              статусами и честным прогрессом.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => navigate(`${base}/exam/import`)}
              type="button"
            >
              <Upload size={16} />
              Загрузить билеты
            </button>
          </div>
        ) : (
          <>
            <div className="exam-hero">
              <div>
                <h1 className="exam-hero-title">
                  {examTitle(exam)} · {course ? courseName(course) : ""}
                </h1>
                <p className="exam-hero-meta">
                  {daysLeft === null
                    ? "Дата экзамена не задана"
                    : daysLeft > 0
                      ? `До экзамена ${daysLeft} ${pluralRu(daysLeft, ["день", "дня", "дней"])}`
                      : daysLeft === 0
                        ? "Экзамен сегодня"
                        : "Экзамен уже прошёл"}
                </p>
              </div>
              <div className="exam-hero-progress">
                <div className="exam-progress-bar">
                  <div
                    className="exam-progress-fill"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="exam-progress-text">
                  {readyCount} из {total} готовы
                </p>
              </div>
            </div>

            <div className="widget exam-map-widget">
              <div className="widget-head">
                <h3 className="widget-title">Карта билетов</h3>
              </div>
              <div className="exam-map-grid">
                {tickets.map((t) => {
                  const status = ticketStatus(t);
                  const n = ticketNumber(t);
                  const to =
                    status === "ready"
                      ? `${base}/exam/${n}`
                      : `${base}/exam/${n}/edit`;
                  return (
                    <Link
                      key={t.id}
                      to={to}
                      className={`exam-chip ${status}`}
                      data-label={`Билет ${n}`}
                    >
                      {n}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="dashboard-grid">
              <div className="col-main">
                <div className="widget">
                  <div className="widget-head">
                    <h3 className="widget-title">Билеты</h3>
                  </div>
                  <div className="exam-ticket-list">
                    {tickets.map((t) => {
                      const status = ticketStatus(t);
                      const n = ticketNumber(t);
                      const to =
                        status === "ready"
                          ? `${base}/exam/${n}`
                          : `${base}/exam/${n}/edit`;
                      return (
                        <Link
                          key={t.id}
                          to={to}
                          className={`exam-ticket-row ${status}`}
                        >
                          <span className="exam-ticket-number">{n}</span>
                          <span className="exam-ticket-question">
                            {ticketQuestion(t)}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="col-side">
                <div className="widget">
                  <div className="widget-head">
                    <h3 className="widget-title">Продолжить</h3>
                  </div>
                  {nextToFill ? (
                    <Link
                      to={`${base}/exam/${ticketNumber(nextToFill)}/edit`}
                      className="widget-link"
                    >
                      Билет {ticketNumber(nextToFill)}
                      <ArrowRight size={14} />
                    </Link>
                  ) : (
                    <p className="widget-empty">Все билеты готовы.</p>
                  )}
                </div>
                <div className="widget">
                  <div className="widget-head">
                    <h3 className="widget-title">Источники</h3>
                  </div>
                  <p className="widget-empty">
                    Конспекты курса рядом — свериться, пока пишешь билет.
                  </p>
                  <Link to={base} className="widget-link">
                    Все конспекты курса
                    <ArrowRight size={14} />
                  </Link>
                </div>
                <ExamParticipantsPanel exam={exam} onChanged={refetchExam} />
                {readyCount > 0 && (
                  <div className="widget">
                    <div className="widget-head">
                      <h3 className="widget-title">Шпаргалка</h3>
                    </div>
                    <Link to={`${base}/exam/cheatsheet`} className="widget-link">
                      <FileText size={14} />
                      Читать готовые билеты
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </SemesterGate>
  );
}

export default ExamHubPage;
