/**
 * ============================================
 *  MathEditorOverlay.tsx — визуальный редактор формул (MathLive)
 * ============================================
 *
 * Единственный overlay-редактор на весь редактор. Пока пользователь
 * набирает формулу в `<math-field>`, НИКАКИХ PM-транзакций не происходит —
 * код кладётся в кэш. Commit (Enter/«Готово») обновляет атрибут `latex`
 * блока; Escape/«Отмена» закрывает без изменений. Поэтому курсор внутри
 * текста лекции не дёргается.
 *
 * Рендерится через createPortal в body поверх всего (fixed, z-index высокий).
 */

import {
  useCallback,
  useEffect,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { createElement } from "react";
import { X } from "lucide-react";

import type { MathEditRequest } from "./mathBus";

interface Props {
  request: MathEditRequest;
  onClose: () => void;
}

/**
 * На десктопе (точный курсор) виртуальная клавиатура MathLive не нужна —
 * набираем с физической клавиатуры. На тач-устройствах (coarse pointer)
 * она должна появляться при фокусе, чтобы можно было печатать с экрана.
 */
const IS_TOUCH =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: coarse)").matches;
const VIRTUAL_KEYBOARD_MODE = IS_TOUCH ? "onFocus" : "manual";

export default function MathEditorOverlay({ request, onClose }: Props) {
  const fieldRef = useRef<{
    value: string;
    focus?: () => void;
  } | null>(null);
  const dirtyRef = useRef<string>(request.latex);
  const requestRef = useRef(request);
  requestRef.current = request;

  // Значение поля — всегда в dirtyRef: не держим состояние, чтобы не
  // пересоздавать math-field на каждый символ и не сбивать ввод.

  // Синхронизируем поле при смене запроса (открытие другого блока).
  useEffect(() => {
    dirtyRef.current = request.latex;
    const field = fieldRef.current;
    if (field) {
      field.value = request.latex;
      field.focus?.();
    }
  }, [request]);

  const commit = useCallback(() => {
    onClose();
    const latex = dirtyRef.current.trim();
    const { editor, pos } = requestRef.current;

    const nodeAtPos = editor.state.doc.nodeAt(pos);
    if (nodeAtPos?.type.name === "mathBlock") {
      editor
        .chain()
        .focus()
        .setNodeSelection(pos)
        .updateAttributes("mathBlock", { latex })
        .run();
      editor.commands.setTextSelection(pos + 1);
    } else if (latex) {
      editor.chain().focus().insertContentAt(pos, {
        type: "mathBlock",
        attrs: { latex },
      }).run();
      editor.commands.setTextSelection(pos + 1);
    }
    editor.commands.focus();
  }, [onClose]);

  // Escape закрывает без сохранения.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fieldProps: Record<string, unknown> = {
    ref: fieldRef,
    className: "math-live-field",
    "virtual-keyboard-mode": VIRTUAL_KEYBOARD_MODE,
    onInput: (event: unknown) => {
      const target = (event as Event).target as { value?: string } | null;
      dirtyRef.current = target?.value ?? "";
    },
    onKeyDown: (event: unknown) => {
      const keyEvent = event as KeyboardEvent;
      if (keyEvent.key === "Enter") {
        keyEvent.preventDefault?.();
        commit();
      }
    },
    onMouseDown: (event: unknown) => {
      (event as MouseEvent).stopPropagation?.();
    },
  } as Record<string, unknown>;
  const field = createElement(
    "math-field",
    fieldProps as Record<string, unknown>,
    request.latex
  );

  return createPortal(
    <div
      className="math-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="math-overlay-card">
        <div className="math-overlay-head">
          <span className="math-overlay-title">Формула</span>
          <button
            type="button"
            className="math-overlay-close"
            onClick={onClose}
            title="Закрыть (Esc)"
          >
            <X size={16} />
          </button>
        </div>
        {field}
        <div className="math-overlay-actions">
          <button type="button" className="btn" onClick={commit}>
            Готово
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
