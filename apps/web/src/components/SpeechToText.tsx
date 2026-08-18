/**
 * ============================================
 *  SpeechToText.tsx — привязка лекции к голосовому вводу
 * ============================================
 *
 * Регистрирует текущую лекцию как цель для аудиозаписи: когда диктовка
 * завершается, собранный blob-файл уходит в PocketBase (поле `file`),
 * а в текст лекции вставляется `<audio>`-плеер.
 *
 * Сам компонент ничего не отрисовывает — это «провод» между страницей
 * редактирования и SpeechProvider.
 */

import { useEffect, useRef } from "react";

import { useSpeech } from "../lib/speechContext";
import type { Lecture } from "../lib/types";
import type { UploadedImage } from "../services/lectureService";

interface Props {
  /** Текущая лекция (может появиться после первого сохранения). */
  lecture: Lecture | null;
  /** Загрузчик файлов в поле `file` лекции (переиспользует загрузку картинок). */
  onUpload: (files: File[]) => Promise<UploadedImage[]>;
}

export default function SpeechToText({ lecture, onUpload }: Props) {
  const { registerSession } = useSpeech();
  const lectureRef = useRef(lecture);
  const uploadRef = useRef(onUpload);
  lectureRef.current = lecture;
  uploadRef.current = onUpload;

  useEffect(() => {
    return registerSession({
      canSaveAudio: !!lectureRef.current,
      upload: async (files: File[]) => {
        const lectureNow = lectureRef.current;
        if (!lectureNow) return [];
        return uploadRef.current(files);
      },
    });
  }, [registerSession]);

  return null;
}