import { useRef, type ReactNode } from "react";
import { useDismissable } from "./useDismissable";

interface Props {
  open: boolean;
  onClose: () => void;
  trigger: ReactNode;
  children: ReactNode;
  /** Выравнивание всплывающего блока относительно триггера. */
  align?: "start" | "end";
  className?: string;
}

/** Всплывающее окно (.c-pop) с триггером. Esc и клик мимо закрывают. */
export default function Popover({
  open,
  onClose,
  trigger,
  children,
  align = "start",
  className,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useDismissable(open, ref, onClose);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      {trigger}
      {open && (
        <div
          className={`c-pop${className ? ` ${className}` : ""}`}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            [align === "end" ? "right" : "left"]: 0,
            zIndex: 20,
          }}
          role="dialog"
        >
          {children}
        </div>
      )}
    </div>
  );
}
