/**
 * ============================================
 *  PriorityHero.tsx — единственный «герой» дашборда
 * ============================================
 *
 * Design Sprint, Концепция A (Wednesday Decide): раньше «Продолжить»
 * (ResumeBlock) и «Ближайший экзамен» (ExamBlock) рендерились отдельно,
 * в разных секциях дашборда, с разным визуальным весом — экран не называл
 * одного явного приоритета. Теперь один слот с чёткой очередностью:
 *
 *   1. Экзамен с будущей датой — самое срочное, что есть в модели.
 *   2. Последняя открытая запись — самое частое действие (DESIGN.md §7.2).
 *   3. Пустое состояние — приглашение начать.
 *
 * Один и тот же .resume-block/.resume-empty визуальный язык для всех
 * трёх состояний — герой всегда выглядит как герой, что бы в нём ни было.
 */

import { Link } from "react-router-dom";
import { ArrowRight, GraduationCap, Play, Plus } from "lucide-react";
import type { Exam, ExamTicket } from "../../lib/types";
import {
  courseName,
  courseSlug,
  examTitle,
  examDaysLeft,
  ticketStatus,
} from "../../lib/types";
import { pluralRu } from "../../lib/format";
import type { LastVisitedEntry } from "../../lib/lastVisited";

interface Props {
  exam: Exam | null;
  tickets: ExamTicket[];
  semesterSlug: string;
  lastVisited: LastVisitedEntry | null;
}

export default function PriorityHero({
  exam,
  tickets,
  semesterSlug,
  lastVisited,
}: Props) {
  const daysLeft = exam ? examDaysLeft(exam) : null;
  const examUrgent = !!exam && daysLeft !== null && daysLeft >= 0;

  // --- 1. Экзамен на подходе ---
  if (examUrgent && exam) {
    const course = exam.expand?.course;
    const readyCount = tickets.filter((t) => ticketStatus(t) === "ready").length;
    const cSlug = course ? courseSlug(course) : "";
    const examLink = `/s/${semesterSlug}/${cSlug}/exam`;

    return (
      <section className="resume-block">
        <div className="resume-icon">
          <GraduationCap size={20} />
        </div>
        <div className="resume-info">
          <span className="resume-label">
            {daysLeft === 0
              ? "Экзамен сегодня"
              : `Экзамен через ${daysLeft} ${pluralRu(daysLeft!, [
                  "день",
                  "дня",
                  "дней",
                ])}`}
            {course ? ` · ${courseName(course)}` : ""}
          </span>
          <Link to={examLink} className="resume-title">
            {examTitle(exam)}
          </Link>
        </div>
        <Link to={examLink} className="resume-cta">
          {readyCount} из {tickets.length} готовы
          <ArrowRight size={14} />
        </Link>
      </section>
    );
  }

  // --- 2. Продолжить последнюю запись ---
  if (lastVisited) {
    return (
      <section className="resume-block">
        <div className="resume-icon">
          <Play size={20} />
        </div>
        <div className="resume-info">
          <span className="resume-label">
            Продолжить
            {lastVisited.courseName ? ` · ${lastVisited.courseName}` : ""}
          </span>
          <Link to={lastVisited.to} className="resume-title">
            {lastVisited.title}
          </Link>
        </div>
        <Link to={lastVisited.to} className="resume-cta" aria-label="Открыть">
          Открыть
          <ArrowRight size={14} />
        </Link>
      </section>
    );
  }

  // --- 3. Пустое состояние ---
  return (
    <section className="resume-block resume-empty">
      <div className="resume-icon">
        <Plus size={20} />
      </div>
      <div className="resume-info">
        <span className="resume-label">С чего начнём</span>
        <span className="resume-title">
          Создай первую заметку — она откроется здесь одним кликом
        </span>
      </div>
    </section>
  );
}
