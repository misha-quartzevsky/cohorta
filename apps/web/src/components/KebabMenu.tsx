/**
 * ============================================
 *  KebabMenu.tsx
 * ============================================
 *
 * A small "..." button that reveals a dropdown
 * with Edit and Delete actions.  Used on every
 * Course, Lecture, and Note tile.
 */

import { useState, useRef, useEffect } from "react";
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
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  return (
    <div className="kebab-wrapper" ref={ref}>
      <button
        className="kebab-btn"
        onClick={() => setOpen(!open)}
        type="button"
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div className="kebab-dropdown">
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
        </div>
      )}
    </div>
  );
}

export default KebabMenu;