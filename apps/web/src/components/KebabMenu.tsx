/**
 * ============================================
 *  KebabMenu.tsx
 * ============================================
 *
 * A small "..." button that reveals a dropdown
 * with Edit and Delete actions.  Used on every
 * Course, Lecture, and Note tile.
 *
 * Dropdown is portaled to document.body (position: fixed, computed from
 * the button's own bounding rect) — не дочерний элемент .kebab-wrapper.
 * Раньше меню рендерилось внутри плитки, а плитки (.tile) стоят на
 * overflow: hidden ради скруглённых углов — dropdown физически обрезался
 * и был невидим и некликабелен. Тот же приём уже применяется в сайдбаре
 * для попапа выбора семестра.
 */

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";

export interface KebabAction {
  /** Internal key (e.g. "edit", "delete") */
  key: string;
  /** Label shown in the dropdown */
  label: string;
  /** Icon element to render */
  icon: React.ReactNode;
  /** Click handler */
  onClick: (e: React.MouseEvent) => void;
  /** Optional danger style (red text) for destructive actions */
  danger?: boolean;
}

interface Props {
  /** Actions to display in the dropdown. */
  actions: KebabAction[];
}

/**
 * Renders a "..." kebab button with a dropdown menu.
 *
 * @param Props.actions — array of actions to show
 */
function KebabMenu({ actions }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Клик вне кнопки И вне портированного меню — закрыть.
  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  // Меню недолговечно и закрывается по любому скроллу/ресайзу — не
  // усложняем репозиционированием на лету.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const toggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen((prev) => !prev);
  };

  return (
    <div className="kebab-wrapper">
      <button
        ref={btnRef}
        className="kebab-btn"
        onClick={toggle}
        type="button"
        aria-label="Ещё действия"
        aria-expanded={open}
      >
        <MoreVertical size={16} />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={dropdownRef}
            className="kebab-dropdown kebab-dropdown-portal"
            style={{ top: pos.top, right: pos.right }}
          >
            {actions.map((a) => (
              <button
                key={a.key}
                className={`kebab-item ${a.danger ? "danger" : ""}`}
                onClick={(e) => {
                  a.onClick(e);
                  setOpen(false);
                }}
                type="button"
              >
                {a.icon}
                <span>{a.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}

export default KebabMenu;
