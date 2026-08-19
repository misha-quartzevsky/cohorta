/**
 * ============================================
 *  editor/textCommands.ts — formatting commands
 * ============================================
 *
 * Framework-agnostic helpers shared by the selection bubble toolbar
 * (BubbleToolbar) and the «…» popover (TextMenu): highlight colour
 * palette, the Notion-style mark/block item lists and the two editing
 * commands (link + highlight) that both menus trigger.
 */

import type { Editor as TiptapEditor } from "@tiptap/core";
import type { LucideIcon } from "lucide-react";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  Pilcrow,
  Quote,
  Strikethrough,
} from "lucide-react";

export const HIGHLIGHT_COLORS = ["#FFF3A1", "#D3F9A8", "#B9E0FF", "#FFD6E8"];

export interface TextMenuItem {
  title: string;
  icon: LucideIcon;
  run: (editor: TiptapEditor) => void;
  isActive?: (editor: TiptapEditor) => boolean;
}

export const TEXT_MARK_ITEMS: TextMenuItem[] = [
  {
    title: "Жирный",
    icon: Bold,
    run: (e) => void e.chain().focus().toggleBold().run(),
    isActive: (e) => e.isActive("bold"),
  },
  {
    title: "Курсив",
    icon: Italic,
    run: (e) => void e.chain().focus().toggleItalic().run(),
    isActive: (e) => e.isActive("italic"),
  },
  {
    title: "Зачёркнутый",
    icon: Strikethrough,
    run: (e) => void e.chain().focus().toggleStrike().run(),
    isActive: (e) => e.isActive("strike"),
  },
  {
    title: "Код",
    icon: Code,
    run: (e) => void e.chain().focus().toggleCode().run(),
    isActive: (e) => e.isActive("code"),
  },
];

export const TEXT_BLOCK_ITEMS: TextMenuItem[] = [
  {
    title: "Заголовок 1",
    icon: Heading1,
    run: (e) => void e.chain().focus().toggleHeading({ level: 1 }).run(),
    isActive: (e) => e.isActive("heading", { level: 1 }),
  },
  {
    title: "Заголовок 2",
    icon: Heading2,
    run: (e) => void e.chain().focus().toggleHeading({ level: 2 }).run(),
    isActive: (e) => e.isActive("heading", { level: 2 }),
  },
  {
    title: "Заголовок 3",
    icon: Heading3,
    run: (e) => void e.chain().focus().toggleHeading({ level: 3 }).run(),
    isActive: (e) => e.isActive("heading", { level: 3 }),
  },
  {
    title: "Обычный текст",
    icon: Pilcrow,
    run: (e) => void e.chain().focus().setParagraph().run(),
    isActive: (e) => e.isActive("paragraph"),
  },
  {
    title: "Маркированный список",
    icon: List,
    run: (e) => void e.chain().focus().toggleBulletList().run(),
    isActive: (e) => e.isActive("bulletList"),
  },
  {
    title: "Нумерованный список",
    icon: ListOrdered,
    run: (e) => void e.chain().focus().toggleOrderedList().run(),
    isActive: (e) => e.isActive("orderedList"),
  },
  {
    title: "Чек-лист",
    icon: ListChecks,
    run: (e) => void e.chain().focus().toggleTaskList().run(),
    isActive: (e) => e.isActive("taskList"),
  },
  {
    title: "Цитата",
    icon: Quote,
    run: (e) => void e.chain().focus().toggleBlockquote().run(),
    isActive: (e) => e.isActive("blockquote"),
  },
];

/** Toggle the `highlight` mark of a specific colour on the selection. */
export function toggleHighlight(editor: TiptapEditor, color: string): void {
  if (editor.isActive("highlight", { color })) {
    editor.chain().focus().unsetHighlight().run();
  } else {
    editor.chain().focus().setHighlight({ color }).run();
  }
}

/** Prompt-link the current selection (or unlink when emptied). */
export function handleLink(editor: TiptapEditor): void {
  const previous = String(editor.getAttributes("link").href ?? "");
  const url = window.prompt("Ссылка:", previous || "https://");
  if (url === null) {
    return;
  }
  if (url.trim() === "") {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  editor
    .chain()
    .focus()
    .extendMarkRange("link")
    .setLink({ href: url.trim() })
    .run();
}
