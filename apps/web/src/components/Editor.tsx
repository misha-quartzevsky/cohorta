/**
 * ============================================
 *  Editor.tsx — Tiptap editor for the lecture card
 * ============================================
 *
 * Tooling:
 *  - slash menu «/» (block commands + image insert)
 *  - bubble menu on text selection (bold / italic / link / highlight)
 *  - floating «+» button on empty blocks (opens the slash menu)
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { createPortal } from "react-dom";
import type { Editor as TiptapEditor } from "@tiptap/core";
import type { EditorView } from "@tiptap/pm/view";
import {
  EditorContent,
  useEditor,
} from "@tiptap/react";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import type { BubbleMenuPluginProps } from "@tiptap/extension-bubble-menu";
import type { FloatingMenuPluginProps } from "@tiptap/extension-floating-menu";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import ImageExtension from "@tiptap/extension-image";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import type { UploadedImage } from "../services/lectureService";
import {
  Bold,
  Code,
  Eraser,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  MoreHorizontal,
  Pilcrow,
  Plus,
  Quote,
  RemoveFormatting,
  Strikethrough,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createSlashMenu } from "./SlashMenu";

import { SpeechInterimMark } from "../lib/speechMark";
import { useSpeech } from "../lib/speechContext";
import { AudioBlock } from "./audio/AudioBlock";
import { MathBlock } from "./math/MathBlock";
import { SketchBlock } from "./sketch/SketchBlock";
import { mathBus, type MathEditRequest } from "./math/mathBus";
import { sketchBus, setSketchUploader, type SketchRequest } from "./sketch/sketchBus";
import MathEditorOverlay from "./math/MathEditorOverlay";
import SketchModal from "./sketch/SketchModal";

const HIGHLIGHT_COLORS = ["#FFF3A1", "#D3F9A8", "#B9E0FF", "#FFD6E8"];

/** Изображения из drag&drop / буфера обмена (только image/*). */
function imageFilesFromData(data: DataTransfer | null): File[] {
  return Array.from(data?.files ?? []).filter((f) =>
    f.type.startsWith("image/")
  );
}

/**
 * Items for the «…» text menu (reference formatting of the current selection,
 * like Notion does for inline text). Commands apply to the whole selection
 * thanks to ProseMirror's per-node target-rules.
 */
interface TextMenuItem {
  title: string;
  icon: LucideIcon;
  run: (editor: TiptapEditor) => void;
  isActive?: (editor: TiptapEditor) => boolean;
}

