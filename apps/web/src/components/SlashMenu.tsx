/**
 * ============================================
 *  SlashMenu.tsx — «/» suggestion for the editor
 * ============================================
 *
 * Block commands + image insert via a popup that opens
 * when the user types «/» at the start of a block.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import type { ComponentType } from "react";
import type { Editor, Range } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import type {
  SuggestionKeyDownProps,
  SuggestionProps,
} from "@tiptap/suggestion";
import {
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
} from "lucide-react";

interface SlashItem {
  title: string;
  description: string;
  icon: ComponentType<{ size?: number | string }>;
  command: (editor: Editor, range: Range) => void;
}

function askImageUrl(editor: Editor, range: Range) {
  const url = window.prompt("Ссылка на изображение:");
  if (!url) {
    return;
  }
  editor.chain().focus().deleteRange(range).setImage({ src: url.trim() }).run();
}

/** Опции создания slash-меню (см. createSlashMenu ниже). */
export interface SlashMenuOptions {
  /**
   * Кастомная команда «Картинка» (внутренняя загрузка файла в PB).
   * Когда задана — пункт меню открывает выбор файла; иначе фолбэк на URL-промпт.
   */
  chooseImage?: (editor: Editor, range: Range) => void;
}

const SLASH_ITEMS: SlashItem[] = [
  {
    title: "Заголовок 1",
    description: "Крупный раздел",
    icon: Heading1,
    command: (e, r) =>
      e.chain().focus().deleteRange(r).setHeading({ level: 1 }).run(),
  },
  {
    title: "Заголовок 2",
    description: "Средний раздел",
    icon: Heading2,
    command: (e, r) =>
      e.chain().focus().deleteRange(r).setHeading({ level: 2 }).run(),
  },
  {
    title: "Заголовок 3",
    description: "Малый раздел",
    icon: Heading3,
    command: (e, r) =>
      e.chain().focus().deleteRange(r).setHeading({ level: 3 }).run(),
  },
  {
    title: "Обычный текст",
    description: "Просто абзац",
    icon: Pilcrow,
    command: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run(),
  },
  {
    title: "Маркированный список",
    description: "Список с точками",
    icon: List,
    command: (e, r) =>
      e.chain().focus().deleteRange(r).toggleBulletList().run(),
  },
  {
    title: "Нумерованный список",
    description: "Список с цифрами",
    icon: ListOrdered,
    command: (e, r) =>
      e.chain().focus().deleteRange(r).toggleOrderedList().run(),
  },
  {
    title: "Чек-лист",
    description: "Список задач",
    icon: ListChecks,
    command: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run(),
  },
  {
    title: "Цитата",
    description: "Выделенная цитата",
    icon: Quote,
    command: (e, r) =>
      e.chain().focus().deleteRange(r).toggleBlockquote().run(),
  },
  {
    title: "Блок кода",
    description: "Моноширинный блок",
    icon: Code2,
    command: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run(),
  },
  {
    title: "Разделитель",
    description: "Горизонтальная линия",
    icon: Minus,
    command: (e, r) =>
      e.chain().focus().deleteRange(r).setHorizontalRule().run(),
  },
  {
    title: "Картинка",
    description: "Вставить по ссылке",
    icon: ImageIcon,
    command: askImageUrl,
  },
];

interface SlashMenuListProps {
  items: SlashItem[];
  command: (item: SlashItem) => void;
}

interface SlashMenuListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

/* oxlint-disable react/only-export-components */
const SlashMenuList = forwardRef<SlashMenuListRef, SlashMenuListProps>(
  (props, ref) => {
    const [selected, setSelected] = useState(0);
    const { items } = props;

    const select = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) {
          props.command(item);
        }
      },
      [items, props]
    );

    useEffect(() => {
      setSelected(0);
    }, [items]);

    useImperativeHandle(
      ref,
      () => ({
        onKeyDown: ({ event }: SuggestionKeyDownProps) => {
          if (items.length === 0) {
            return false;
          }
          if (event.key === "ArrowUp") {
            setSelected(
              (current) => (current + items.length - 1) % items.length
            );
            return true;
          }
          if (event.key === "ArrowDown") {
            setSelected((current) => (current + 1) % items.length);
            return true;
          }
          if (event.key === "Enter") {
            select(selected);
            return true;
          }
          return false;
        },
      }),
      [items, selected, select]
    );

    if (items.length === 0) {
      return <div className="slash-menu-empty">Ничего не найдено</div>;
    }

    return (
      <div className="slash-menu">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              type="button"
              className={`slash-menu-item${
                index === selected ? " selected" : ""
              }`}
              onMouseEnter={() => setSelected(index)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(index)}
            >
              <span className="slash-icon">
                <Icon size={15} />
              </span>
              <span>
                <span className="slash-title">{item.title}</span>
                <span className="slash-desc">{item.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    );
  }
);

SlashMenuList.displayName = "SlashMenuList";

/**
 * Build the «/» suggestion extension. Create one per editor instance
 * (the plugin key must be unique).
 *
 * @param opts.chooseImage — когда задан, пункт «Картинка» вызывает его
 *                           вместо URL-промпта (загрузка файла в PB).
 */
export function createSlashMenu(opts?: SlashMenuOptions): Extension {
  const chooseImage = opts?.chooseImage;
  const items: SlashItem[] = chooseImage
    ? SLASH_ITEMS.map((item) =>
        item.title === "Картинка"
          ? { ...item, command: chooseImage }
          : item
      )
    : SLASH_ITEMS;

  return Extension.create({
    name: "slashMenu",
    addProseMirrorPlugins() {
      const editor = this.editor;
      return [
        Suggestion<SlashItem, SlashItem>({
          editor,
          char: "/",
          startOfLine: true,
          allow: ({ state, range }) => {
            if (!editor.isEditable) {
              return false;
            }
            const $from = state.doc.resolve(range.from);
            return $from.parent.type.name !== "codeBlock";
          },
          items: ({ query }) => {
            const q = query.toLowerCase();
            return items.filter(
              (item) =>
                item.title.toLowerCase().includes(q) ||
                item.description.toLowerCase().includes(q)
            );
          },
          command: ({ editor: current, range, props: item }) => {
            item.command(current, range);
          },
          render: () => {
            let component: ReactRenderer<
              SlashMenuListRef,
              SlashMenuListProps
            > | null = null;
            let unmount: (() => void) | null = null;

            const listProps = (
              props: SuggestionProps<SlashItem, SlashItem>
            ): SlashMenuListProps => ({
              items: props.items,
              command: (item) => props.command(item),
            });

            return {
              onStart: (props) => {
                component = new ReactRenderer(SlashMenuList, {
                  props: listProps(props),
                  editor: props.editor,
                });
                unmount = props.mount(component.element);
              },
              onUpdate: (props) => {
                component?.updateProps(listProps(props));
              },
              onKeyDown: (props) => {
                if (props.event.key === "Escape") {
                  unmount?.();
                  unmount = null;
                  return true;
                }
                return component?.ref?.onKeyDown(props) ?? false;
              },
              onExit: () => {
                unmount?.();
                unmount = null;
                component?.destroy();
                component = null;
              },
            };
          },
        }),
      ];
    },
  });
}
