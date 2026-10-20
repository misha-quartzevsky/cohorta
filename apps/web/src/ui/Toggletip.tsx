import { useRef, useState, type ReactNode } from "react";
import Icon from "./Icon";
import { useDismissable } from "./useDismissable";

interface Props {
  /** Текст подсказки. Не единственное место этой информации на экране. */
  children: ReactNode;
  label?: string;
  /** К какому краю кнопки прижата подсказка (у правого края страницы — right). */
  align?: "left" | "right";
}

/** Лампочка-подсказка (.c-bulb): открывается кликом и с клавиатуры (Enter/Space), закрывается Esc. */
export default function Toggletip({ children, label = "Подсказка", align = "left" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismissable(open, ref, () => setOpen(false));

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        className="c-bulb"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="bulb" size={18} />
      </button>
      {open && (
        <div
          className="c-pop"
          role="tooltip"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            ...(align === "right" ? { right: 0 } : { left: 0 }),
            zIndex: 20,
            padding: "12px 14px",
            width: 260,
            font: "400 13px/18px var(--font-sans)",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
