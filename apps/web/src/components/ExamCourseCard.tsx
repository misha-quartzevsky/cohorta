/**
 * ============================================
 *  ExamCourseCard.tsx — карточка курса на экране «Все экзамены»
 * ============================================
 *
 * Тот же визуальный язык §5 DESIGN.md, что у `CourseCard` (двухслойная
 * карточка, градиентная рамка курса, бейдж 26×26) — переиспользует те
 * же CSS-классы `.course-card*`, а не копирует их. Не сам `CourseCard`:
 * там `meta` — плоская строка, а здесь нужен прогресс-бар и счётчик,
 * так что тело карточки построено отдельно.
 *
 * Два состояния: у курса есть экзамен (прогресс) или нет (приглашение
 * завести — тот же текст, что на `.exam-entry` на `LecturesPage`).
 */

import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import type { Course } from "../lib/types";
import { courseColor, courseName, courseSlug, examDaysLeft } from "../lib/types";
import type { ExamSummary } from "../hooks/useExam";
import { courseGradient } from "../lib/courseGradient";
import { pluralRu } from "../lib/format";

interface Props {
  course: Course;
  index?: number;
  summary?: ExamSummary;
  semesterSlug: string;
}

function daysLeftLabel(days: number): string {
  if (days < 0) return "Экзамен прошёл";
  if (days === 0) return "Сегодня";
  return `Через ${days} ${pluralRu(days, ["день", "дня", "дней"])}`;
}

export default function ExamCourseCard({
  course,
  index = 0,
  summary,
  semesterSlug,
}: Props) {
  const gradient = courseGradient(courseColor(course), index);
  const style = { "--course-card-grad": gradient } as CSSProperties;
  const cSlug = courseSlug(course);
  const to = summary
    ? `/s/${semesterSlug}/${cSlug}/exam`
    : `/s/${semesterSlug}/${cSlug}/exam/import`;

  const percent =
    summary && summary.total > 0
      ? Math.round((summary.ready / summary.total) * 100)
      : 0;
  const daysLeft = summary ? examDaysLeft(summary.exam) : null;

  return (
    <div className="course-card-slot">
      <Link to={to} className="course-card" style={style}>
        <span className="course-card-inner">
          <span className="course-card-badge" style={{ background: gradient }} />
          <span className="course-card-name">{courseName(course)}</span>
          {summary ? (
            <span className="exam-course-card-body">
              <span className="exam-progress-bar">
                <span
                  className="exam-progress-fill"
                  style={{ width: `${percent}%` }}
                />
              </span>
              <span className="exam-course-card-stats">
                <span>
                  {summary.ready} из {summary.total} готовы
                </span>
                {daysLeft !== null && <span>{daysLeftLabel(daysLeft)}</span>}
              </span>
            </span>
          ) : (
            <span className="exam-course-card-empty">
              Загрузи список билетов
            </span>
          )}
        </span>
      </Link>
    </div>
  );
}
