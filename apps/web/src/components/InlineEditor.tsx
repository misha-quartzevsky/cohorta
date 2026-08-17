/**
 * ============================================
 *  InlineEditor.tsx
 * ============================================
 *
 * Minimal inline form that replaces the AddTile
 * when the user is creating/editing a course.
 *
 * Layout is VERTICAL: the input field takes full
 * width, and the Save/Cancel buttons sit below it.
 *
 * Optionally renders a semester dropdown used to
 * assign/move a course between semesters.
 */

import type { Semester } from "../lib/types";
import { semesterSlug } from "../lib/types";

interface Props {
  /** Current value of the input field. */
  value: string;
  /** Called when the input text changes. */
  onChange: (v: string) => void;
  /** Called when the user clicks «Сохранить». */
  onSave: () => void;
  /** Called when the user clicks «Отмена». */
  onCancel: () => void;
  /** Placeholder text for the input. */
  placeholder?: string;
  /** Optional selected color (HEX) for the color picker row. */
  color?: string;
  /** Called when a color swatch is picked. */
  onColorChange?: (color: string) => void;
  /** Palette of HEX colors to show. */
  colors?: string[];
  /** Semester list for the dropdown (optional feature). */
  semesters?: Semester[];
  /** Currently selected semester id ("" = none). */
  semesterValue?: string;
  /** Called when the semester dropdown changes. */
  onSemesterChange?: (semesterId: string) => void;
}

/**
 * Renders an inline form for creating/editing a course.
 * When `color`, `onColorChange` and `colors` are provided,
 * a row of color swatches is shown.  When `semesters` is
 * provided, a semester dropdown appears below the input.
 */
function InlineEditor({
  value,
  onChange,
  onSave,
  onCancel,
  placeholder = "Название курса (например, «Философия»)",
  color,
  onColorChange,
  colors,
  semesters,
  semesterValue,
  onSemesterChange,
}: Props) {
  const showColors = !!color && !!onColorChange && !!colors && colors.length > 0;
  const showSemesters =
    !!semesters && semesters.length > 0 && !!onSemesterChange;

  return (
    <div className="inline-editor">
      <input
        className="field"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus
      />

      {showSemesters && (
        <select
          className="semester-select"
          value={semesterValue ?? ""}
          onChange={(e) => onSemesterChange!(e.target.value)}
        >
          <option value="">Без семестра</option>
          {semesters!.map((s) => (
            <option key={s.id} value={s.id}>
              Семестр {semesterSlug(s)}
            </option>
          ))}
        </select>
      )}

      {showColors && (
        <div className="color-picker">
          {colors!.map((c) => (
            <button
              key={c}
              type="button"
              className={`color-swatch ${c === color ? "selected" : ""}`}
              style={{ background: c }}
              aria-label={`Цвет ${c}`}
              onClick={() => onColorChange!(c)}
            />
          ))}
        </div>
      )}

      <div className="actions-row">
        <button className="btn btn-primary" onClick={onSave}>
          Сохранить
        </button>
        <button className="btn btn-outline" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </div>
  );
}

export default InlineEditor;
