/**
 * ============================================
 *  pages/dashboard/CoursesSection.tsx — «Курсы»
 * ============================================
 *
 * Presentational section of the dashboard showing the top-3 courses of the
 * semester (by most recent update) plus the «create course» slot. All data
 * and handlers come from the parent page through props.
 */

import type { Course, Semester } from "../../lib/types";
import type { UseCourseFormResult } from "../../hooks/useCourseForm";
import CourseTile from "../../components/CourseTile";
import {
  CourseCreateSlot,
  CourseEditSlot,
} from "../../components/CourseFormTile";

interface Props {
  courses: Course[];
  /** Course id → latest-lecture title (shown in the tiles). */
  featured: Record<string, string>;
  form: UseCourseFormResult;
  semesters: Semester[];
  onOpenAll: () => void;
  onOpenCourse: (course: Course) => void;
  onDeleteCourse: (course: Course) => void;
}

export default function CoursesSection({
  courses,
  featured,
  form,
  semesters,
  onOpenAll,
  onOpenCourse,
  onDeleteCourse,
}: Props) {
  return (
    <section className="dashboard-section">
      <div className="section-head">
        <h2 className="section-title">Курсы</h2>
        <button className="btn btn-ghost" type="button" onClick={onOpenAll}>
          Все курсы →
        </button>
      </div>

      {courses.length === 0 && (
        <div className="empty">
          Пока нет курсов в этом семестре — добавьте первый!
        </div>
      )}

      <div className="bento">
        {courses.map((course, i) => (
          <CourseEditSlot
            key={`edit-${course.id}`}
            course={course}
            form={form}
            semesters={semesters}
            fallback={
              <CourseTile
                course={course}
                index={i}
                featured={featured[course.id]}
                wide={i === 0}
                onClick={() => onOpenCourse(course)}
                onEdit={form.startEdit}
                onDelete={onDeleteCourse}
              />
            }
          />
        ))}

        <CourseCreateSlot form={form} semesters={semesters} />
      </div>
    </section>
  );
}
