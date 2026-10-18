import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "dark" | "secondary" | "ghost" | "soft" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

/**
 * Кнопка дизайн-системы (.c-btn). Одна `primary` (оранжевая) на экран —
 * это решает вызывающий экран, не компонент (раздел 2.1 инструкции).
 */
export default function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  children,
  className,
  disabled,
  type = "button",
  ...rest
}: Props) {
  const cls = [
    "c-btn",
    variant,
    size !== "md" ? size : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {children}
    </button>
  );
}
