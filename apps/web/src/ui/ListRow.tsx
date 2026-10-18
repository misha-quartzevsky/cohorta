import type { ReactNode, ButtonHTMLAttributes, HTMLAttributes } from "react";

interface ListProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** Контейнер строк списка (.c-list) — рамка и разделители, список не плитки. */
export function List({ children, className, ...rest }: ListProps) {
  return (
    <div className={`c-list${className ? ` ${className}` : ""}`} {...rest}>
      {children}
    </div>
  );
}

interface RowProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
  /** Обложка/иконка слева — предмет, лекция и т. п. (40×40). */
  cover?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  /** Содержимое справа: статус, дата, шеврон. */
  right?: ReactNode;
  selected?: boolean;
}

/** Строка списка (.c-row). Без onClick рендерится как не интерактивная строка. */
export function ListRow({
  cover,
  title,
  meta,
  right,
  selected,
  className,
  onClick,
  type = "button",
  ...rest
}: RowProps) {
  const cls = ["c-row", selected ? "on" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  const content = (
    <>
      {cover && <span className="cv">{cover}</span>}
      <span className="tx">
        <span className="t">{title}</span>
        {meta && <span className="m">{meta}</span>}
      </span>
      {right}
    </>
  );

  if (!onClick) {
    return (
      <div className={cls} role="listitem">
        {content}
      </div>
    );
  }

  return (
    <button type={type} className={cls} onClick={onClick} {...rest}>
      {content}
    </button>
  );
}
