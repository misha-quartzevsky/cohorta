import type { HTMLAttributes, ReactNode } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** Карточка дизайн-основы (spec 1A.7): фон card, рамка line, radius xl. */
export default function Card({ children, className, ...rest }: Props) {
  return (
    <div className={`ds-card${className ? ` ${className}` : ""}`} {...rest}>
      {children}
    </div>
  );
}
