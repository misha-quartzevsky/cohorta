/**
 * ============================================
 *  editor/useImageUpload.ts — image upload logic
 * ============================================
 *
 * Owns everything the Tiptap editor needs to upload pasted / dropped /
 * picked images to PocketBase: the file-input ref, the current uploader
 * callback, drag&drop + paste handlers and the file-change handler.
 *
 * The editor itself is created *after* this hook, so the actual insertion
 * (`insertImages`) lives in the Editor component and is assigned to
 * `insertImagesRef.current` once the editor instance exists.
 */

import {
  useCallback,
  useEffect,
  useRef,
  type ChangeEvent,
  type MutableRefObject,
  type RefObject,
} from "react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import type { EditorView } from "@tiptap/pm/view";
import type { UploadedImage } from "../../services/lectureService";

/** Изображения из drag&drop / буфера обмена (только image/*). */
function imageFilesFromData(data: DataTransfer | null): File[] {
  return Array.from(data?.files ?? []).filter((f) =>
    f.type.startsWith("image/")
  );
}

export type UploadImages = (files: File[]) => Promise<UploadedImage[]>;

export interface UseImageUploadResult {
  fileInputRef: RefObject<HTMLInputElement | null>;
  onUploadRef: MutableRefObject<UploadImages | undefined>;
  /** Assigned by the Editor once it exists: inserts uploaded URLs at a pos. */
  insertImagesRef: MutableRefObject<
    ((urls: string[], pos?: number | null) => void) | null
  >;
  chooseImage: (
    activeEditor: TiptapEditor,
    range: { from: number; to: number }
  ) => void;
  handleDrop: (view: EditorView, event: DragEvent) => boolean;
  handlePaste: (view: EditorView, event: ClipboardEvent) => boolean;
  handleFilesChange: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
}

/**
 * Image-upload plumbing for the Tiptap editor.
 *
 * @param onUploadImages — uploader; when falsy the editor falls back to
 *                         inserting an image by URL (chooseImage prompts).
 */
export function useImageUpload(
  onUploadImages?: UploadImages
): UseImageUploadResult {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Куда вставить картинку после выбора файла (позиция после удаления «/»).
  const pendingPosRef = useRef<number | null>(null);
  const onUploadRef = useRef<UploadImages | undefined>(onUploadImages);
  const insertImagesRef = useRef<
    ((urls: string[], pos?: number | null) => void) | null
  >(null);

  // Всегда держим актуальный колбэк загрузки, не пересоздавая остальное.
  useEffect(() => {
    onUploadRef.current = onUploadImages;
  }, [onUploadImages]);

  // Пункт «Картинка» в slash-меню: файловый пикер либо фолбэк на URL-промпт.
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

  // Картинки из drag&drop / вставки из буфера забираем только когда есть
  // загрузчик (иначе оставляем дефолтное поведение браузера).
  const handleDrop = useCallback(
    (view: EditorView, event: DragEvent) => {
      const upload = onUploadRef.current;
      if (!upload) return false;
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
          const uploaded = await upload(files);
          insertImagesRef.current?.(uploaded.map((image) => image.url), pos);
        } catch (err) {
          console.error("Ошибка загрузки изображения:", err);
        }
      })();
      return true;
    },
    []
  );

  const handlePaste = useCallback((view: EditorView, event: ClipboardEvent) => {
    const upload = onUploadRef.current;
    if (!upload) return false;
    const files = imageFilesFromData(event.clipboardData);
    if (!files.length) return false;
    event.preventDefault();
    const pos = view.state.selection.from;
    void (async () => {
      try {
        const uploaded = await upload(files);
        insertImagesRef.current?.(uploaded.map((image) => image.url), pos);
      } catch (err) {
        console.error("Ошибка загрузки изображения:", err);
      }
    })();
    return true;
  }, []);

  // Выбор файла в скрытом input.
  const handleFilesChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const input = e.currentTarget;
      const files = Array.from(input.files ?? []);
      input.value = "";
      const upload = onUploadRef.current;
      if (!files.length || !upload) return;
      try {
        const uploaded = await upload(files);
        const pos = pendingPosRef.current;
        pendingPosRef.current = null;
        insertImagesRef.current?.(uploaded.map((image) => image.url), pos);
      } catch (err) {
        console.error("Ошибка загрузки изображения:", err);
      }
    },
    []
  );

  return {
    fileInputRef,
    onUploadRef,
    insertImagesRef,
    chooseImage,
    handleDrop,
    handlePaste,
    handleFilesChange,
  };
}
