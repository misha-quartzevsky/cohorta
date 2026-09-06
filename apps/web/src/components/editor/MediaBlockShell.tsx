/**
 * ============================================
 *  MediaBlockShell.tsx — единая обёртка встроенного медиа-блока
 * ============================================
 *
 * Один контейнер для картинки, схемы и формулы в редакторе (DESIGN.md §6
 * «Вставленные медиа»): рамка + скругление + лёгкая тень, панель иконок
 * «редактировать / удалить» по hover / focus-within, и — для картинки и
 * схемы — необязательная подпись под медиа.
 *
 * Раньше картинка была голым `<img>`, а схема/формула — карточкой со всегда
 * видимой панелью: два разных оформления для похожих по смыслу блоков.
 */

import { type ReactNode } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import { Pencil, Trash2 } from "lucide-react";

interface Props {
  /** Само медиа (img / рендер формулы). */
  children: ReactNode;
  editable: boolean;
  selected: boolean;
  onEdit: () => void;
  onDelete: () => void;
  /** Заголовок кнопки редактирования («Заменить картинку» / «Редактировать схему» …). */
  editLabel: string;
  /** Подпись: undefined — блок без подписи (формула). */
  caption?: string;
  onCaptionChange?: (value: string) => void;
  /** Двойной клик по блоку (формула открывает редактор). */
  onDoubleClick?: () => void;
  className?: string;
}

export function MediaBlockShell({
  children,
  editable,
  selected,
  onEdit,
  onDelete,
  editLabel,
  caption,
  onCaptionChange,
  onDoubleClick,
  className,
}: Props) {
  const hasCaption = caption !== undefined;

  return (
    <NodeViewWrapper
      className={
        "media-block" +
        (editable ? " editable" : "") +
        (selected ? " is-selected" : "") +
        (className ? ` ${className}` : "")
      }
      onDoubleClick={onDoubleClick}
    >
      <div className="media-block-inner">
        <div className="media-block-media">{children}</div>

        {editable && (
          <div
            className="media-block-toolbar"
            contentEditable={false}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="media-block-btn"
              onClick={onEdit}
              title={editLabel}
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              className="media-block-btn danger"
              onClick={onDelete}
              title="Удалить"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {hasCaption &&
        (editable ? (
          <div className="media-block-caption-wrap" contentEditable={false}>
            <input
              type="text"
              className="media-block-caption is-editable"
              placeholder="Подпись (необязательно)"
              value={caption}
              onChange={(e) => onCaptionChange?.(e.target.value)}
            />
          </div>
        ) : (
          caption.trim() && (
            <div className="media-block-caption">{caption}</div>
          )
        ))}
    </NodeViewWrapper>
  );
}
