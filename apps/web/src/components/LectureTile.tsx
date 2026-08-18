/**
 * ============================================
 *  LectureTile.tsx
 * ============================================
 *
 * Card for a single lecture inside a course
 * grid.  Shows initials badge, title, content
 * excerpt, creation date, and a kebab menu
 * for edit/delete actions.
 */

import { formatDate, tileAccent } from "../lib/format";
import type { Course, Lecture } from "../lib/types";
import { lectureTitle, lectureExcerpt, courseName } from "../lib/types";
import KebabMenu from "./KebabMenu";
import { Edit, Trash2, BookOpen } from "lucide-react";

interface Props {
  /** The lecture record from PocketBase. */
  lecture: Lecture;
  /** Zero-based index in the grid (drives color accent + width). */
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
  /** Course name tag shown in the bottom-left corner (assigned lectures). */
  courseTag?: string;
  /** Course color used for the tag background (assigned lectures). */
  courseColorTag?: string;
}

/**
 * Renders a lecture card.
 *
 * @param Props.lecture  — lecture data to display
 * @param Props.index    — used to pick accent color and wide variant
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
  const accent = tileAccent(index);

  const content = lectureExcerpt(lecture);
  const hasAssign = unassigned && !!courses && courses.length > 0;

  const kebabActions = [
    {
      key: "edit",
      label: "Редактировать",
      icon: <Edit size={14} />,
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        onEdit?.(lecture);
      },
    },
    {
      key: "delete",
      label: "Удалить",
      icon: <Trash2 size={14} />,
      danger: true,
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete?.(lecture);
      },
    },
  ];

  return (
    <div className={`tile ${index === 0 ? "wide" : ""}`}>
      <button className="tile-click" onClick={onClick} type="button">
        <div className={`tile-feature ${accent}`}>
          {lectureTitle(lecture).slice(0, 2).toUpperCase()}
        </div>
        <div className="tile-body">
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
        <div
          className="tile-assign"
          onClick={(e) => e.stopPropagation()}
        >
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

      {courseTag && (
        <span
          className="lecture-course-tag"
          style={courseColorTag ? { background: courseColorTag } : undefined}
        >
          {courseTag}
        </span>
      )}
    </div>
  );
}

export default LectureTile;