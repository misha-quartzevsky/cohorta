/**
 * ============================================
 *  CourseTile.tsx
 * ============================================
 *
 * Курс в сетке «Все курсы». Обёртка над общей `CourseCard`
 * (DESIGN.md §5) — добавляет кебаб-меню «Редактировать/Удалить».
 */

import type { Course } from "../lib/types";
import { tileActions } from "../lib/tileActions";
import KebabMenu from "./KebabMenu";
import CourseCard from "./CourseCard";

interface Props {
  /** The course record from PocketBase. */
  course: Course;
  /** Zero-based index in the grid (drives the curated gradient). */
  index: number;
  /** Last lecture title (for the meta text), or undefined. */
  featured?: string;
  /** Click handler (opens the course's lecture list). */
  onClick: () => void;
  /** Called when the user clicks "Edit". */
  onEdit?: (course: Course) => void;
  /** Called when the user clicks "Delete". */
  onDelete?: (course: Course) => void;
}

function CourseTile({
  course,
  index,
  featured,
  onClick,
  onEdit,
  onDelete,
}: Props) {
  const metaText = featured
    ? `Последняя лекция: ${featured}`
    : "Лекций пока нет";

  const kebabActions = tileActions({
    onEdit: () => onEdit?.(course),
    onDelete: () => onDelete?.(course),
  });

  return (
    <CourseCard
      course={course}
      index={index}
      meta={metaText}
      onClick={onClick}
      actions={<KebabMenu actions={kebabActions} />}
    />
  );
}

export default CourseTile;
