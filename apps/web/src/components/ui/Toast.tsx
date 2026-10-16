import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface ToastItem {
  id: number;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface ToastApi {
  show: (
    message: string,
    action?: { label: string; onClick: () => void }
  ) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Тосты (spec 1A.7): снизу по центру, до 4 c, role=status, ссылка-действие. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const show = useCallback<ToastApi["show"]>((message, action) => {
    const id = nextId.current++;
    setItems((prev) => [...prev, { id, message, action }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {items.length > 0 &&
        createPortal(
          <div className="ds-toast-wrap ds-root">
            {items.map((t) => (
              <div key={t.id} className="ds-toast" role="status">
                <span>{t.message}</span>
                {t.action && (
                  <button
                    type="button"
                    className="ds-toast__action"
                    onClick={() => {
                      t.action?.onClick();
                      setItems((prev) => prev.filter((x) => x.id !== t.id));
                    }}
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fail-soft: без провайдера тост просто не показывается.
    return { show: () => {} };
  }
  return ctx;
}
