/**
 * ============================================
 *  CoursesWidget.tsx — курсы семестра
 * ============================================
 *  Сетка карточек по общему паттерну DESIGN.md §5 (компонент `CourseCard`):
 *  цвет живёт только в градиентной рамке и бейдже. Ссылка «Все курсы»
 *  закрывает тупик — из виджета видно не больше четырёх курсов.
 */

import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { Course } from "../../lib/types";
import { courseSlug } from "../../lib/types";
import CourseCard from "../../components/CourseCard";

interface Props {
  courses: Course[];
  featured: Record<string, string>;
  semesterSlug: string;
  /** Сколько курсов в семестре всего — для подписи ссылки «Все курсы». */
  total?: number;
}

export default function CoursesWidget({
  courses,
  featured,
  semesterSlug,
  total,
}: Props) {
  const allCoursesLink = (
    <Link to={`/s/${semesterSlug}/courses`} className="widget-link">
      Все курсы
      {typeof total === "number" && total > courses.length ? ` (${total})` : ""}
      <ArrowRight size={14} />
    </Link>
  );

  if (courses.length === 0) {
    return (
      <div className="widget courses-widget">
        <div className="widget-head">
          <h3 className="widget-title">Курсы семестра</h3>
        </div>
        <p className="widget-empty">Добавь первый курс семестра.</p>
      </div>
    );
  }

  return (
    <div className="widget courses-widget">
      <div className="widget-head">
        <h3 className="widget-title">Курсы семестра</h3>
        {allCoursesLink}
      </div>
      <div className="widget-courses-grid">
        {courses.map((c, i) => (
          <CourseCard
            key={c.id}
            course={c}
            index={i}
            meta={
              featured[c.id]
                ? `Последняя лекция: ${featured[c.id]}`
                : "Лекций пока нет"
            }
            to={`/s/${semesterSlug}/${courseSlug(c)}`}
          />
        ))}
      </div>
    </div>
  );
}
