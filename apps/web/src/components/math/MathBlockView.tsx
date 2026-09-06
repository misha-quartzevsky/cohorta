/**
 * ============================================
 *  MathBlockView.tsx — NodeView блока формулы
 * ============================================
 *
 * Статичный рендер (`<math-div>`) внутри общей обёртки MediaBlockShell
 * (DESIGN.md §6 «Вставленные медиа») — без подписи. «Редактировать» или
 * двойной клик открывает единственный overlay MathLive через mathBus.
 */

import { useCallback, useEffect, useRef } from "react";
import type { NodeViewProps } from "@tiptap/react";

import { MediaBlockShell } from "../editor/MediaBlockShell";
import { mathBus } from "./mathBus";
import { renderLatexInto } from "./renderLatex";

export function MathBlockView({ node, editor, getPos, selected }: NodeViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editable = editor.isEditable;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    void renderLatexInto(container, node.attrs.latex || "");
  }, [node.attrs.latex]);

  const onEdit = useCallback(() => {
    if (!editable) return;
    const pos = getPos();
    if (typeof pos !== "number") return;
    mathBus.open({ editor, pos, latex: node.attrs.latex || "" });
  }, [editable, editor, getPos, node.attrs.latex]);

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
    <MediaBlockShell
      editable={editable}
      selected={selected}
      onEdit={onEdit}
      onDelete={onDelete}
      onDoubleClick={onEdit}
      editLabel="Редактировать формулу"
      className="media-block-math"
    >
      <div ref={containerRef} className="math-block-render" />
    </MediaBlockShell>
  );
}
