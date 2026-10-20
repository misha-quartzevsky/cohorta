/**
 * Долгое нажатие на строку списка (телефон): через 500 мс срабатывает колбэк и
 * идёт короткий вибро-отклик, если он доступен. Сдвиг пальца больше 8 px или
 * прокрутка (pointercancel) отменяют нажатие, поэтому список прокручивается как
 * обычно. После срабатывания следующий click гасится (`consumeClick`), иначе
 * строка открылась бы вместе с меню.
 */

import { useCallback, useRef, type PointerEvent } from "react";

const DELAY_MS = 500;
const MOVE_PX = 8;

export function useLongPress(onLongPress: () => void, enabled = true) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  }, []);

  const handlers = enabled
    ? {
        onPointerDown: (e: PointerEvent) => {
          if (e.pointerType === "mouse") return;
          fired.current = false;
          start.current = { x: e.clientX, y: e.clientY };
          timer.current = setTimeout(() => {
            fired.current = true;
            timer.current = null;
            try {
              navigator.vibrate?.(10);
            } catch {
              /* вибро недоступно */
            }
            onLongPress();
          }, DELAY_MS);
        },
        onPointerMove: (e: PointerEvent) => {
          const s = start.current;
          if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > MOVE_PX) clear();
        },
        onPointerUp: clear,
        onPointerCancel: clear,
        onPointerLeave: clear,
        // Системное меню долгого нажатия (копировать, открыть в новой вкладке) не нужно.
        onContextMenu: (e: { preventDefault: () => void; pointerType?: string }) => {
          e.preventDefault();
        },
      }
    : {};

  /** true, если click пришёл сразу после долгого нажатия: его надо проигнорировать. */
  const consumeClick = () => {
    if (!fired.current) return false;
    fired.current = false;
    return true;
  };

  return { handlers, consumeClick };
}
