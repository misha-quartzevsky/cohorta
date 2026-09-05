/**
 * ============================================
 *  CoursesWidget.tsx — курсы семестра
 * ============================================
 *  Список строк вместо плоской сетки карточек: бейдж курса + название +
 *  реальное число лекций + сегментированная полоска недавней активности
 *  (заполненный сегмент = лекция правилась за последние ACTIVE_WINDOW_DAYS,
 *  см. useCourseProgress). Никакого «прогресса завершения» — такой отметки
 *  в модели нет, и рисовать её было бы той же фикцией, что уже убирали
 *  из hero-баннера «Продолжить».
 */

import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { Course } from "../../lib/types";
import { courseColor, courseName, courseSlug } from "../../lib/types";
import { courseGradient } from "../../lib/courseGradient";
import { ACTIVE_WINDOW_DAYS, useCourseProgress } from "../../hooks/useCourseProgress";
import { pluralRu } from "../../lib/format";

interface Props {
  courses: Course[];
  semesterSlug: string;
  /** Сколько курсов в семестре всего — для подписи ссылки «Все курсы». */
  total?: number;
}

/** Максимум сегментов в полоске — дальше рост не читается глазом. */
const MAX_SEGMENTS = 8;

export default function CoursesWidget({ courses, semesterSlug, total }: Props) {
  const progress = useCourseProgress(courses.map((c) => c.id));

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
      <ul className="course-progress-list">
        {courses.map((c, i) => {
          const gradient = courseGradient(courseColor(c), i);
          const p = progress[c.id];
          const count = p?.count ?? 0;
          const recent = Math.min(p?.recentCount ?? 0, MAX_SEGMENTS);
          const segments = Math.min(Math.max(count, 1), MAX_SEGMENTS);
          return (
            <li key={c.id}>
              <Link
                to={`/s/${semesterSlug}/${courseSlug(c)}`}
                className="course-row"
              >
                <span
                  className="course-row-badge"
                  style={{ background: gradient }}
                />
                <span className="course-row-body">
                  <span className="course-row-name">{courseName(c)}</span>
                  <span className="course-row-meta">
                    {count === 0
                      ? "Лекций пока нет"
                      : `${count} ${pluralRu(count, [
                          "лекция",
                          "лекции",
                          "лекций",
                        ])}`}
                  </span>
                </span>
                {count > 0 && (
                  <span
                    className="course-row-bar"
                    aria-hidden="true"
                    title={
                      recent > 0
                        ? `Правки за последние ${ACTIVE_WINDOW_DAYS} дней`
                        : undefined
                    }
                  >
                    {Array.from({ length: segments }).map((_, seg) => (
                      <span
                        key={seg}
                        className={
                          "course-row-seg" + (seg < recent ? " filled" : "")
                        }
                        style={
                          seg < recent
                            ? { background: gradient }
                            : undefined
                        }
                      />
                    ))}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
