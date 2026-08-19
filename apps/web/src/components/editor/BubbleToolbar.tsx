/**
 * ============================================
 *  editor/BubbleToolbar.tsx — selection bubble
 * ============================================
 *
 * The floating quick-formatting bar shown above a text selection:
 * bold / italic / link / highlight swatches / clear highlight / the «…»
 * button that opens the extended TextMenu.
 */

import type { Editor as TiptapEditor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import type { BubbleMenuPluginProps } from "@tiptap/extension-bubble-menu";
import { Bold, Eraser, Italic, Link2, MoreHorizontal } from "lucide-react";
import { HIGHLIGHT_COLORS, handleLink, toggleHighlight } from "./textCommands";

interface Props {
  editor: TiptapEditor;
  shouldShow: NonNullable<BubbleMenuPluginProps["shouldShow"]>;
  /** Active state of the «…» popover (for the button highlight). */
  textMenuOpen: boolean;
  onOpenTextMenu: () => void;
}

export function BubbleToolbar({
  editor,
  shouldShow,
  textMenuOpen,
  onOpenTextMenu,
}: Props) {
  return (
    <BubbleMenu editor={editor} shouldShow={shouldShow} className="bubble-menu">
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
    </BubbleMenu>
  );
}