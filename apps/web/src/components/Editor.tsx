/**
 * ============================================
 *  Editor.tsx — Tiptap editor for the lecture card
 * ============================================
 *
 * Composition-only entry point: assembles the Tiptap editor, its extensions
 * and the surrounding UX. The formatting menus and the upload logic live in
 * dedicated modules:
 *   - editor/BubbleToolbar.tsx  — quick selection bubble (bold/link/etc.)
 *   - editor/TextMenu.tsx       — extended «…» popover
 *   - editor/useImageUpload.ts  — image upload plumbing (drop/paste/picker)
 *   - editor/textCommands.ts    — shared formatting commands/items
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { FloatingMenu } from "@tiptap/react/menus";
import type { BubbleMenuPluginProps } from "@tiptap/extension-bubble-menu";
import type { FloatingMenuPluginProps } from "@tiptap/extension-floating-menu";
import type { EditorView } from "@tiptap/pm/view";
import { TextSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import {
  Table as TableExtension,
  TableRow as TableRowExt,
  TableCell as TableCellExt,
  TableHeader as TableHeaderExt,
} from "@tiptap/extension-table";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { GripVertical, Plus } from "lucide-react";
import type { UploadedImage } from "../services/lectureService";

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
import { pastedMarkdownHtml } from "../lib/markdownTable";

import { ImageBlock } from "./editor/ImageBlock";
import { NodeTimestamp } from "./editor/NodeTimestamp";
import { useImageUpload } from "./editor/useImageUpload";
import { BubbleToolbar } from "./editor/BubbleToolbar";
import { TextMenu } from "./editor/TextMenu";
import { TableMenu } from "./editor/TableMenu";

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
  /** Ставить фокус в редактор при монтировании (по умолчанию — да). */
  autoFocus?: boolean;
  /**
   * Координаты клика (viewport), которым редактор был смонтирован из статичного
   * просмотра — каретка встаёт в эту точку. Читается один раз при mount.
   */
  selectionCoords?: { left: number; top: number } | null;
}

