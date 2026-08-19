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

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { FloatingMenu } from "@tiptap/react/menus";
import type { BubbleMenuPluginProps } from "@tiptap/extension-bubble-menu";
import type { FloatingMenuPluginProps } from "@tiptap/extension-floating-menu";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import ImageExtension from "@tiptap/extension-image";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { AudioLines, Mic, MicOff, Plus } from "lucide-react";
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

import { useImageUpload } from "./editor/useImageUpload";
import { BubbleToolbar } from "./editor/BubbleToolbar";
import { TextMenu } from "./editor/TextMenu";

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

  return (
    <div className={`tiptap-wrapper ${className || ""}${recording ? " is-recording" : ""}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleFilesChange}
      />

      {/* Постоянная кнопка записи в углу «листа»: быстрый старт
          диктовки (или «диктофона» в браузерах без Web Speech API). */}
      {canCapture && (
        <button
          type="button"
          className={`editor-mic${recording ? " active" : ""}`}
          onClick={toggle}
          title={
            recording
              ? "Остановить запись"
              : audioOnly
                ? "Диктофон: аудиозапись (транскрибация не поддерживается)"
                : "Диктовка: голосовой ввод в текст лекции"
          }
        >
          {recording ? (
            <MicOff size={18} />
          ) : supported ? (
            <Mic size={18} />
          ) : (
            <AudioLines size={18} />
          )}
          {recording && <span className="editor-rec">● REC</span>}
        </button>
      )}

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
