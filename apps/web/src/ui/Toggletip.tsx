import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Icon from "./Icon";
import { useDismissable } from "./useDismissable";

interface Props {
  /** Текст подсказки. Не единственное место этой информации на экране. */
  children: ReactNode;
  label?: string;
  /** К какому краю кнопки прижата подсказка. Без значения — слева, а у правого края экрана сама разворачивается влево. */
  align?: "left" | "right";
}

/** Лампочка-подсказка (.c-bulb): открывается кликом и с клавиатуры (Enter/Space), закрывается Esc. */
export default function Toggletip({ children, label = "Подсказка", align }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [flip, setFlip] = useState(false);
  useLayoutEffect(() => {
    if (!open || align || !ref.current) return;
    const left = ref.current.getBoundingClientRect().left;
    setFlip(left + 260 > window.innerWidth - 16);
  }, [open, align]);
  const toRight = align ? align === "right" : flip;
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
            ...(toRight ? { right: 0 } : { left: 0 }),
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
