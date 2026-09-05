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

/** Изображения-файлы из drag&drop / буфера обмена (только image/*). */
function imageFilesFromData(data: DataTransfer | null): File[] {
  const fromFiles = Array.from(data?.files ?? []);
  // Some browsers expose dropped/pasted images only via `items`.
  const fromItems = Array.from(data?.items ?? [])
    .filter((it) => it.kind === "file")
    .map((it) => it.getAsFile())
    .filter((f): f is File => !!f);
  const seen = new Set<string>();
  return [...fromFiles, ...fromItems].filter((f) => {
    if (!f.type.startsWith("image/")) return false;
    const key = `${f.name}:${f.size}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * URL картинки, перетащенной из другой вкладки/окна: там нет File —
 * браузер кладёт `text/uri-list` или `text/html` с `<img src=…>`.
 */
function imageUrlFromData(data: DataTransfer | null): string | null {
  if (!data) return null;
  // <img> из HTML-фрагмента — самый надёжный признак «тащат картинку».
  const html = data.getData("text/html");
  const htmlSrc = html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
  if (htmlSrc && /^https?:\/\//i.test(htmlSrc)) return htmlSrc;
  // Иначе — только явный URL картинки (по расширению), чтобы обычная
  // ссылка осталась ссылкой, а не превратилась в <img>.
  const uri = data
    .getData("text/uri-list")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find((s) => /^https?:\/\/\S+\.(png|jpe?g|gif|webp|avif|svg|bmp)(\?\S*)?$/i.test(s));
  return uri ?? null;
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
  // Общий путь: загрузить файлы (если есть загрузчик) либо вставить картинку
  // по URL (перетащена из другой вкладки). Возвращает true, если что-то сделали.
  const consumeImages = useCallback(
    (
      data: DataTransfer | null,
      pos: number | null,
      allowUrlFallback: boolean
    ): boolean => {
      const upload = onUploadRef.current;
      const files = imageFilesFromData(data);
      if (files.length && upload) {
        void (async () => {
          try {
            const uploaded = await upload(files);
            insertImagesRef.current?.(
              uploaded.map((image) => image.url),
              pos
            );
          } catch (err) {
            console.error("Ошибка загрузки изображения:", err);
          }
        })();
        return true;
      }
      // URL-фолбэк — только для drop (перетащили картинку из другой вкладки).
      // На paste оставляем дефолт ProseMirror, чтобы смешанный HTML не терял текст.
      if (allowUrlFallback) {
        const url = imageUrlFromData(data);
        if (url) {
          insertImagesRef.current?.([url], pos);
          return true;
        }
      }
      return false;
    },
    []
  );

  const handleDrop = useCallback(
    (view: EditorView, event: DragEvent) => {
      const coords = view.posAtCoords({
        left: event.clientX,
        top: event.clientY,
      });
      const handled = consumeImages(
        event.dataTransfer,
        coords ? coords.pos : null,
        true
      );
      if (handled) event.preventDefault();
      return handled;
    },
    [consumeImages]
  );

  const handlePaste = useCallback(
    (view: EditorView, event: ClipboardEvent) => {
      const handled = consumeImages(
        event.clipboardData,
        view.state.selection.from,
        false
      );
      if (handled) event.preventDefault();
      return handled;
    },
    [consumeImages]
  );

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
