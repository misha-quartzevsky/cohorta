/**
 * ============================================
 *  speechContext.ts — контекст голосового ввода
 * ============================================
 *
 * Единый контракт между SpeechProvider (вся логика распознавания и
 * аудиозаписи), шапкой (кнопка микрофона) и SpeechToText (привязка
 * лекции для сохранения аудиофайла).
 */

import { createContext, useContext } from "react";
import type { Editor as TiptapEditor } from "@tiptap/core";

/** Сессия диктовки: чем можно распоряжаться при остановке. */
export interface SpeechSession {
  /**
   * Загрузчик файлов в поле `file` лекции. Когда отсутствует (нет лекции),
   * текст всё равно диктуется, но аудио не сохраняется.
   */
  upload?: (files: File[]) => Promise<Array<{ name: string; url: string }>>;
  /** Есть ли рядом лекция, в которую можно положить аудиозапись. */
  canSaveAudio: boolean;
}

export interface SpeechApi {
  /** Браузер поддерживает Web Speech API (ru-RU) — режим «живой диктовки». */
  supported: boolean;
  /**
   * Режим «диктофона»: MediaRecorder есть, а Web Speech API нет (например,
   * Firefox). Запись так и работает, но без транскрибации.
   */
  audioOnly: boolean;
  /**
   * Идёт ли сейчас диктовка/аудиозапись (в любом из двух режимов).
   * Питает индикаторы: пульс `.is-recording`, бейдж «● REC», состояние кнопок.
   */
  recording: boolean;
  /** Текущий (промежуточный) распознанный текст — для подсказок в шапке. */
  interimText: string;
  /** Одноразовое уведомление (например, «транскрибация не поддерживается»). */
  notice: string;
  /** Последняя ошибка (например, нет доступа к микрофону). */
  error: string;
  /** В редакторе ли фокус-таргет для вставки текста (Editor зарегистрирован). */
  hasEditor: boolean;
  registerEditor: (editor: TiptapEditor) => void;
  unregisterEditor: (editor: TiptapEditor) => void;
  /** Зарегистрировать сессию (лекцию) для сохранения аудио. Возвращает отписку. */
  registerSession: (session: SpeechSession) => () => void;
  begin: () => void;
  end: () => void;
  toggle: () => void;
}

export const SpeechContext = createContext<SpeechApi | null>(null);

/** Читает SpeechApi из ближайшего SpeechProvider. */
export function useSpeech(): SpeechApi {
  const ctx = useContext(SpeechContext);
  if (!ctx) {
    throw new Error("useSpeech must be used within <SpeechProvider>");
  }
  return ctx;
}
