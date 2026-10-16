import { resolvePalette, paletteGradient } from "../../lib/subjectPalette";

type Size = 16 | 20 | 22 | 40 | 72;

interface Props {
  subjectId: string;
  /** Сохранённый ключ палитры (course.color), если есть. */
  paletteKey?: string | null;
  /** Квадрат заданного размера, либо широкая полоса. */
  size?: Size;
  wide?: boolean;
  height?: number;
  className?: string;
}

/**
 * Обложка предмета (spec 1A.6). Единственное место градиента в продукте.
 * Градиент есть = конспект создан; отсутствие — отдельное состояние на
 * вызывающей стороне (карточка без обложки).
 */
export default function SubjectCover({
  subjectId,
  paletteKey,
  size = 40,
  wide = false,
  height,
  className,
}: Props) {
  const key = resolvePalette(subjectId, paletteKey);
  const background = paletteGradient(key);

  if (wide) {
    return (
      <div
        className={`ds-cover ds-cover--wide${className ? ` ${className}` : ""}`}
        style={{ background, height: height ?? 96 }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={`ds-cover${className ? ` ${className}` : ""}`}
      style={{ background, width: size, height: size }}
      aria-hidden="true"
    />
  );
}
