/**
 * ============================================
 *  editor/BubbleToolbar.tsx — закреплённая панель форматирования
 * ============================================
 *
 * B1, 2026-10-19 (Screen-editor.dc.html): панель закреплена под текстом
 * отдельной строкой (sticky к низу вьюпорта, см. .bubble-menu в App.css),
 * не всплывает по выделению — обычный блок в потоке документа, не Tiptap
 * BubbleMenu/tippy. Раньше показывалась только при непустом выделении
 * (`shouldShow`); проп оставлен в сигнатуре (Editor.tsx его всё ещё
 * вычисляет для другой логики), но здесь больше не используется.
 *
 * bold / italic / link / highlight swatches / clear highlight / the «…»
 * button that opens the extended TextMenu.
 */

import type { Editor as TiptapEditor } from "@tiptap/core";
import type { BubbleMenuPluginProps } from "@tiptap/extension-bubble-menu";
import { Bold, Eraser, Italic, Link2, ListChecks, Mic, MicOff, MoreHorizontal } from "lucide-react";
import { HIGHLIGHT_COLORS, handleLink, toggleHighlight } from "./textCommands";

interface Props {
  editor: TiptapEditor;
  shouldShow?: NonNullable<BubbleMenuPluginProps["shouldShow"]>;
  /** Active state of the «…» popover (for the button highlight). */
  textMenuOpen: boolean;
  onOpenTextMenu: () => void;
  /** Диктовка/запись (для пульса иконки микрофона). */
  recording: boolean;
  onToggleMic: () => void;
  /** Когда задан — показываем «Сделать задачей» с текстом выделения. */
  onMakeTask?: (text: string) => void;
}

function selectedText(editor: TiptapEditor): string {
  const { from, to } = editor.state.selection;
  return editor.state.doc.textBetween(from, to, " ").trim();
}

export function BubbleToolbar({
  editor,
  textMenuOpen,
  onOpenTextMenu,
  recording,
  onToggleMic,
  onMakeTask,
}: Props) {
  return (
    <div className="bubble-menu">
      <button
        type="button"
        className={`bubble-btn${recording ? " recording" : ""}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onToggleMic}
        title={recording ? "Остановить запись" : "Диктовка / диктофон"}
      >
        {recording ? (
          <MicOff size={15} />
        ) : (
          <Mic size={15} />
        )}
      </button>
      <span className="bubble-sep" />
      <button
        type="button"
        className={`bubble-btn${editor.isActive("bold") ? " active" : ""}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Жирный"
      >
        <Bold size={15} />
      </button>
      <button
        type="button"
        className={`bubble-btn${editor.isActive("italic") ? " active" : ""}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Курсив"
      >
        <Italic size={15} />
      </button>
      <button
        type="button"
        className={`bubble-btn${editor.isActive("link") ? " active" : ""}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => handleLink(editor)}
        title="Ссылка"
      >
        <Link2 size={15} />
      </button>
      <span className="bubble-sep" />
      {HIGHLIGHT_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className={`bubble-swatch${
            editor.isActive("highlight", { color }) ? " active" : ""
          }`}
          style={{ background: color }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleHighlight(editor, color)}
          title={`Выделить ${color}`}
        />
      ))}
      {editor.isActive("highlight") && (
        <>
          <span className="bubble-sep" />
          <button
            type="button"
            className="bubble-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().unsetHighlight().run()}
            title="Снять выделение"
          >
            <Eraser size={15} />
          </button>
        </>
      )}
      {onMakeTask && (
        <>
          <span className="bubble-sep" />
          <button
            type="button"
            className="bubble-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const text = selectedText(editor);
              if (text) onMakeTask(text);
            }}
            title="Сделать задачей"
          >
            <ListChecks size={15} />
          </button>
        </>
      )}
      <span className="bubble-sep" />
      <button
        type="button"
        className={`bubble-btn${textMenuOpen ? " active" : ""}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onOpenTextMenu}
        title="Ещё"
      >
        <MoreHorizontal size={15} />
      </button>
    </div>
  );
}