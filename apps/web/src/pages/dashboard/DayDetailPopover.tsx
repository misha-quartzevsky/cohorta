/**
 * ============================================
 *  DayDetailPopover.tsx — разбор дня из «Эта неделя»
 * ============================================
 *
 * Design Sprint, Концепция A (доработка по фидбэку): клик по дню в
 * StudyWeekStrip открывает этот попап — какие курсы обновлялись в этот
 * день (сгруппированные лекции со ссылками) и отдельной строкой правки
 * колод (у колод в модели нет курса, группировать их некуда).
 *
 * Тот же паттерн портала, что в components/KebabMenu.tsx: createPortal в
 * document.body, position: fixed из getBoundingClientRect() кнопки-триггера,
 * закрытие по клику вне/скроллу/резайзу — не изобретаем новый механизм.
 */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import type { Lecture } from "../../lib/types";
import {
  courseColor,
  courseName,
  lectureCourseId,
  lectureHref,
  lectureTitle,
} from "../../lib/types";
import { courseAccent } from "../../lib/courseGradient";
import { pluralRu } from "../../lib/format";

interface Props {
  date: Date;
  lectures: Lecture[];
  deckCount: number;
  semesterSlug: string;
  anchorRect: DOMRect;
  onClose: () => void;
}

interface CourseGroup {
  courseId: string;
  name: string;
  color?: string;
  items: Lecture[];
}

/** Группирует лекции дня по курсу; непривязанные — в бакет «Без курса». */
function groupByCourse(lectures: Lecture[]): CourseGroup[] {
  const order: string[] = [];
  const groups = new Map<string, CourseGroup>();

  for (const lec of lectures) {
    const courseId = lectureCourseId(lec);
    const course = courseId ? lec.expand?.field : undefined;
    const key = course ? courseId : "__unassigned__";

    let group = groups.get(key);
    if (!group) {
      group = {
        courseId: key,
        name: course ? courseName(course) : "Без курса",
        color: course ? courseColor(course) : undefined,
        items: [],
      };
      groups.set(key, group);
      order.push(key);
    }
    group.items.push(lec);
  }

  return order.map((key) => groups.get(key)!);
}

export default function DayDetailPopover({
  date,
  lectures,
  deckCount,
  semesterSlug,
  anchorRect,
  onClose,
}: Props) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (popoverRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    // capture + небольшая задержка нулевого тика не нужны: сам клик по
    // ячейке, открывающий попап, происходит ДО подписки этого эффекта.
    document.addEventListener("mousedown", onOutside);
    const close = () => onClose();
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [onClose]);

  const groups = groupByCourse(lectures);
  const isEmpty = groups.length === 0 && deckCount === 0;

  const dateLabel = date.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return createPortal(
    <div
      ref={popoverRef}
      className="day-popover"
      style={{ top: anchorRect.bottom + 6, left: anchorRect.left }}
    >
      <div className="day-popover-date">{dateLabel}</div>

      {isEmpty && (
        <p className="day-popover-empty">В этот день записей не было.</p>
      )}

      {groups.map((group) => (
        <div className="day-popover-course-group" key={group.courseId}>
          <div className="day-popover-course-head">
            <span
              className="day-popover-course-dot"
              style={{
                background: group.color
                  ? courseAccent(group.color)
                  : "var(--border-strong)",
              }}
            />
            <span className="day-popover-course-name">{group.name}</span>
          </div>
          {group.items.map((lec) => (
            <Link
              key={lec.id}
              to={lectureHref(lec, semesterSlug)}
              className="day-popover-lecture-link"
              onClick={onClose}
            >
              {lectureTitle(lec)}
            </Link>
          ))}
        </div>
      ))}

      {deckCount > 0 && (
        <div className="day-popover-deck-line">
          +{deckCount} {pluralRu(deckCount, ["правка", "правки", "правок"])} в
          колодах
        </div>
      )}
    </div>,
    document.body
  );
}
