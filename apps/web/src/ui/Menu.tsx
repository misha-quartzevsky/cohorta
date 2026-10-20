import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  /** Линия над пунктом (опасное отделено от остального). */
  separatorBefore?: boolean;
}

interface Props {
  trigger: (props: {
    ref: (el: HTMLButtonElement | null) => void;
    onClick: () => void;
    "aria-expanded": boolean;
    "aria-haspopup": "menu";
  }) => ReactNode;
  items: MenuItem[];
  /** Ширина меню, px (по умолчанию 240). */
  width?: number;
  "aria-label"?: string;
}

/** Поповер-меню (.c-pop/.c-menu, spec 1A.7): shadow-pop, пункты высотой 44. */
export default function Menu({ trigger, items, width, "aria-label": ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setCoords({ top: rect.bottom + 4, left: rect.right - (width ?? 240) });
    }
    setOpen((o) => !o);
  }

  return (
    <>
      {trigger({
        ref: (el) => {
          triggerRef.current = el;
        },
        onClick: toggle,
        "aria-expanded": open,
        "aria-haspopup": "menu",
      })}
      {open &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            className="c-pop c-menu"
            role="menu"
            aria-label={ariaLabel}
            style={{ position: "fixed", top: coords.top, left: Math.max(8, coords.left), zIndex: 1200, ...(width ? { width } : {}) }}
          >
            {items.map((item) => (
              <Fragment key={item.label}>
                {item.separatorBefore && <hr />}
                <button
                  type="button"
                  role="menuitem"
                  className={item.danger ? "bad" : undefined}
                  onClick={() => {
                    setOpen(false);
                    item.onClick();
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              </Fragment>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
