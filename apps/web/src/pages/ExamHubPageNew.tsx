/**
 * ============================================
 *  ExamHubPageNew.tsx — «Экзамен» (B4, 2026-10-20)
 * ============================================
 *
 * Вёрстка 1:1 по docs/design/screens/Screen-exam(-m).dc.html.
 * Экзамен соло: карта билетов, список, «Продолжить», шпаргалка.
 * Group Mode (ExamParticipantsPanel) в новом макете не показан —
 * это волна C, здесь экран сделан только под «Экзамен соло».
 *
 * Данные и сервисы без изменений (useExam/examService из старого
 * ExamHubPage) — меняется только вёрстка и подключение «Добавить билет»
 * как отдельного модального действия (Screen-m-exam.dc.html: у «Добавить
 * билет» и «Импорт» разные кнопки, значит разные флоу — см. decisions.md).
 *
 * За флагом VITE_NEW_UI — подключена в App.tsx вместо ExamHubPage.tsx.
 */

import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Button, Icon, StatusChip, Toggletip, EmptyState, SubjectTabs } from "../ui";
import AddTicketModal from "../components/exam/AddTicketModal";
import { useForms } from "../lib/formsContext";
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
  ticketSourceIds,
} from "../lib/types";
import type { TicketStatus } from "../lib/types";
import { pluralRu } from "../lib/format";
import { useUndo } from "../lib/undoContext";
import { createExam, createTicket } from "../services/examService";

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
/** Модификатор класса для .c-exam-chip/.c-exam-legend-swatch — не берём
 * статус "empty" как есть: App.css уже определяет глобальный класс
 * `.empty` (пустые состояния старых экранов), он бы перебил наш 44×44. */
const STATUS_CSS: Record<TicketStatus, string> = {
  ready: "ready",
  draft: "draft",
  empty: "todo",
};

