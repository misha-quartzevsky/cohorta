/**
 * Создание квиза: состояние окна «Создать квиз» (Screen-quiz-states, блоки 1–5)
 * и фоновая сборка. Живёт вне React-деревьев, по одному состоянию на лекцию:
 * окно можно закрыть, пока идёт сборка, — запрос не обрывается, квиз потом
 * появляется в панели «Твоё понимание темы» («Пока идёт сборка, можно закрыть окно»).
 * «Отмена» в окне ожидания на компьютере — наоборот, обрывает запрос.
 */
import { useSyncExternalStore } from "react";
import { createQuiz, QuizError } from "../services/quizService";
import { QUIZ_DEFAULT_SIZE, QUIZ_MIN_CHARS, type QuizSize } from "./quizLimits";

export type CreateDialog = "closed" | "choose" | "waiting" | "error" | "short" | "limit";

export interface CreationState {
  dialog: CreateDialog;
  size: QuizSize;
  forceNew: boolean;
  running: boolean;
  /** Сборка закончилась, пока открыто окно ожидания: пора идти в квиз. */
  ready: boolean;
  /** Растёт после каждой успешной сборки: панель по нему перечитывает данные. */
  version: number;
  /** Для окна «Мало текста»: сколько знаков в конспекте сейчас. */
  textLength: number;
  /** Для окна «Лимит исчерпан»: сколько квизов разрешено и создано сегодня. */
  limit: number | null;
  used: number | null;
}

const IDLE: CreationState = {
  dialog: "closed",
  size: QUIZ_DEFAULT_SIZE,
  forceNew: false,
  running: false,
  ready: false,
  version: 0,
  textLength: 0,
  limit: null,
  used: null,
};

const states = new Map<string, CreationState>();
const controllers = new Map<string, AbortController>();
const listeners = new Set<() => void>();

function get(lectureId: string): CreationState {
  return states.get(lectureId) ?? IDLE;
}

function set(lectureId: string, patch: Partial<CreationState>) {
  states.set(lectureId, { ...get(lectureId), ...patch });
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useCreation(lectureId: string): CreationState {
  return useSyncExternalStore(
    subscribe,
    () => get(lectureId),
    () => IDLE
  );
}

/** Нажали «Создать квиз» / «Собрать другой»: показать выбор размера, или «мало текста», или ожидание. */
export function openCreate(lectureId: string, opts: { forceNew: boolean; textLength: number }) {
  const cur = get(lectureId);
  if (cur.running) {
    set(lectureId, { dialog: "waiting" });
    return;
  }
  if (opts.textLength < QUIZ_MIN_CHARS) {
    set(lectureId, { dialog: "short", textLength: opts.textLength, forceNew: opts.forceNew });
    return;
  }
  set(lectureId, { dialog: "choose", forceNew: opts.forceNew, textLength: opts.textLength, size: QUIZ_DEFAULT_SIZE });
}

export function setSize(lectureId: string, size: QuizSize) {
  set(lectureId, { size });
}

export function closeDialog(lectureId: string) {
  set(lectureId, { dialog: "closed" });
}

/** «Отмена» в окне ожидания: обрываем запрос, попытка не списывается (квиз не сохранён). */
export function cancelCreate(lectureId: string) {
  controllers.get(lectureId)?.abort();
  controllers.delete(lectureId);
  set(lectureId, { dialog: "closed", running: false });
}

/** Квиз открыт после ожидания — окно можно сбросить. */
export function ackReady(lectureId: string) {
  set(lectureId, { dialog: "closed", ready: false });
}

export interface StartInput {
  lectureId: string;
  textLength: number;
}

export function startCreate({ lectureId: id, textLength }: StartInput) {
  const { size, forceNew } = get(id);
  const controller = new AbortController();
  controllers.set(id, controller);
  set(id, { dialog: "waiting", running: true, ready: false, textLength });

  createQuiz(id, size, forceNew, controller.signal)
    .then(() => {
      controllers.delete(id);
      const cur = get(id);
      set(id, {
        running: false,
        version: cur.version + 1,
        ready: cur.dialog === "waiting",
        dialog: cur.dialog === "waiting" ? "waiting" : "closed",
      });
    })
    .catch((e: unknown) => {
      controllers.delete(id);
      if (e instanceof QuizError && e.code === "aborted") {
        set(id, { running: false, dialog: "closed" });
        return;
      }
      if (e instanceof QuizError && e.code === "daily_limit") {
        set(id, {
          running: false,
          dialog: "limit",
          limit: e.details.limit ?? null,
          used: e.details.used ?? null,
        });
        return;
      }
      if (e instanceof QuizError && e.code === "not_enough_text") {
        set(id, { running: false, dialog: "short", textLength });
        return;
      }
      set(id, { running: false, dialog: "error" });
    });
}