export default function Editor({
  value,
  onUpdate,
  placeholder,
  className,
  onUploadImages,
  autoFocus = true,
  selectionCoords,
}: EditorProps) {
  // Захватываем координаты клика один раз — последующие изменения игнорируем.
  const selectionCoordsRef = useRef(selectionCoords);
  // Upload plumbing: refs, drop/paste, file picker (see editor/useImageUpload).
  const {
    fileInputRef,
    onUploadRef,
    insertImagesRef,
    chooseImage,
    handleDrop,
    handlePaste,
    handleFilesChange,
  } = useImageUpload(onUploadImages);

  // Голосовой ввод: редактор становится целью вставки распознанного текста
  // (The Bridge) + чтение состояния записи для индикаторов на «листе».
  const { registerEditor, unregisterEditor, supported, audioOnly, recording, toggle } =
    useSpeech();
  const canCapture = supported || audioOnly;

  // Единственные overlay/модалки для формул и схем (см. mathBus/sketchBus).
  const [mathReq, setMathReq] = useState<MathEditRequest | null>(null);
  const [sketchReq, setSketchReq] = useState<SketchRequest | null>(null);

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
    [onUploadRef]
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
        // Заметный индикатор позиции вставки при перетаскивании блока.
        dropcursor: { color: "var(--c-lilac)", width: 2 },
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
      ImageBlock.configure({ allowBase64: true }),
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      // Tables (editor + Obsidian paste). resizable adds column drag handles.
      TableExtension.configure({ resizable: true }),
      TableRowExt,
      TableHeaderExt,
      TableCellExt,
      // Advanced Capture Tools: речь, аудио, формулы, схемы.
      SpeechInterimMark,
      NodeTimestamp,
      AudioBlock,
      MathBlock,
      SketchBlock,
      slashMenu,
    ],
    [slashMenu, placeholder]
  );

  // Markdown-table paste from Obsidian: it copies tables as text/plain (GFM
  // markdown), not as <table>. The handler is assigned below, once the editor
  // exists (insertContent needs it).
  const markdownPasteRef = useRef<
    ((view: EditorView, event: ClipboardEvent) => boolean) | null
  >(null);

  // Images from the clipboard take priority over text; a markdown table is
  // converted only when no files are present.
  const handlePasteCombined = useCallback(
    (view: EditorView, event: ClipboardEvent) => {
      if (handlePaste(view, event)) return true;
      return markdownPasteRef.current?.(view, event) ?? false;
    },
    [handlePaste]
  );

  const editorProps = useMemo(
    () => ({
      attributes: {
        class: "prose tiptap-editor",
        spellcheck: "true",
      },
      handleDrop,
      handlePaste: handlePasteCombined,
    }),
    [handleDrop, handlePasteCombined]
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

  // GFM table from text/plain becomes a real <table> (Obsidian). We only
  // intercept when a markdown block is detected — otherwise return false so
  // ProseMirror keeps its default plain-text paste behaviour.
  markdownPasteRef.current = (_view, event) => {
    const text = event.clipboardData?.getData("text/plain");
    if (!text) return false;
    const html = pastedMarkdownHtml(text);
    if (!html) return false;
    event.preventDefault();
    editor.chain().focus().insertContent(html).run();
    return true;
  };

  // Focus the editor on mount.
  useEffect(() => {
    if (!editor || !autoFocus) return;

    const coords = selectionCoordsRef.current;
    if (!coords) {
      // Смонтированы не кликом по статике (создание заметки, /edit-алиас) —
      // прежнее поведение: просто фокус.
      editor.commands.focus();
      return;
    }

    // Смонтированы кликом в статичный просмотр: ставим каретку в точку клика.
    // Отложено на два кадра, чтобы раскладка (async теги, картинки, NodeView
    // формул) успела устаканиться — иначе posAtCoords промахнётся на строку.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (editor.isDestroyed) return;
        const at = editor.view.posAtCoords({
          left: coords.left,
          top: coords.top,
        });
        if (at) {
          // TextSelection.near снапится к ближайшей валидной inline-позиции
          // (клик мог прийтись на границу таблицы / атомарный узел). Без
          // scrollIntoView — точка клика по определению уже на экране.
          const { state, view } = editor;
          const sel = TextSelection.near(state.doc.resolve(at.pos));
          view.dispatch(state.tr.setSelection(sel));
          view.dom.focus({ preventScroll: true });
        } else {
          editor.commands.focus("end");
        }
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [editor, autoFocus]);

  // Регистрируем редактор как цель диктовки (SpeechProvider) — это нужно
  // и для кнопки микрофона в шапке, и для вставки распознанного текста.
  useEffect(() => {
    if (!editor) return;
    registerEditor(editor);
    return () => unregisterEditor(editor);
  }, [editor, registerEditor, unregisterEditor]);

  // Подписки единственных overlay/модалок (формулы MathLive, схемы Excalidraw).
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
  const [textMenuPos, setTextMenuPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const openTextMenu = () => {
    const coords = editor.view.coordsAtPos(editor.state.selection.from);
    const menuHeight = Math.min(380, Math.round(window.innerHeight * 0.6));
    const fitsBelow = coords.bottom + 6 + menuHeight <= window.innerHeight;
    setTextMenuPos({
      top: fitsBelow
        ? coords.bottom + 6
        : Math.max(8, coords.top - menuHeight - 6),
      left: Math.min(coords.left, window.innerWidth - 250),
    });
    setTextMenuOpen(true);
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

  // Drag-over подсветка «листа»: обратная связь, что сюда можно бросить файл.
  // Счётчик вложенности — dragenter/dragleave стреляют на каждом дочернем узле.
  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);
  const hasFiles = (e: React.DragEvent) =>
    Array.from(e.dataTransfer.types).includes("Files");
  const onDragEnter = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    dragDepth.current += 1;
    setDragOver(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragOver(false);
  };
  const onDropCapture = () => {
    dragDepth.current = 0;
    setDragOver(false);
  };

  return (
    <div
      className={`tiptap-wrapper ${className || ""}${recording ? " is-recording" : ""}${dragOver ? " is-drag-over" : ""}`}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDropCapture={onDropCapture}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleFilesChange}
      />

      {/* Кнопка записи на «листе» убрана: на длинном конспекте она уезжала от
          места набора. Диктовка запускается из микрофона в шапке приложения
          и из bubble-меню выделения (см. BubbleToolbar / TextMenu ниже). */}

      <BubbleToolbar
        editor={editor}
        shouldShow={shouldShowBubble}
        textMenuOpen={textMenuOpen}
        onOpenTextMenu={openTextMenu}
        recording={recording}
        onToggleMic={toggle}
      />

      {textMenuOpen && textMenuPos && (
        <TextMenu
          editor={editor}
          pos={textMenuPos}
          onClose={() => setTextMenuOpen(false)}
          canCapture={canCapture}
          recording={recording}
          onToggleMic={toggle}
        />
      )}

      <FloatingMenu editor={editor} shouldShow={shouldShowFloating}>
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

      {/* Table quick toolbar (appears when the cursor is inside a table). */}
      <TableMenu editor={editor} />

      {/* Notion-style grip in the left gutter: drag a block (or a nested list
          item) to reorder it. ProseMirror already handles the drop; this adds
          the missing signifier. */}
      {editor.isEditable && (
        <DragHandle editor={editor} nested className="editor-drag-handle">
          <button
            type="button"
            className="editor-drag-handle-btn"
            title="Перетащить блок"
            aria-label="Перетащить блок"
            onMouseDown={(e) => e.preventDefault()}
          >
            <GripVertical size={16} />
          </button>
        </DragHandle>
      )}

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
