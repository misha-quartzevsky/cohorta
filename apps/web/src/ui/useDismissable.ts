import { useEffect, type RefObject } from "react";

/**
 * Esc закрывает всплывающее (раздел 3 инструкции: доступность), клик мимо —
 * тоже. Общий хук для Popover/Toggletip/Menu.
 */
export function useDismissable(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  onClose: () => void
) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, ref, onClose]);
}
