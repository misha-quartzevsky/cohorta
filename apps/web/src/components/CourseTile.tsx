/**
 * ============================================
 *  CourseTile.tsx
 * ============================================
 *
 * Single course card in the bento grid.
 * Shows a colored initials badge, the course
 * name, a subtitle with the last lecture, and
 * an optional kebab menu for edit/delete.
 */

import { tileAccent } from "../lib/format";
import type { Course } from "../lib/types";
import { courseName, courseColor } from "../lib/types";
import { tileActions } from "../lib/tileActions";
import KebabMenu from "./KebabMenu";

interface Props {
  /** The course record from PocketBase. */
  course: Course;
  /** Zero-based index in the grid (drives color accent). */
  index: number;
  /** Last lecture title (for the meta text), or undefined. */
  featured?: string;
  /** True → makes the tile span 2 columns. */
  wide?: boolean;
  /** Click handler (opens the course's lecture list). */
  onClick: () => void;
  /** Called when the user clicks "Edit". */
  onEdit?: (course: Course) => void;
  /** Called when the user clicks "Delete". */
  onDelete?: (course: Course) => void;
}

/**
 * Renders a course card.
 *
 * @param Props.course   — course data to display
 * @param Props.index   — position in grid (for accent color)
 * @param Props.featured — optional last-lecture title
 * @param Props.wide     — if true, tile spans 2 columns
 * @param Props.onClick  — opens the course view
 * @param Props.onEdit   — opens edit form
 * @param Props.onDelete — opens delete confirmation
 */
function CourseTile({
  course,
  index,
  featured,
  wide,
  onClick,
  onEdit,
  onDelete,
}: Props) {
  const accent = tileAccent(index);

  const metaText = featured
    ? `Последняя лекция: ${featured}`
    : "Лекций пока нет";

  const kebabActions = tileActions({
    onEdit: () => onEdit?.(course),
    onDelete: () => onDelete?.(course),
  });

  return (
    <div className={`tile ${wide ? "wide" : ""}`}>
      <button className="tile-click" onClick={onClick} type="button">
        <div
          className={`tile-feature ${accent}`}
          style={courseColor(course) ? { background: courseColor(course) } : undefined}
        >
          {featured ? null : courseName(course).slice(0, 2).toUpperCase()}
        </div>
        <div className="tile-body">
          <div className="tile-title">{courseName(course)}</div>
          <div className="tile-meta">{metaText}</div>
        </div>
      </button>
      <KebabMenu actions={kebabActions} />
    </div>
  );
}

export default CourseTile;