const TEXT_MARK_ITEMS: TextMenuItem[] = [
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

const TEXT_BLOCK_ITEMS: TextMenuItem[] = [
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

interface EditorProps {
  value: string;
  onUpdate: (content: string) => void;
  placeholder?: string;
  className?: string;
  /**
   * Когда задан — картинки грузятся по-настоящему в PocketBase
   * (drag&drop, вставка из буфера и пункт «Картинка» в slash-меню).
   * Без него «Картинка» фолбэчит на вставку по URL.
   */
  onUploadImages?: (files: File[]) => Promise<UploadedImage[]>;
}

export default function Editor({
  value,
  onUpdate,
  placeholder,
  className,
  onUploadImages,
}: EditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Куда вставить картинку после выбора файла (позиция после удаления "/").
  const pendingPosRef = useRef<number | null>(null);
  const onUploadRef = useRef(onUploadImages);
  const insertImagesRef = useRef<(urls: string[], pos?: number | null) => void>(
    () => {}
  );

  // Голосовой ввод: редактор становится целю вставки распознанного текста.
  const { registerEditor, unregisterEditor } = useSpeech();

  // Единственные overlay/модалка для формул и схем (см. mathBus/sketchBus).
  const [mathReq, setMathReq] = useState<MathEditRequest | null>(null);
  const [sketchReq, setSketchReq] = useState<SketchRequest | null>(null);

  // Всегда держим актуальный колбэк загрузки, не пересоздавая остальное.
  useEffect(() => {
    onUploadRef.current = onUploadImages;
  }, [onUploadImages]);

  // Пункт «Картинка» в slash-меню: файловый пикер или фолбэк на URL-промпт.
  const chooseImage = useCallback(
    (activeEditor: TiptapEditor, range: { from: number; to: number }) => {
      activeEditor.chain().focus().deleteRange(range).run();
      if (!onUploadRef.current) {
        const url = window.prompt("Ссылка на изображение:");
        if (url) {
          activeEditor.chain().focus().setImage({ src: url.trim() }).run();
        }
        return;
      }
      pendingPosRef.current = activeEditor.state.selection.from;
      fileInputRef.current?.click();
    },
    []
  );

  // Пункт «Формула»: открывает overlay MathLive (блок появится при commit).
  const insertMath = useCallback(
    (activeEditor: TiptapEditor, range: { from: number; to: number }) => {
      activeEditor.chain().focus().deleteRange(range).run();
      mathBus.open({
        editor: activeEditor,
        pos: activeEditor.state.selection.from,
        latex: "",
      });
    },
    []
  );

  // Пункт «Схема»: открывает модалку Excalidraw (схема появится при save).
  const insertSketch = useCallback(
    (activeEditor: TiptapEditor, range: { from: number; to: number }) => {
      activeEditor.chain().focus().deleteRange(range).run();
      sketchBus.open({
        editor: activeEditor,
        pos: activeEditor.state.selection.from,
        scene: null,
        onUploadImages: onUploadRef.current,
      });
    },
    []
  );

  const slashMenu = useMemo(
    () => createSlashMenu({ chooseImage, insertMath, insertSketch }),
    [chooseImage, insertMath, insertSketch]
  );

  // Extensions must be referentially stable: useEditor compares them by
  // reference on every render (shouldRerenderOnTransaction re-renders on each
  // transaction) and calls editor.setOptions on mismatch.
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // Link уже включён в StarterKit v3 — настраиваем здесь,
        // отдельное подключение создаёт дубль имени 'link'.
        link: {
          openOnClick: false,
          shouldAutoLink: () => true,
          linkOnPaste: true,
          defaultProtocol: "https",
        },
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") {
            return "Заголовок…";
          }
          return placeholder || "Начните писать… Нажмите «/» для команд";
        },
      }),
      ImageExtension.configure({ allowBase64: true }),
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      // Advanced Capture Tools: речь, аудио, формулы, схемы.
      SpeechInterimMark,
      AudioBlock,
      MathBlock,
      SketchBlock,
      slashMenu,
    ],
    [slashMenu, placeholder]
  );

  // Картинки из drag&drop / вставки из буфера забираем только когда есть
  // загрузчик (иначе оставляем дефолтное поведение браузера).
  const handleDrop = useCallback(
    (view: EditorView, event: DragEvent) => {
      if (!onUploadRef.current) return false;
      const files = imageFilesFromData(event.dataTransfer);
      if (!files.length) return false;
      event.preventDefault();
      const coords = view.posAtCoords({
        left: event.clientX,
        top: event.clientY,
      });
      const pos = coords ? coords.pos : null;
      void (async () => {
        try {
          const uploaded = await onUploadRef.current!(files);
          insertImagesRef.current(uploaded.map((image) => image.url), pos);
        } catch (err) {
          console.error("Ошибка загрузки изображения:", err);
        }
      })();
      return true;
    },
    []
  );

  const handlePaste = useCallback(
    (view: EditorView, event: ClipboardEvent) => {
      if (!onUploadRef.current) return false;
      const files = imageFilesFromData(event.clipboardData);
      if (!files.length) return false;
      event.preventDefault();
      const pos = view.state.selection.from;
      void (async () => {
        try {
          const uploaded = await onUploadRef.current!(files);
          insertImagesRef.current(uploaded.map((image) => image.url), pos);
        } catch (err) {
          console.error("Ошибка загрузки изображения:", err);
        }
      })();
      return true;
    },
    []
  );

  const editorProps = useMemo(
    () => ({
      attributes: {
        class: "prose tiptap-editor",
        spellcheck: "true",
      },
      handleDrop,
      handlePaste,
    }),
    [handleDrop, handlePaste]
  );

  const editor = useEditor({
    extensions,
    content: value || "<p><br></p>",
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor: current }) => {
      onUpdate(current.getHTML());
    },
    editorProps,
  });

  // Вставка загруженных картинок в редактор. Позиция по умолчанию —
  // текущий курсор; при drag&drop — координаты мыши.
  const insertImages = (urls: string[], pos?: number | null) => {
    const targetPos = pos ?? editor.state.selection.from;
    const nodes = urls.map((src) => ({ type: "image", attrs: { src } }));
    editor.chain().focus().insertContentAt(targetPos, nodes).run();
  };
  insertImagesRef.current = insertImages;

  // Выбор файла в скрытом input.
  const handleFilesChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const files = Array.from(input.files ?? []);
    input.value = "";
    const upload = onUploadRef.current;
    if (!files.length || !upload) return;
    try {
      const uploaded = await upload(files);
      const pos = pendingPosRef.current;
      pendingPosRef.current = null;
      insertImagesRef.current(uploaded.map((image) => image.url), pos);
    } catch (err) {
      console.error("Ошибка загрузки изображения:", err);
    }
  };

  // Focus the editor on mount.
  useEffect(() => {
    editor.commands.focus();
  }, [editor]);

  // Регистрируем редактор как цель диктовки (SpeechProvider) — это нужно
  // и для кнопки микрофона в шапке, и для вставки распознанного текста.
  useEffect(() => {
    if (!editor) return;
    registerEditor(editor);
    return () => unregisterEditor(editor);
  }, [editor, registerEditor, unregisterEditor]);

  // Подписки единственных overlay/модалки (формулы MathLive, схемы Excalidraw).
  useEffect(() => mathBus.subscribe(setMathReq), []);
  useEffect(() => sketchBus.subscribe(setSketchReq), []);

  // Актуальный загрузчик файлов для ре-эдита схем из NodeView.
  useEffect(() => {
    setSketchUploader(onUploadImages);
  }, [onUploadImages]);

  // Sync content when `value` changes from outside.
  useEffect(() => {
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  // The «…» text menu (Notion-style formatting of the selection).
  const [textMenuOpen, setTextMenuOpen] = useState(false);
  const [textMenuPos, setTextMenuPos] = useState<{ top: number; left: number } | null>(
    null
  );
  const textMenuRef = useRef<HTMLDivElement | null>(null);

  // Close the menu on outside click / Escape.
  useEffect(() => {
    if (!textMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (
        textMenuRef.current &&
        !textMenuRef.current.contains(e.target as Node)
      ) {
        setTextMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTextMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [textMenuOpen]);

  const openTextMenu = () => {
    const coords = editor.view.coordsAtPos(editor.state.selection.from);
    const menuHeight = Math.min(380, Math.round(window.innerHeight * 0.6));
    const fitsBelow = coords.bottom + 6 + menuHeight <= window.innerHeight;
    setTextMenuPos({
      top: fitsBelow ? coords.bottom + 6 : Math.max(8, coords.top - menuHeight - 6),
      left: Math.min(coords.left, window.innerWidth - 250),
    });
    setTextMenuOpen(true);
  };

  const runTextCommand = (action: () => void) => {
    setTextMenuOpen(false);
    action();
  };

  const renderTextMenuItem = (item: TextMenuItem) => {
    const Icon = item.icon;
    return (
      <button
        key={item.title}
        type="button"
        className={`text-menu-item${item.isActive?.(editor) ? " active" : ""}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => runTextCommand(() => item.run(editor))}
      >
        <span className="slash-icon">
          <Icon size={15} />
        </span>
        {item.title}
      </button>
    );
  };

  const toggleHighlight = (color: string) => {
    if (editor.isActive("highlight", { color })) {
      editor.chain().focus().unsetHighlight().run();
    } else {
      editor.chain().focus().setHighlight({ color }).run();
    }
  };

  const handleLink = () => {
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
  };

  // shouldShow must be referentially stable: @tiptap/react menus dispatch an
  // `updateOptions` transaction whenever the prop changes, and with
  // shouldRerenderOnTransaction every transaction re-renders the component —
  // unstable callbacks create a render → dispatch → render loop.
  const shouldShowBubble = useCallback<
    NonNullable<BubbleMenuPluginProps["shouldShow"]>
  >(({ editor: current, state }) => current.isEditable && !state.selection.empty, []);

  const shouldShowFloating = useCallback<
    NonNullable<FloatingMenuPluginProps["shouldShow"]>
  >(
    ({ editor: current, state }) =>
      current.isEditable &&
      current.isFocused &&
      state.selection.empty &&
      state.selection.$from.parent.content.size === 0,
    []
  );

  // The floating «+» opens the slash menu by inserting «/».
  const openSlashMenu = () => {
    editor.chain().focus().insertContent("/").run();
  };

  return (
    <div className={`tiptap-wrapper ${className || ""}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleFilesChange}
      />
      <BubbleMenu
        editor={editor}
        shouldShow={shouldShowBubble}
        className="bubble-menu"
      >
        <button
          type="button"
          className={`bubble-btn${editor.isActive("bold") ? " active" : ""}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Жирный"
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          className={`bubble-btn${editor.isActive("italic") ? " active" : ""}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Курсив"
        >
          <Italic size={15} />
        </button>
        <button
          type="button"
          className={`bubble-btn${editor.isActive("link") ? " active" : ""}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleLink}
          title="Ссылка"
        >
          <Link2 size={15} />
        </button>
        <span className="bubble-sep" />
        {HIGHLIGHT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`bubble-swatch${
              editor.isActive("highlight", { color }) ? " active" : ""
            }`}
            style={{ background: color }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleHighlight(color)}
            title={`Выделить ${color}`}
          />
        ))}
        {editor.isActive("highlight") && (
          <>
            <span className="bubble-sep" />
            <button
              type="button"
              className="bubble-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().unsetHighlight().run()}
              title="Снять выделение"
            >
              <Eraser size={15} />
            </button>
          </>
        )}
        <span className="bubble-sep" />
        <button
          type="button"
          className={`bubble-btn${textMenuOpen ? " active" : ""}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={openTextMenu}
          title="Ещё"
        >
          <MoreHorizontal size={15} />
        </button>
      </BubbleMenu>

      {textMenuOpen &&
        textMenuPos &&
        createPortal(
          <div
            ref={textMenuRef}
            className="text-menu"
            style={{ top: textMenuPos.top, left: textMenuPos.left }}
          >
            <div className="text-menu-label">Форматирование</div>
            {TEXT_MARK_ITEMS.map(renderTextMenuItem)}
            <div className="text-menu-label">Ссылка</div>
            <button
              type="button"
              className={`text-menu-item${editor.isActive("link") ? " active" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runTextCommand(handleLink)}
            >
              <span className="slash-icon">
                <Link2 size={15} />
              </span>
              Ссылка
            </button>
            <div className="text-menu-label">Выделение</div>
            <div className="text-menu-swatch-row">
              {HIGHLIGHT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`bubble-swatch${
                    editor.isActive("highlight", { color }) ? " active" : ""
                  }`}
                  style={{ background: color }}
                  title={`Выделить ${color}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => runTextCommand(() => toggleHighlight(color))}
                />
              ))}
              <button
                type="button"
                className="text-menu-eraser"
                title="Снять выделение"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() =>
                  runTextCommand(() =>
                    editor.chain().focus().unsetHighlight().run()
                  )
                }
              >
                <Eraser size={13} />
              </button>
            </div>
            <div className="text-menu-label">Блоки</div>
            {TEXT_BLOCK_ITEMS.map(renderTextMenuItem)}
            <span className="text-menu-sep" />
            <button
              type="button"
              className="text-menu-item"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                runTextCommand(() =>
                  editor.chain().focus().unsetAllMarks().run()
                )
              }
            >
              <span className="slash-icon">
                <RemoveFormatting size={15} />
              </span>
              Очистить форматирование
            </button>
          </div>,
          document.body
        )}

      <FloatingMenu
        editor={editor}
        shouldShow={shouldShowFloating}
      >
        <button
          type="button"
          className="floating-plus"
          title="Вставить блок"
          onMouseDown={(e) => e.preventDefault()}
          onClick={openSlashMenu}
        >
          <Plus size={15} />
        </button>
      </FloatingMenu>

      <EditorContent editor={editor} />

      {mathReq && (
        <MathEditorOverlay request={mathReq} onClose={() => mathBus.close()} />
      )}
      {sketchReq && (
        <SketchModal request={sketchReq} onClose={() => sketchBus.close()} />
      )}
    </div>
  );
}
