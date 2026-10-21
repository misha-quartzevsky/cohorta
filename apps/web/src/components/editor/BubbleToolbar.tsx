/**
 * ============================================
 *  editor/BubbleToolbar.tsx — закреплённая панель форматирования
 * ============================================
 *
 * Screen-editor.dc.html: Aa, B, I, Маркер, «···», «+ Квиз». Закреплена под
 * текстом отдельной строкой (sticky к низу вьюпорта, см. .bubble-menu).
 * «Aa» открывает стили текста (заголовки, списки, цитата), «···» — остальное
 * (диктовка, ссылка, цвета выделения, чек-лист, «Сделать задачей»).
 */

import type { Editor as TiptapEditor } from "@tiptap/core";
import { HIGHLIGHT_COLORS, toggleHighlight } from "./textCommands";

interface Props {
  editor: TiptapEditor;
  /** Открыть меню у кнопки: «style» — Aa, «more» — «···». */
  onOpenTextMenu: (section: "style" | "more", anchor: DOMRect) => void;
  textMenuOpen: boolean;
  textMenuSection: "style" | "more";
  onQuiz?: () => void;
}

const MARKER = HIGHLIGHT_COLORS[0];

export function BubbleToolbar({ editor, onOpenTextMenu, textMenuOpen, textMenuSection, onQuiz }: Props) {
  const keepSelection = (e: React.MouseEvent) => e.preventDefault();
  return (
    <div className="bubble-menu" role="toolbar" aria-label="Форматирование">
      <button
        type="button"
        className={`bubble-btn bubble-text${textMenuOpen && textMenuSection === "style" ? " active" : ""}`}
        onMouseDown={keepSelection}
        onClick={(e) => onOpenTextMenu("style", e.currentTarget.getBoundingClientRect())}
        aria-label="Стиль текста"
        title="Стиль текста"
      >
        Aa
      </button>
      <button
        type="button"
        className={`bubble-btn bubble-text bold${editor.isActive("bold") ? " active" : ""}`}
        onMouseDown={keepSelection}
        onClick={() => editor.chain().focus().toggleBold().run()}
        aria-label="Жирный"
        aria-pressed={editor.isActive("bold")}
        title="Жирный"
      >
        B
      </button>
      <button
        type="button"
        className={`bubble-btn bubble-text italic${editor.isActive("italic") ? " active" : ""}`}
        onMouseDown={keepSelection}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        aria-label="Курсив"
        aria-pressed={editor.isActive("italic")}
        title="Курсив"
      >
        I
      </button>
      <button
        type="button"
        className={`bubble-btn bubble-word${editor.isActive("highlight") ? " active" : ""}`}
        onMouseDown={keepSelection}
        onClick={() => toggleHighlight(editor, MARKER)}
        aria-pressed={editor.isActive("highlight")}
        title="Маркер"
      >
        Маркер
      </button>
      <button
        type="button"
        className={`bubble-btn bubble-text${textMenuOpen && textMenuSection === "more" ? " active" : ""}`}
        onMouseDown={keepSelection}
        onClick={(e) => onOpenTextMenu("more", e.currentTarget.getBoundingClientRect())}
        aria-label="Ещё"
        title="Ещё"
      >
        ···
      </button>
      {onQuiz && (
        <button type="button" className="bubble-quiz" onMouseDown={keepSelection} onClick={onQuiz}>
          + Квиз
        </button>
      )}
    </div>
  );
}
