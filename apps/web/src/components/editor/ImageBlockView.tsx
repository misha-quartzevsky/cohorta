/**
 * ============================================
 *  ImageBlockView.tsx — NodeView картинки
 * ============================================
 *
 * Рендерит `<img>` внутри общей обёртки MediaBlockShell. «Редактировать» =
 * заменить ссылку на картинку (промпт), «удалить» = снести узел. Подпись
 * правится инлайн в шелле.
 */

import { useCallback } from "react";
import type { NodeViewProps } from "@tiptap/react";

import { MediaBlockShell } from "./MediaBlockShell";

export function ImageBlockView({
  node,
  editor,
  getPos,
  updateAttributes,
  selected,
}: NodeViewProps) {
  const editable = editor.isEditable;

  const onEdit = useCallback(() => {
    if (!editable) return;
    const next = window.prompt(
      "Ссылка на изображение:",
      String(node.attrs.src ?? "")
    );
    if (next && next.trim()) updateAttributes({ src: next.trim() });
  }, [editable, node.attrs.src, updateAttributes]);

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
      editLabel="Заменить картинку"
      caption={String(node.attrs.caption ?? "")}
      onCaptionChange={(value) => updateAttributes({ caption: value })}
    >
      <img
        className="media-block-img"
        src={String(node.attrs.src ?? "")}
        alt={String(node.attrs.alt ?? "")}
        title={node.attrs.title ? String(node.attrs.title) : undefined}
      />
    </MediaBlockShell>
  );
}
