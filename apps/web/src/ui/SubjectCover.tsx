import type { CSSProperties } from "react";

interface Props {
  /** `courses.cover_seed` (0–359). Без сида рендерится нейтральная заглушка. */
  seed?: number | null;
  size?: number;
  wide?: boolean;
  height?: number;
  className?: string;
}

/**
 * Обложка предмета (раздел 2.3 инструкции): градиент только из `--h`,
 * формула целиком в CSS (`.c-cover`, styles/components.css) — единственное
 * место в продукте, где допустим hsl/hsla вне токенов. У одногруппника
 * обложка берётся из его cover_seed, поэтому одинакова у всех.
 */
export default function SubjectCover({
  seed,
  size = 40,
  wide = false,
  height,
  className,
}: Props) {
  const hasSeed = typeof seed === "number" && Number.isFinite(seed);
  const style: CSSProperties = wide
    ? { height: height ?? 96 }
    : { width: size, height: size };
  if (hasSeed) {
    (style as Record<string, string | number>)["--h"] = seed;
  }

  const cls = [
    hasSeed ? "c-cover" : "c-cover-empty",
    wide ? "c-cover--wide" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={cls} style={style} aria-hidden="true" />;
}
