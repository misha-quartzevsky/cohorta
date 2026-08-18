/**
 * ============================================
 *  sketchBus.ts — шина единственной модалки схем (Excalidraw)
 * ============================================
 *
 * Аналогично mathBus: SketchBlockView / slash-меню зовут sketchBus.open(),
 * а компонент Editor подписан и рендерит модалку (лениво — через
 * React.lazy, чтобы Excalidraw не попадал в основной бандл).
 */

import type { Editor as TiptapEditor } from "@tiptap/core";

import type { UploadedImage } from "../../services/lectureService";

export interface SketchRequest {
  editor: TiptapEditor;
  /** Позиция блока (для update) или точка вставки (для нового). */
  pos: number;
  /** Сериализованная сцена для повторного открытия (JSON) или null. */
  scene: string | null;
  /** Загрузчик файлов в PB (когда лекция доступна). */
  onUploadImages?: (files: File[]) => Promise<UploadedImage[]>;
}

type Listener = (request: SketchRequest | null) => void;

const listeners = new Set<Listener>();

/**
 * Общий загрузчик файлов в PB (поле `file` лекции). Устанавливается
 * компонентом Editor; нужен, чтобы повторное открытие схемы из NodeView
 * тоже выгружало SVG в PB, а не падало в data-URL.
 */
export let sketchUploader:
  | ((files: File[]) => Promise<UploadedImage[]>)
  | undefined;

export function setSketchUploader(
  upload?: (files: File[]) => Promise<UploadedImage[]>
): void {
  sketchUploader = upload;
}

export const sketchBus = {
  open(request: SketchRequest) {
    listeners.forEach((listener) => listener(request));
  },
  close() {
    listeners.forEach((listener) => listener(null));
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
