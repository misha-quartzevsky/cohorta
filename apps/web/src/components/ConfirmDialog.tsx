/**
 * ============================================
 *  ConfirmDialog.tsx
 * ============================================
 *
 * A lightweight modal that asks the user to
 * confirm a destructive action (delete).
 */

import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface Props {
  /** Whether the dialog is visible. */
  open: boolean;
  /** Title / heading of the dialog. */
  title: string;
  /** Body message. */
  message: string;
  /** Called when the user clicks «Подтвердить». */
  onConfirm: () => void;
  /** Called when the user clicks «Отмена». */
  onCancel: () => void;
}

/**
 * Renders a centered confirmation modal.
 *
 * @param Props.open     — visibility flag
 * @param Props.title    — heading text
 * @param Props.message  — explanatory text
 * @param Props.onConfirm — confirm button handler
 * @param Props.onCancel  — cancel button handler
 */
function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return createPortal(
    <div className="confirm-backdrop" onClick={onCancel}>
      <div className="confirm-content" onClick={(e) => e.stopPropagation()}>
        <button
          className="confirm-close"
          onClick={onCancel}
          aria-label="Закрыть"
          type="button"
        >
          <X size={18} />
        </button>

        <h3 className="confirm-title">{title}</h3>
        <p className="confirm-message">{message}</p>

        <div className="confirm-actions">
          <button
            className="btn btn-outline"
            onClick={onCancel}
            type="button"
          >
            Отмена
          </button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            type="button"
          >
            Подтвердить удаление
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ConfirmDialog;