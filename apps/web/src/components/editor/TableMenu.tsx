/**
 * ============================================
 *  editor/TableMenu.tsx — table quick toolbar
 * ============================================
 *
 * Appears when the cursor/selection is inside a table (even with an empty
 * selection): add/remove rows & columns, and delete the whole table.
 * Rendered via BubbleMenu; `shouldShow` must stay referentially stable to
 * avoid the @tiptap/react updateOptions loop (see Editor.tsx notes).
 */
import { useCallback, type ReactNode } from "react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import type { BubbleMenuPluginProps } from "@tiptap/extension-bubble-menu";
import {
  ArrowDownToLine,
  ArrowRightToLine,
  Columns2,
  Rows2,
  Trash2,
} from "lucide-react";

interface Props {
  editor: TiptapEditor;
}

function TableBtn({
  label,
  title,
  onClick,
  danger,
  children,
}: {
  label: string;
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`table-menu-btn${danger ? " danger" : ""}`}
      title={title}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function TableMenu({ editor }: Props) {
  const shouldShow = useCallback<
    NonNullable<BubbleMenuPluginProps["shouldShow"]>
  >(
    ({ editor: current }) => current.isEditable && current.isActive("table"),
    []
  );

  return (
    <BubbleMenu editor={editor} shouldShow={shouldShow} className="table-menu">
      <TableBtn
        label="Добавить строку ниже"
        title="Добавить строку ниже"
        onClick={() => editor.chain().focus().addRowAfter().run()}
      >
        <ArrowDownToLine size={15} />
      </TableBtn>
      <TableBtn
        label="Добавить столбец справа"
        title="Добавить столбец справа"
        onClick={() => editor.chain().focus().addColumnAfter().run()}
      >
        <ArrowRightToLine size={15} />
      </TableBtn>
      <span className="table-menu-sep" />
      <TableBtn
        label="Удалить строку"
        title="Удалить строку"
        danger
        onClick={() => editor.chain().focus().deleteRow().run()}
      >
        <Rows2 size={15} />
      </TableBtn>
      <TableBtn
        label="Удалить столбец"
        title="Удалить столбец"
        danger
        onClick={() => editor.chain().focus().deleteColumn().run()}
      >
        <Columns2 size={15} />
      </TableBtn>
      <span className="table-menu-sep" />
      <TableBtn
        label="Удалить таблицу"
        title="Удалить таблицу"
        danger
        onClick={() => editor.chain().focus().deleteTable().run()}
      >
        <Trash2 size={15} />
      </TableBtn>
    </BubbleMenu>
  );
}
