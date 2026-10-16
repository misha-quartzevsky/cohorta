import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "soft" | "ghost" | "danger-text";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  block?: boolean;
  children: ReactNode;
}

/** Кнопка дизайн-основы (spec 1A.7). */
export default function Button({
  variant = "primary",
  loading = false,
  block = false,
  children,
  className,
  disabled,
  type = "button",
  ...rest
}: Props) {
  const cls = [
    "ds-btn",
    `ds-btn--${variant}`,
    block ? "ds-btn--block" : "",
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
      {loading ? <span className="ds-btn__spinner" aria-hidden="true" /> : children}
    </button>
  );
}
