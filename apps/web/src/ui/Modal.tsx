import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Дополнительный класс окна (.c-dialog) — для окон со своей вёрсткой. */
  className?: string;
  /** Без заголовка с крестиком: `title` остаётся только как подпись для скринридера. */
  bare?: boolean;
}

/**
 * Модальное окно (.c-dialog, spec 1A.7): на широком экране центр,
 * на телефоне выезжает снизу (переключение чисто по CSS). Esc закрывает,
 * фокус захватывается, клик по фону закрывает. Без window.confirm —
 * подтверждения живут внутри (см. components/schedule/SlotForm.tsx).
 */
export default function Modal({ open, onClose, title, children, footer, className, bare }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Курсор сразу в первом поле формы (Screen-forms-create), иначе — первый управляющий элемент.
    (
      panel?.querySelector<HTMLElement>(
        ".c-dialog-body input:not([type='hidden']), .c-dialog-body textarea, .c-dialog-body select"
      ) ??
      panel?.querySelector<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
      )
    )?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        "button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])"
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="c-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={`c-dialog${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {title && !bare && (
          <div className="c-dialog-head">
            <h2>{title}</h2>
            <button type="button" className="c-dialog-close" aria-label="Закрыть" onClick={onClose}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="c-dialog-body">{children}</div>
        {footer && <div className="c-dialog-foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
