import type { ReactNode } from "react";

interface Props {
  label?: string;
  children: ReactNode;
  className?: string;
}

/** Блок-врезка (spec 1A.7): фон subtle, подпись-overline. Без цветной полосы. */
export default function Callout({ label, children, className }: Props) {
  return (
    <div className={`ds-callout${className ? ` ${className}` : ""}`}>
      {label && <div className="ds-callout__label">{label}</div>}
      <div>{children}</div>
    </div>
  );
}
