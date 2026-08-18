/**
 * ============================================
 *  useConfirmDialog.ts — Confirmation dialog hook
 * ============================================
 *
 * Centralizes the "open/title/message/pending action"
 * state that used to be scattered across Dashboard,
 * CoursesPage, LecturesPage and LectureView.
 *
 * The pending action lives in a ref, so the latest
 * closure (e.g. the lecture/course being deleted) is
 * always invoked on confirm without stale state.
 */

import { useCallback, useRef, useState } from "react";

export interface UseConfirmDialogResult {
  open: boolean;
  title: string;
  message: string;
  /** Open the dialog; `onConfirm` runs when the user confirms. */
  ask: (title: string, message: string, onConfirm: () => void) => void;
  /** Invoked on Confirm — closes the dialog and runs the pending action. */
  confirm: () => void;
  /** Close the dialog without running the pending action. */
  cancel: () => void;
}

/**
 * Manages a single confirmation dialog.
 *
 * @returns {UseConfirmDialogResult} open/title/message plus
 *          ask/confirm/cancel helpers for <ConfirmDialog>.
 */
export function useConfirmDialog(): UseConfirmDialogResult {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const actionRef = useRef<() => void>(() => {});

  const ask = useCallback((t: string, m: string, onConfirm: () => void) => {
    actionRef.current = onConfirm;
    setTitle(t);
    setMessage(m);
    setOpen(true);
  }, []);

  const confirm = useCallback(() => {
    setOpen(false);
    actionRef.current();
  }, []);

  const cancel = useCallback(() => setOpen(false), []);

  return { open, title, message, ask, confirm, cancel };
}

export default useConfirmDialog;
