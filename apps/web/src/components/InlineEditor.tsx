/**
 * ============================================
 *  InlineEditor.tsx
 * ============================================
 *
 * Minimal inline form that replaces the AddTile
 * when the user is creating a new course.
 *
 * Layout is VERTICAL: the input field takes full
 * width, and the Save/Cancel buttons sit below it.
 */

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
}

/**
 * Renders an inline form for creating a new item
 * (used for courses).  When `color`, `onColorChange`
 * and `colors` are provided, a row of color swatches
 * is shown to pick the course color.
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
}: Props) {
  const showColors = !!color && !!onColorChange && !!colors && colors.length > 0;

  return (
    <div className="inline-editor">
      <input
        className="field"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus
      />

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