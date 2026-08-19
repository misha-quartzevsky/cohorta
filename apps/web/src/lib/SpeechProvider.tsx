/**
 * ============================================
 *  SpeechProvider.tsx — голосовой ввод с параллельной аудиозаписью
 * ============================================
 *
 * Оркестрирует три независимых процесса:
 *  1. Web Speech API (ru-RU, continuous, interim) → текст в редактор
 *     (вставка напрямую через view.dispatch по фиксированному анкору,
 *     чтобы курсор не дёргался на каждый результат).
 *  2. MediaRecorder (audio/webm) → файл в PocketBase → `<audio>`-блок
 *     в текст лекции сразу после распознанного абзаца.
 *  3. Состояние для шапки: пульсирующий микрофон, interim-подсказка.
 *
 * Редактор регистрируется через registerEditor(); лекция — через
 * registerSession() (вызывается из SpeechToText.tsx).
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

import {
  SpeechContext,
  type SpeechApi,
  type SpeechSession,
} from "./speechContext";

/** Минимальный интерфейс SpeechRecognition (TS-типа нет в старых lib.dom). */
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEventLike {
  resultIndex?: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript?: string } | undefined;
  }>;
}

type RecognitionCtor = new () => RecognitionLike;

function getSpeechRecognition(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (
    (w.SpeechRecognition as RecognitionCtor | undefined) ??
    (w.webkitSpeechRecognition as RecognitionCtor | undefined) ??
    null
  );
}

function getMediaRecorder(): typeof MediaRecorder | null {
  if (typeof window === "undefined") return null;
  return "MediaRecorder" in window ? window.MediaRecorder : null;
}

