/**
 * ============================================
 *  CoursesWidget.tsx — «Курсы семестра»
 * ============================================
 *
 * Адаптирована под remote `useCourses`: вместо `counts` (кол-во лекций)
 * принимает `featured` — карта «id курса → название последней лекции»,
 * и показывает её как подпись карточки («Последняя лекция: …»).
 */

import { Link } from "react-router-dom";
import type { Course } from "../../lib/types";
import { courseColor, courseName, courseSlug } from "../../lib/types";

interface Props {
  courses: Course[];
  /** Course id → название последней лекции. */
  featured: Record<string, string>;
  /** Слаг семестра — для построения путей. */
  semesterSlug: string;
}

export default function CoursesWidget({ courses, featured, semesterSlug }: Props) {
  if (courses.length === 0) {
    return (
      <div className="widget courses-widget">
        <h3 className="widget-title">Курсы семестра</h3>
        <p className="widget-empty">В этом семестре пока нет курсов.</p>
      </div>
    );
  }
  return (
    <div className="widget courses-widget">
      <h3 className="widget-title">Курсы семестра</h3>
      <div className="widget-courses-grid">
        {courses.map((c) => {
          const latest = featured[c.id];
          return (
            <Link
              key={c.id}
              to={`/s/${semesterSlug}/${courseSlug(c)}`}
              className="course-mini-card"
            >
              <span
                className="course-mini-color"
                style={{ background: courseColor(c) || "#5843f6" }}
              />
              <span className="course-mini-name">{courseName(c)}</span>
              <span className="course-mini-count" title={latest ? `Последняя лекция: ${latest}` : undefined}>
                {latest ? `Последняя лекция: ${latest}` : "Пока без лекций"}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
