/**
 * ============================================
 *  tileActions.tsx — shared kebab-menu actions
 * ============================================
 *
 * Unified edit/delete actions for course and lecture
 * tiles, so the per-tile components no longer build the
 * same menu objects inline.
 */

import { Edit, Trash2 } from "lucide-react";
import type { KebabAction } from "../components/KebabMenu";

interface TileActionsOptions {
  /** Called (after stopPropagation) when the user clicks «Редактировать». */
  onEdit?: () => void;
  /** Called (after stopPropagation) when the user clicks «Удалить». */
  onDelete?: () => void;
}

/**
 * Builds the standard «Редактировать» / «Удалить» kebab actions.
 * Omitted callbacks are simply not included in the menu.
 *
 * @param opts.onEdit   — edit handler (optional)
 * @param opts.onDelete — delete handler (optional)
 * @returns an array of KebabAction objects for <KebabMenu>.
 */
export function tileActions({
  onEdit,
  onDelete,
}: TileActionsOptions): KebabAction[] {
  const actions: KebabAction[] = [];

  if (onEdit) {
    actions.push({
      key: "edit",
      label: "Редактировать",
      icon: <Edit size={14} />,
      onClick: (e) => {
        e.stopPropagation();
        onEdit();
      },
    });
  }

  if (onDelete) {
    actions.push({
      key: "delete",
      label: "Удалить",
      icon: <Trash2 size={14} />,
      danger: true,
      onClick: (e) => {
        e.stopPropagation();
        onDelete();
      },
    });
  }

  return actions;
}

export default tileActions;
