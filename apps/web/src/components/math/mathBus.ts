/**
 * ============================================
 *  mathBus.ts — шина единственного overlay-редактора формул
 * ============================================
 *
 * MathBlock — атомарный блок; при клике по нему открывается ОДИН визуальный
 * редактор (MathLive `<math-field>`). Чтобы не плодить состояние в каждом
 * NodeView, используем модульную шину: MathBlockView зовёт mathBus.open(),
 * а компонент Editor (владелец редактора) подписан и рендерит overlay.
 *
 * PM-транзакции происходят ТОЛЬКО при commit (updateAttributes) и при
 * отмене — поэтому курсор не прыгает во время редактирования формулы.
 */

import type { Editor as TiptapEditor } from "@tiptap/core";

export interface MathEditRequest {
  editor: TiptapEditor;
  /** Позиция блока (для update) или точка вставки (для нового блока). */
  pos: number;
  latex: string;
}

type Listener = (request: MathEditRequest | null) => void;

const listeners = new Set<Listener>();

export const mathBus = {
  open(request: MathEditRequest) {
    listeners.forEach((listener) => listener(request));
  },
  close() {
    listeners.forEach((listener) => listener(null));
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
