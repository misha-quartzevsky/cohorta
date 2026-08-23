/**
 * ============================================
 *  LectureTile.tsx
 * ============================================
 *
 * Карточка лекции в сетке курса. Нейтральная белая поверхность: заголовок,
 * превью, дата. Цветной плашки-баннера с инициалами больше нет (DESIGN.md §0),
 * а принадлежность курсу показывает бейдж по §6 — нейтральный фон плюс
 * маленькая точка цвета курса, без заливки всего бейджа.
 */

import { formatDate } from "../lib/format";
import type { Course, Lecture } from "../lib/types";
import { lectureTitle, lectureExcerpt, courseName } from "../lib/types";
import { courseAccent } from "../lib/courseGradient";
import { tileActions } from "../lib/tileActions";
import KebabMenu from "./KebabMenu";
import { BookOpen } from "lucide-react";

interface Props {
  /** The lecture record from PocketBase. */
  lecture: Lecture;
  /** Zero-based index in the grid (fallback for the course dot color). */
  index: number;
  /** Click handler (opens full lecture view). */
  onClick: () => void;
  /** Called when the user clicks "Edit". */
  onEdit?: (lecture: Lecture) => void;
  /** Called when the user clicks "Delete". */
  onDelete?: (lecture: Lecture) => void;
  /** True → shows an "unassigned" badge and an assign-to-course dropdown. */
  unassigned?: boolean;
  /** Courses for the assign dropdown (only used when `unassigned`). */
  courses?: Course[];
  /** Called when a course is chosen from the assign dropdown. */
  onAssignCourse?: (lecture: Lecture, courseId: string) => void;
  /** Course name tag shown above the title (assigned lectures). */
  courseTag?: string;
  /** Course color — drives the tag's dot (assigned lectures). */
  courseColorTag?: string;
}

/**
 * Renders a lecture card.
 *
 * @param Props.lecture  — lecture data to display
 * @param Props.index    — fallback index for the course dot color
 * @param Props.onClick  — opens the full lecture view
 * @param Props.onEdit   — opens edit form
 * @param Props.onDelete — opens delete confirmation
 */
function LectureTile({
  lecture,
  index,
  onClick,
  onEdit,
  onDelete,
  unassigned,
  courses,
  onAssignCourse,
  courseTag,
  courseColorTag,
}: Props) {
  const content = lectureExcerpt(lecture);
  const hasAssign = unassigned && !!courses && courses.length > 0;

  const kebabActions = tileActions({
    onEdit: () => onEdit?.(lecture),
    onDelete: () => onDelete?.(lecture),
  });

  return (
    <div className="tile lecture-tile">
      <button className="tile-click" onClick={onClick} type="button">
        <div className="tile-body">
          {courseTag && (
            <span className="lecture-course-tag">
              <span
                className="lecture-course-dot"
                style={{ background: courseAccent(courseColorTag, index) }}
              />
              {courseTag}
            </span>
          )}
          <div className="tile-title">{lectureTitle(lecture)}</div>
          {content && <div className="tile-excerpt">{content}</div>}
          <div className="tile-meta">{formatDate(lecture.created)}</div>
          {unassigned && (
            <div className="tile-meta tile-unassigned">
              <BookOpen size={12} /> Не привязана к курсу
            </div>
          )}
        </div>
      </button>

      {hasAssign && onAssignCourse && (
        <div className="tile-assign" onClick={(e) => e.stopPropagation()}>
          <span className="tile-assign-label">Привязать к курсу</span>
          <select
            className="note-assign-select"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                onAssignCourse(lecture, e.target.value);
              }
            }}
          >
            <option value="" disabled>
              Выбрать курс…
            </option>
            {courses!.map((c) => (
              <option key={c.id} value={c.id}>
                {courseName(c)}
              </option>
            ))}
          </select>
        </div>
      )}

      <KebabMenu actions={kebabActions} />
    </div>
  );
}

export default LectureTile;
