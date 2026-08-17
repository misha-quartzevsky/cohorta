/**
 * ============================================
 *  AddTile.tsx
 * ============================================
 *
 * The dashed «+» tile shown at the bottom of
 * every bento grid.  Clicking it opens an inline
 * editor (passed as `children`) or triggers
 * `onClick` if `children` is not provided.
 */

import { Plus } from "lucide-react";

interface Props {
  /** Label text shown under the plus icon. */
  label: string;
  /** Click handler for the default (non-editing) state. */
  onClick: () => void;
}

/**
 * Renders a dashed plus-tile that the user clicks
 * to enter "creation mode".
 *
 * @param Props.label   — descriptive text (e.g. "+ Добавить курс")
 * @param Props.onClick — opens the inline editor
 */
function AddTile({ label, onClick }: Props) {
  return (
    <button className="add-tile" onClick={onClick} type="button">
      <Plus className="plus-icon" />
      <span>{label}</span>
    </button>
  );
}

export default AddTile;