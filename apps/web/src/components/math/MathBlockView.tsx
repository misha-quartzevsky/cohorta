/**
 * ============================================
 *  MathBlockView.tsx — NodeView блока формулы
 * ============================================
 *
 * Показывает статичный рендер (через `<math-div>`), а в режиме
 * редактирования — маленькую панель «✏️ / 🗑». Клик по ✏️ открывает
 * единственный overlay-редактор MathLive через шину mathBus.
 */

import { useCallback, useEffect, useRef } from "react";
import type { NodeViewProps } from "@tiptap/react";
import { Pencil, Trash2 } from "lucide-react";

import { mathBus } from "./mathBus";
import { renderLatexInto } from "./renderLatex";

export function MathBlockView({ node, editor, getPos }: NodeViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    void renderLatexInto(container, node.attrs.latex || "");
  }, [node.attrs.latex]);

  const onEdit = useCallback(() => {
    if (!editor.isEditable) return;
    const pos = getPos();
    if (typeof pos !== "number") return;
    mathBus.open({
      editor,
      pos,
      latex: node.attrs.latex || "",
    });
  }, [editor, getPos, node.attrs.latex]);

  const onDelete = useCallback(() => {
    const pos = getPos();
    if (typeof pos !== "number") return;
    editor
      .chain()
      .focus()
      .deleteRange({ from: pos, to: pos + node.nodeSize })
      .run();
  }, [editor, getPos, node.nodeSize]);

  return (
    <div
      className={`math-block${editor.isEditable ? " editable" : ""}`}
      contentEditable={false}
      onClick={() => {
        // Клик по блоку открывает визуальный редактор MathLive.
        onEdit();
      }}
    >
      <div ref={containerRef} className="math-block-render" />
      {editor.isEditable && (
        <div
          className="math-block-toolbar"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="math-block-btn"
            onClick={onEdit}
            title="Редактировать формулу"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            className="math-block-btn danger"
            onClick={onDelete}
            title="Удалить"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}