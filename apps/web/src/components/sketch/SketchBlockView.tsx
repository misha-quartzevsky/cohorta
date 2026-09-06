/**
 * ============================================
 *  SketchBlockView.tsx — NodeView блока схемы
 * ============================================
 *
 * Рендерит картинку схемы внутри общей обёртки MediaBlockShell (DESIGN.md §6
 * «Вставленные медиа»). «Редактировать» открывает модалку Excalidraw через
 * sketchBus; подпись правится инлайн в шелле.
 */

import { useCallback } from "react";
import type { NodeViewProps } from "@tiptap/react";

import { MediaBlockShell } from "../editor/MediaBlockShell";
import { sketchBus, sketchUploader } from "./sketchBus";

export function SketchBlockView({
  node,
  editor,
  getPos,
  updateAttributes,
  selected,
}: NodeViewProps) {
  const editable = editor.isEditable;

  const onEdit = useCallback(() => {
    if (!editable) return;
    const pos = getPos();
    if (typeof pos !== "number") return;
    sketchBus.open({
      editor,
      pos,
      scene: node.attrs.scene || null,
      onUploadImages: sketchUploader,
    });
  }, [editable, editor, getPos, node.attrs.scene]);

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
      editLabel="Редактировать схему"
      caption={String(node.attrs.caption ?? "")}
      onCaptionChange={(value) => updateAttributes({ caption: value })}
    >
      {node.attrs.src && (
        <img
          className="media-block-img"
          src={String(node.attrs.src)}
          alt="Схема"
        />
      )}
    </MediaBlockShell>
  );
}
