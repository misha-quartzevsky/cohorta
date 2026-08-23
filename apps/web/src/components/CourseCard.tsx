/**
 * ============================================
 *  CourseCard.tsx — сигнатурная карточка курса (DESIGN.md §5)
 * ============================================
 *
 * Двухслойная карточка: внешний слой — градиентная рамка 3px из курируемой
 * палитры, внутренний — белая поверхность. Цвет живёт ТОЛЬКО в рамке и в
 * бейдже 26×26; никаких цветных плашек-баннеров (§0).
 *
 * Один компонент на все экраны: дашборд, «Все курсы», список лекций курса.
 */

import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Course } from "../lib/types";
import { courseColor, courseName } from "../lib/types";
import { courseGradient } from "../lib/courseGradient";

interface Props {
  course: Course;
  /** Позиция в сетке — задаёт градиент, если у курса не сохранён цвет. */
  index?: number;
  /** Подпись под названием: последняя лекция или «Лекций пока нет». */
  meta?: string;
  /** Ссылка-цель. Взаимоисключима с `onClick`. */
  to?: string;
  /** Обработчик клика (когда карточка не ссылка). */
  onClick?: () => void;
  /** Кебаб-меню и прочие действия — рендерятся поверх карточки. */
  actions?: ReactNode;
}

export default function CourseCard({
  course,
  index = 0,
  meta,
  to,
  onClick,
  actions,
}: Props) {
  const gradient = courseGradient(courseColor(course), index);
  const style = { "--course-card-grad": gradient } as CSSProperties;

  const inner = (
    <span className="course-card-inner">
      <span className="course-card-badge" style={{ background: gradient }} />
      <span className="course-card-name">{courseName(course)}</span>
      {meta && (
        <span className="course-card-meta" title={meta}>
          {meta}
        </span>
      )}
    </span>
  );

  return (
    <div className="course-card-slot">
      {to ? (
        <Link to={to} className="course-card" style={style}>
          {inner}
        </Link>
      ) : (
        <button
          type="button"
          className="course-card"
          style={style}
          onClick={onClick}
        >
          {inner}
        </button>
      )}
      {actions}
    </div>
  );
}