export default function ExamHubPageNew() {
  const navigate = useNavigate();
  const { courseSlug: courseSlugParam } = useParams();
  const { current } = useSemester();
  const semSlug = current ? semesterSlug(current) : "";
  const base = `/s/${semSlug}/${courseSlugParam}`;

  const { course } = useCourseBySlug(courseSlugParam ?? "");
  const { exam, tickets: allTickets, refetch } = useExam(course?.id ?? "", !!course);

  const { isPending } = useUndo();
  const tickets = allTickets.filter((t) => !isPending(`ticket:${t.id}`));

  const forms = useForms();
  const [addOpen, setAddOpen] = useState(false);

  const readyCount = tickets.filter((t) => ticketStatus(t) === "ready").length;
  const total = tickets.length;
  const percent = total > 0 ? Math.round((readyCount / total) * 100) : 0;
  const daysLeft = exam ? examDaysLeft(exam) : null;
  const nextToFill = tickets.find((t) => ticketStatus(t) !== "ready");
  const maxNumber = tickets.reduce((m, t) => Math.max(m, ticketNumber(t)), 0);

  function ticketHref(n: number, status: TicketStatus) {
    return status === "ready" ? `${base}/exam/${n}` : `${base}/exam/${n}/edit`;
  }

  async function handleCreateTicket(question: string, answer: string) {
    const target = exam ?? (await createExam({ courseId: course?.id ?? "" }));
    await createTicket(target.id, { number: maxNumber + 1, question, answer });
    await refetch();
  }

  if (!exam) {
    return (
      <div className="c-exam">
        <div className="c-exam-crumb">
          <Link to={base}>{course ? courseName(course) : ""}</Link>
          <Icon name="chev" size={14} />
          <span className="current">Экзамен</span>
        </div>
        <div className="c-exam-head">
          <div className="c-exam-head-tx">
            <h1>Экзамен · {course ? courseName(course) : ""}</h1>
          </div>
        </div>
        <div className="c-exam-tabs-d">
          <SubjectTabs base={base} courseId={course?.id} active="exam" />
        </div>
        <div className="c-exam-m-crumb">
          <Link to={base}>
            <Icon name="chev" size={18} style={{ transform: "scaleX(-1)" }} />
            Предмет
          </Link>
        </div>
        <div className="c-exam-m-head">
          <h1>Экзамен</h1>
          <span className="meta">{course ? courseName(course) : ""}</span>
          <SubjectTabs base={base} courseId={course?.id} active="exam" />
        </div>
        <EmptyState
          icon="exam"
          title="Экзамена пока нет"
          description="Создай экзамен, и здесь появятся билеты, карта готовности и шпаргалка."
          action={
            <Button
              variant="primary"
              onClick={() => (forms ? forms.openExamForm(course?.id) : navigate(`${base}/exam/import`))}
            >
              Создать экзамен
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="c-exam">
      {/* Десктоп */}
      <div className="c-exam-crumb">
        <Link to={base}>{course ? courseName(course) : ""}</Link>
        <Icon name="chev" size={14} />
        <span className="current">Экзамен</span>
      </div>
      <div className="c-exam-head">
        <div className="c-exam-head-tx">
          <h1>
            {examTitle(exam)} · {course ? courseName(course) : ""}
          </h1>
          <span>
            {daysLeft === null
              ? "Дата экзамена не задана"
              : daysLeft > 0
                ? `через ${daysLeft} ${pluralRu(daysLeft, ["день", "дня", "дней"])}`
                : daysLeft === 0
                  ? "экзамен сегодня"
                  : "экзамен уже прошёл"}
          </span>
        </div>
        <div className="c-exam-head-side">
          <div className="c-exam-readiness">
            <div className="row">
              <span>Готовность к экзамену</span>
              <b>{percent}%</b>
            </div>
            <div className="c-progress">
              <div className="c-progress-fill" style={{ width: `${percent}%` }} />
            </div>
            <span className="meta">
              {readyCount} из {total} билетов готовы
            </span>
          </div>
          <Toggletip>
            Готовность к экзамену — это доля билетов со статусом «Готов». Билет
            становится готовым, когда ты сам отмечаешь его готовым — одного
            текста ответа недостаточно.
          </Toggletip>
        </div>
      </div>

      <div className="c-exam-tabs-d">
        <SubjectTabs base={base} courseId={course?.id} active="exam" />
      </div>

      {/* Телефон */}
      <div className="c-exam-m-crumb">
        <Link to={base}>
          <Icon name="chev" size={18} style={{ transform: "scaleX(-1)" }} />
          Предмет
        </Link>
      </div>
      <div className="c-exam-m-head">
        <h1>Экзамен</h1>
        <span className="meta">
          {course ? courseName(course) : ""}
        </span>
        <SubjectTabs base={base} courseId={course?.id} active="exam" />
        <div className="c-exam-m-readiness">
          <div className="row">
            <span>Готовность к экзамену</span>
            <b>{percent}%</b>
          </div>
          <div className="c-progress" style={{ marginTop: 10 }}>
            <div className="c-progress-fill" style={{ width: `${percent}%` }} />
          </div>
          <span className="meta">
            {readyCount} из {total} билетов готовы
            {daysLeft !== null && daysLeft > 0 ? ` · осталось ${daysLeft} ${pluralRu(daysLeft, ["день", "дня", "дней"])}` : ""}
          </span>
        </div>
      </div>
      <div className="c-exam-m-actions">
        <Button variant="primary" onClick={() => setAddOpen(true)}>
          <Icon name="plus" size={18} />
          Добавить билет
        </Button>
        <Button variant="secondary" onClick={() => navigate(`${base}/exam/import`)}>
          Импорт
        </Button>
      </div>

      {nextToFill && (
        <div className="c-exam-card c-exam-continue">
          <span className="ico">
            <Icon name="edit" size={18} />
          </span>
          <div className="tx">
            <span className="label">Продолжить</span>
            <span className="t">
              Билет {ticketNumber(nextToFill)} · {ticketQuestion(nextToFill)}
            </span>
          </div>
          <Button
            variant="primary"
            onClick={() => navigate(ticketHref(ticketNumber(nextToFill), ticketStatus(nextToFill)))}
          >
            Открыть билет
          </Button>
        </div>
      )}

      <div className="c-exam-card c-exam-map-card">
        <div className="c-exam-map-head">
          <div>
            <h2>Карта билетов</h2>
            <span className="meta">
              {total} {pluralRu(total, ["билет", "билета", "билетов"])}
            </span>
          </div>
          <div className="c-exam-legend">
            <span className="c-exam-legend-item">
              <span className="c-exam-legend-swatch ready" />
              Готов
            </span>
            <span className="c-exam-legend-item">
              <span className="c-exam-legend-swatch draft" />
              В работе
            </span>
            <span className="c-exam-legend-item">
              <span className="c-exam-legend-swatch todo" />
              Не начат
            </span>
          </div>
        </div>
        <div className="c-exam-map-grid">
          {tickets.map((t) => {
            const status = ticketStatus(t);
            const n = ticketNumber(t);
            return (
              <Link key={t.id} to={ticketHref(n, status)} className={`c-exam-chip ${STATUS_CSS[status]}`}>
                {n}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="c-exam-card c-exam-tickets-card">
        <div className="c-exam-card-head">
          <h2>Билеты</h2>
          <div className="actions">
            <Button variant="ghost" onClick={() => navigate(base)}>
              Конспекты предмета
            </Button>
            <Button variant="ghost" onClick={() => navigate(`${base}/exam/cheatsheet`)}>
              Шпаргалка
            </Button>
            <Button variant="secondary" onClick={() => setAddOpen(true)}>
              <Icon name="plus" size={18} />
              Добавить билет
            </Button>
          </div>
        </div>
        <div>
          {tickets.map((t) => {
            const status = ticketStatus(t);
            const n = ticketNumber(t);
            const sourceCount = ticketSourceIds(t).length;
            return (
              <Link key={t.id} to={ticketHref(n, status)} className="c-exam-ticket-row">
                <span className="c-exam-ticket-num">{n}</span>
                <span className="c-exam-ticket-tx">
                  <span className="t">{ticketQuestion(t)}</span>
                  {sourceCount > 0 ? (
                    <span className="m">
                      <Icon name="link" size={13} />
                      {sourceCount} {pluralRu(sourceCount, ["лекция", "лекции", "лекций"])}
                    </span>
                  ) : (
                    <span className="m">Без привязки к лекциям</span>
                  )}
                </span>
                <StatusChip tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</StatusChip>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="c-exam-m-list">
        {tickets.map((t) => {
          const status = ticketStatus(t);
          const n = ticketNumber(t);
          return (
            <Link key={t.id} to={ticketHref(n, status)} className="c-exam-m-row">
              <span className="num">{n}</span>
              <span className="t">{ticketQuestion(t)}</span>
              <StatusChip tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</StatusChip>
            </Link>
          );
        })}
      </div>

      <AddTicketModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={handleCreateTicket}
        onImportList={() => navigate(`${base}/exam/import`)}
      />
    </div>
  );
}
