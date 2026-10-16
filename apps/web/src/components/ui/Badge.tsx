import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "success" | "danger";

interface Props {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}

/** Плашка-пилюля (spec 1A.7). Цвет всегда сопровождается текстом. */
export default function Badge({ tone = "neutral", children, className }: Props) {
  return (
    <span className={`ds-badge ds-badge--${tone}${className ? ` ${className}` : ""}`}>
      {children}
    </span>
  );
}
