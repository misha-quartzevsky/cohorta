/**
 * ============================================
 *  SketchBlockView.tsx — NodeView блока схемы
 * ============================================
 *
 * Показывает картинку схемы; в режиме редактирования — панель
 * «✏️ / 🗑». Клик по ✏️ открывает модалку Excalidraw (через sketchBus).
 */

import { useCallback } from "react";
import type { NodeViewProps } from "@tiptap/react";
import { Pencil, Trash2 } from "lucide-react";

import { sketchBus, sketchUploader } from "./sketchBus";

export function SketchBlockView({ node, editor, getPos }: NodeViewProps) {
  const onEdit = useCallback(() => {
    if (!editor.isEditable) return;
    const pos = getPos();
    if (typeof pos !== "number") return;
    sketchBus.open({
      editor,
      pos,
      scene: node.attrs.scene || null,
      onUploadImages: sketchUploader,
    });
  }, [editor, getPos, node.attrs.scene]);

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
      className={`sketch-block${editor.isEditable ? " editable" : ""}`}
      contentEditable={false}
    >
      {node.attrs.src && (
        <img className="sketch-block-img" src={node.attrs.src} alt="Схема" />
      )}
      {editor.isEditable && (
        <div className="sketch-block-toolbar">
          <button
            type="button"
            className="sketch-block-btn"
            onClick={onEdit}
            title="Редактировать схему"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            className="sketch-block-btn danger"
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