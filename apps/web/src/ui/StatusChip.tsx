import type { ReactNode } from "react";

type Tone = "neutral" | "ok" | "warn" | "danger" | "accent";

interface Props {
  tone?: Tone;
  /** Точка перед текстом — статус это всегда точка и слово (README). */
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

/** Статус-чип (.c-chip): точка + слово, не только цвет. */
export default function StatusChip({
  tone = "neutral",
  dot = true,
  children,
  className,
}: Props) {
  const cls = ["c-chip", tone !== "neutral" ? tone : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cls}>
      {dot && <i aria-hidden="true" />}
      {children}
    </span>
  );
}
