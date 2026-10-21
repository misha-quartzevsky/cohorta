/**
 * ============================================
 *  editor/TextMenu.tsx — the «…» formatting popover
 * ============================================
 *
 * Extended Notion-style formatting menu for the current selection, opened
 * from the BubbleToolbar's «…» button. Rendered through a portal into
 * <body> at the selection coordinates; closes on outside click / Escape.
 */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { Eraser, Link2, ListChecks, Mic, MicOff, RemoveFormatting } from "lucide-react";
import {
  HIGHLIGHT_COLORS,
  TEXT_BLOCK_ITEMS,
  TEXT_MARK_ITEMS,
  handleLink,
  toggleHighlight,
  type TextMenuItem,
} from "./textCommands";

interface Props {
  editor: TiptapEditor;
  pos: { top: number; left: number };
  /** Close the popover (fires before/after commands run). */
  onClose: () => void;
  /** Есть ли чем писать (Web Speech API или MediaRecorder). */
  canCapture: boolean;
  /** Идёт ли запись/диктовка. */
  recording: boolean;
  onToggleMic: () => void;
  /** «style» — Aa (форматирование и блоки), «more» — «···» (диктовка, ссылка, цвета, задача). */
  section: "style" | "more";
  onMakeTask?: (text: string) => void;
}

export function TextMenu({ editor, pos, onClose, canCapture, recording, onToggleMic, section, onMakeTask }: Props) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Закрытие по клику вне меню / Escape.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  /** Закрыть меню и выполнить команду (как в Notion). */
  const runTextCommand = (action: () => void) => {
    onClose();
    action();
  };

  const renderTextMenuItem = (item: TextMenuItem) => {
    const Icon = item.icon;
    return (
      <button
        key={item.title}
        type="button"
        className={`text-menu-item${item.isActive?.(editor) ? " active" : ""}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => runTextCommand(() => item.run(editor))}
      >
        <span className="slash-icon">
          <Icon size={15} />
        </span>
        {item.title}
      </button>
    );
  };

  return createPortal(
    <div
      ref={menuRef}
      className="text-menu"
      style={{ top: pos.top, left: pos.left }}
    >
      {section === "style" && (
        <>
          <div className="text-menu-label">Форматирование</div>
          {TEXT_MARK_ITEMS.map(renderTextMenuItem)}
          <div className="text-menu-label">Блоки</div>
          {TEXT_BLOCK_ITEMS.filter((i) => i.title !== "Чек-лист").map(renderTextMenuItem)}
        </>
      )}
      {section === "more" && canCapture && (
        <>
          <span className="text-menu-sep" />
          <button
            type="button"
            className={`text-menu-item${recording ? " active" : ""}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() =>
              runTextCommand(() => onToggleMic())
            }
          >
            <span className="slash-icon">
              {recording ? <MicOff size={15} /> : <Mic size={15} />}
            </span>
            {recording
              ? "Остановить запись"
              : "Диктовка / диктофон"}
          </button>
        </>
      )}
      {section === "more" && (<>
      <div className="text-menu-label">Ссылка</div>
      <button
        type="button"
        className={`text-menu-item${editor.isActive("link") ? " active" : ""}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => runTextCommand(() => handleLink(editor))}
      >
        <span className="slash-icon">
          <Link2 size={15} />
        </span>
        Ссылка
      </button>
      <div className="text-menu-label">Выделение</div>
      <div className="text-menu-swatch-row">
        {HIGHLIGHT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`bubble-swatch${
              editor.isActive("highlight", { color }) ? " active" : ""
            }`}
            style={{ background: color }}
            title={`Выделить ${color}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() =>
              runTextCommand(() => toggleHighlight(editor, color))
            }
          />
        ))}
        <button
          type="button"
          className="text-menu-eraser"
          title="Снять выделение"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            runTextCommand(() => editor.chain().focus().unsetHighlight().run())
          }
        >
          <Eraser size={13} />
        </button>
      </div>
      <span className="text-menu-sep" />
      {TEXT_BLOCK_ITEMS.filter((i) => i.title === "Чек-лист").map(renderTextMenuItem)}
      <button
        type="button"
        className="text-menu-item"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() =>
          runTextCommand(() => editor.chain().focus().unsetAllMarks().run())
        }
      >
        <span className="slash-icon">
          <RemoveFormatting size={15} />
        </span>
        Очистить форматирование
      </button>
      {onMakeTask && (
        <button
          type="button"
          className="text-menu-item"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            runTextCommand(() => {
              const { from, to } = editor.state.selection;
              const text = editor.state.doc.textBetween(from, to, " ").trim();
              if (text) onMakeTask(text);
            })
          }
        >
          <span className="slash-icon">
            <ListChecks size={15} />
          </span>
          Сделать задачей
        </button>
      )}
      </>)}
    </div>,
    document.body
  );
}