/**
 * ============================================
 *  editor/MobileFormatBar.tsx — панель форматирования на телефоне
 * ============================================
 *
 * Screen-m-editor: Ж, К, Н, •, 1., H, «/». Кнопки 44 px, активная на #EEEEEB (--sunken).
 * Панель прилипает к верху экранной клавиатуры (visualViewport) и учитывает нижнюю
 * safe-area; без клавиатуры остаётся внизу экрана. Кнопки не отбирают фокус у текста,
 * чтобы клавиатура не закрывалась.
 *
 * «Н» (третья буква макета) сделана как «Маркер» — как на компьютере; уточняется у владелицы.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { HIGHLIGHT_COLORS, toggleHighlight } from "./textCommands";
import { keyboardInset } from "../../lib/keyboardInset";

interface Props {
  editor: TiptapEditor;
  /** «/» — открыть меню блоков (вставляет «/» в текст). */
  onSlash: () => void;
}

export function MobileFormatBar({ editor, onSlash }: Props) {
  const [kb, setKb] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setKb(keyboardInset());
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  const keep = (e: React.SyntheticEvent) => e.preventDefault();
  const items: { label: string; aria: string; active: boolean; run: () => void }[] = [
    { label: "Ж", aria: "Жирный", active: editor.isActive("bold"), run: () => editor.chain().focus().toggleBold().run() },
    { label: "К", aria: "Курсив", active: editor.isActive("italic"), run: () => editor.chain().focus().toggleItalic().run() },
    { label: "Н", aria: "Маркер", active: editor.isActive("highlight"), run: () => toggleHighlight(editor, HIGHLIGHT_COLORS[0]) },
    { label: "•", aria: "Маркированный список", active: editor.isActive("bulletList"), run: () => editor.chain().focus().toggleBulletList().run() },
    { label: "1.", aria: "Нумерованный список", active: editor.isActive("orderedList"), run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: "H", aria: "Заголовок", active: editor.isActive("heading"), run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: "/", aria: "Вставить блок", active: false, run: onSlash },
  ];

  // В портале: у предков страницы есть анимация с transform, из-за неё fixed считался бы от неё, а не от экрана.
  return createPortal(
    <div className={`c-mfmt${kb > 0 ? " kb" : ""}`} style={{ bottom: kb }} role="toolbar" aria-label="Форматирование">
      {items.map((i) => (
        <button
          key={i.aria}
          type="button"
          className={i.active ? "on" : ""}
          aria-label={i.aria}
          aria-pressed={i.aria === "Вставить блок" ? undefined : i.active}
          onPointerDown={keep}
          onMouseDown={keep}
          onClick={i.run}
        >
          {i.label}
        </button>
      ))}
    </div>,
    document.body
  );
}