export function SpeechProvider({ children }: { children: ReactNode }) {
  const [supported, setSupported] = useState(false);
  const [audioOnly, setAudioOnly] = useState(false);
  const [recording, setRecording] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [hasEditor, setHasEditor] = useState(false);

  const activeEditorRef = useRef<TiptapEditor | null>(null);
  const sessionRef = useRef<SpeechSession>({ canSaveAudio: false });

  const recognitionRef = useRef<RecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingRef = useRef(false);

  // Зона диктовки: финал живёт от `finalEndRef` и вниз, interim — до курсора.
  // Курсор остаётся в конце, не прыгая на каждый кеш-результат.
  const finalEndRef = useRef(0);
  const cursorPosRef = useRef(0);
  const transcriptDoneRef = useRef(false);
  const pendingAudioRef = useRef<File | null>(null);

  useEffect(() => {
    const hasSR = getSpeechRecognition() !== null;
    setSupported(hasSR);
    // Режим «диктофона»: Firefox и прочие без Web Speech API, но с MediaRecorder.
    setAudioOnly(!hasSR && getMediaRecorder() !== null);
  }, []);

  const registerEditor = useCallback((editor: TiptapEditor) => {
    activeEditorRef.current = editor;
    setHasEditor(true);
  }, []);

  const unregisterEditor = useCallback((editor: TiptapEditor) => {
    if (activeEditorRef.current === editor) {
      activeEditorRef.current = null;
      setHasEditor(false);
    }
  }, []);

  const registerSession = useCallback((session: SpeechSession) => {
    const previous = sessionRef.current;
    sessionRef.current = session;
    return () => {
      if (sessionRef.current === session) {
        sessionRef.current = previous;
      }
    };
  }, []);

  // ---------- вставка текста по фиксированному анкору ----------

  const insertTextAtAnchor = useCallback(
    (text: string, interim: boolean) => {
      const editor = activeEditorRef.current;
      if (!editor || !text) return;
      const view = editor.view;
      const { state } = view;
      const schema = state.schema;

      // Interim-текст вставляется в зону [finalEnd, cursor]; финальный —
      // пристыковывается к концу финала, сдвигая зону вправо. Так final-сегмент
      // не затирается последующим interim-кэшем из того же события.
      const from = finalEndRef.current;
      const to = cursorPosRef.current;
      let tr = state.tr;
      if (to > from) tr = tr.delete(from, to);

      const mark = schema.marks.speechInterim;
      const textNode = mark && interim
        ? schema.text(text, [mark.create()])
        : schema.text(text);
      tr = tr.insert(from, textNode);
      tr = tr.setSelection(TextSelection.create(tr.doc, from + text.length));
      cursorPosRef.current = from + text.length;
      if (!interim) finalEndRef.current = from + text.length;

      view.dispatch(tr);
    },
    []
  );

  // ---------- аудио → PocketBase → плеер в текст ----------

  /** Загрузка собранного аудио и вставка `<audio>`-блока после текста. */
  const insertAudioIfReady = useCallback(() => {
    const file = pendingAudioRef.current;
    const editor = activeEditorRef.current;
    // Ожидаем и завершение распознавания, и остановку рекордера.
    if (!file || !editor || !transcriptDoneRef.current) return;
    pendingAudioRef.current = null;

    const session = sessionRef.current;
    const doInsert = async () => {
      let url = "";
      if (session.upload) {
        try {
          const [uploaded] = await session.upload([file]);
          url = uploaded?.url ?? "";
        } catch (e) {
          console.error("Ошибка загрузки аудио:", e);
          setError("Не удалось сохранить аудиозапись");
          return;
        }
      }
      if (!url) return; // нет лекции — плеер вставлять некуда

      const pos = cursorPosRef.current ?? editor.state.selection.from;
      editor
        .chain()
        .focus()
        .insertContentAt(pos, '<audio controls src="' + url + '"></audio><p></p>')
        .run();
      editor.commands.setTextSelection(pos + 2);
    };
    void doInsert();
  }, []);

  const startAudioRecording = useCallback(async () => {
    const MediaRecorderCtor = getMediaRecorder();
    if (!MediaRecorderCtor) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Пользователь мог уже нажать «стоп», пока запрашивался доступ.
      if (!recordingRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      audioStreamRef.current = stream;

      const mimeType = MediaRecorderCtor.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const recorder = mimeType
        ? new MediaRecorderCtor(stream, { mimeType })
        : new MediaRecorderCtor(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const chunk = chunksRef.current[0];
        const type = chunk?.type || mimeType || "audio/webm";
        const ext = type.includes("ogg")
          ? "ogg"
          : type.includes("mp4")
            ? "m4a"
            : type.includes("mpeg")
              ? "mp3"
              : "webm";
        const blob = new Blob(chunksRef.current, { type });
        pendingAudioRef.current = new File(
          [blob],
          `audio-${Date.now()}.${ext}`,
          { type }
        );
        chunksRef.current = [];
        insertAudioIfReady();
      };
      recorder.start();
      recorderRef.current = recorder;
    } catch (e) {
      // Например, пользователь отказал в доступе к микрофону.
      console.warn("Аудиозапись недоступна:", e);
    }
  }, [insertAudioIfReady]);

  // ---------- lifecycle ----------

  const begin = useCallback(() => {
    if (recordingRef.current) return;
    const editor = activeEditorRef.current;
    if (!editor) return;
    editor.commands.focus();

    // Общая сброска зоны диктовки для обоих режимов (live и «диктофон»).
    const base = editor.state.selection.from;
    finalEndRef.current = base;
    cursorPosRef.current = base;
    transcriptDoneRef.current = false;
    pendingAudioRef.current = null;
    setError("");
    setNotice("");

    const SR = getSpeechRecognition();
    if (SR) {
      const recognition = new SR();
      recognition.lang = "ru-RU";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let interim = "";
        let final = "";
        const results = event.results;
        const start = event.resultIndex ?? 0;
        for (let i = start; i < results.length; i++) {
          const transcript = results[i]?.[0]?.transcript ?? "";
          if (results[i].isFinal) final += transcript;
          else interim += transcript;
        }
        if (final) insertTextAtAnchor(final, false);
        if (interim) insertTextAtAnchor(interim, true);
        if (interim || final) setInterimText(interim || final);
      };

      recognition.onerror = (event) => {
        const code = event?.error;
        if (code === "not-allowed" || code === "service-not-allowed") {
          setError(
            "Нет доступа к микрофону. Разрешите в браузере и попробуйте снова."
          );
        }
      };

      recognition.onend = () => {
        recognitionRef.current = null;
        transcriptDoneRef.current = true;
        recordingRef.current = false;
        setRecording(false);
        setInterimText("");
        insertAudioIfReady();
      };

      try {
        recognition.start();
      } catch {
        // Повторный старт может выбросить исключение — игнорируем.
      }
      recognitionRef.current = recognition;
      recordingRef.current = true;
      setRecording(true);
      void startAudioRecording();
      return;
    }

    // --- Режим «диктофона»: нет Web Speech API, но есть MediaRecorder ---
    // (например, Firefox). Распознавания нет — только качественная аудиозапись
    // в PocketBase. Пульс/индикатор записи включается так же, как при живой
    // диктовке, чтобы у юзера был визуальный фидбек.
    const MediaRecorderCtor = getMediaRecorder();
    if (!MediaRecorderCtor) return;

    recordingRef.current = true;
    setRecording(true);
    setNotice(
      "Транскрибация не поддерживается вашим браузером, но мы сохраним аудио."
    );
    void startAudioRecording();
  }, [insertTextAtAnchor, insertAudioIfReady, startAudioRecording]);

  const end = useCallback(() => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    setNotice("");

    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        /* уже остановлено */
      }
    } else {
      // Распознавания нет (режим «диктофона» либо само-завершение) —
      // «recording.onend» не сработает, поэтому финализируем аудио и снимаем
      // индикатор записи вручную.
      transcriptDoneRef.current = true;
      recordingRef.current = false;
      setRecording(false);
      setInterimText("");
      insertAudioIfReady();
    }

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* уже остановлено */
      }
    }
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioStreamRef.current = null;
  }, [insertAudioIfReady]);

  const toggle = useCallback(() => {
    if (recordingRef.current) end();
    else begin();
  }, [begin, end]);

  // Останавливаем всё при размонтировании провайдера.
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* noop */
      }
      try {
        recorderRef.current?.stop();
      } catch {
        /* noop */
      }
      audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const value = useMemo<SpeechApi>(
    () => ({
      supported,
      audioOnly,
      recording,
      interimText,
      notice,
      error,
      hasEditor,
      registerEditor,
      unregisterEditor,
      registerSession,
      begin,
      end,
      toggle,
    }),
    [
      supported,
      audioOnly,
      recording,
      interimText,
      notice,
      error,
      hasEditor,
      registerEditor,
      unregisterEditor,
      registerSession,
      begin,
      end,
      toggle,
    ]
  );

  return (
    <SpeechContext.Provider value={value}>{children}</SpeechContext.Provider>
  );
}