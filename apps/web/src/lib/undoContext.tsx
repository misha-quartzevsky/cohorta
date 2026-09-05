/**
 * ============================================
 *  undoContext.tsx — Grace-period undo для удалений
 * ============================================
 *
 * По UX-аудиту (Nielsen: «Undo beats confirm dialogs») — необратимое
 * удаление менее опасно, если у него есть окно на передумать. Вместо
 * второй, более тяжёлой системы (soft-delete на бэкенде + корзина),
 * здесь — лёгкий клиентский вариант:
 *
 *   1. Пользователь подтверждает удаление (ConfirmDialog остаётся —
 *      это защита от случайного клика, а не от «я передумал через 2 сек»).
 *   2. Запись сразу пропадает из списка (через isPending), но реальный
 *      вызов к PocketBase откладывается на UNDO_WINDOW_MS.
 *   3. Если за это время пользователь нажал «Отменить» — таймер просто
 *      гасится, к серверу вообще ничего не улетает. Восстанавливать
 *      нечего: удаления не произошло.
 *   4. Компонент, вызвавший scheduleDelete, может размонтироваться
 *      (например, LectureView уходит на страницу курса) — таймер живёт
 *      в этом провайдере на уровне всего приложения, а не в компоненте.
 *
 * Полноценная серверная корзина с восстановлением — отдельная будущая
 * фича (soft-delete + TTL), если окажется, что 5 секунд недостаточно
 * (пользователь удалил вчера и хочет вернуть).
 */

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** Окно на отмену — совпадает с копирайтом тостов ("Отменить · 5 сек"). */
export const UNDO_WINDOW_MS = 5000;

interface PendingEntry {
  /** Уникальный ключ записи, напр. `lecture:${id}`. */
  key: string;
  /** Текст тоста, напр. «Запись «Предел» удалена». */
  message: string;
  /** Вызывается по «Отменить», ДО того как запись пропадёт из pending.
   *  Нужен там, где список — локальный draft-state (напр. карточки в
   *  редакторе колоды), а не сервер + isPending-фильтр: там просто
   *  погасить таймер недостаточно, запись нужно явно вернуть в state. */
  onCancel?: () => void;
}

interface UndoContextValue {
  pending: PendingEntry[];
  /** Отложить удаление: спрятать из UI сразу, выполнить commit через
   *  UNDO_WINDOW_MS, если не отменят. `onCancel` — опциональное
   *  восстановление локального state при нажатии «Отменить». */
  scheduleDelete: (
    key: string,
    message: string,
    commit: () => Promise<void> | void,
    onCancel?: () => void
  ) => void;
  /** Отменить отложенное удаление — вызывается кнопкой «Отменить». */
  cancelDelete: (key: string) => void;
  /** true, пока запись ещё в окне отмены — списки фильтруют по этому. */
  isPending: (key: string) => boolean;
}

const UndoContext = createContext<UndoContextValue | null>(null);

export function useUndo(): UndoContextValue {
  const ctx = useContext(UndoContext);
  if (!ctx) {
    throw new Error("useUndo must be used within UndoProvider");
  }
  return ctx;
}

export function UndoProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingEntry[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Полные записи (с onCancel) держим в ref, а не только в setPending —
  // StrictMode в dev намеренно вызывает updater-функции setState дважды,
  // чтобы ловить именно побочные эффекты внутри них. onCancel() — сайд-
  // эффект (реально меняет чужой state), поэтому читаем/пишем его через
  // ref снаружи setState, а не изнутри updater'а.
  const entries = useRef<Map<string, PendingEntry>>(new Map());

  const cancelDelete = useCallback((key: string) => {
    const timer = timers.current.get(key);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(key);
    }
    const entry = entries.current.get(key);
    entries.current.delete(key);
    entry?.onCancel?.();
    setPending((prev) => prev.filter((e) => e.key !== key));
  }, []);

  const scheduleDelete = useCallback(
    (
      key: string,
      message: string,
      commit: () => Promise<void> | void,
      onCancel?: () => void
    ) => {
      // Тот же ключ уже отложен (двойной клик и т.п.) — сбрасываем старый
      // таймер, чтобы не выполнить commit дважды.
      const existing = timers.current.get(key);
      if (existing) clearTimeout(existing);

      const entry: PendingEntry = { key, message, onCancel };
      entries.current.set(key, entry);

      const timer = setTimeout(() => {
        timers.current.delete(key);
        entries.current.delete(key);
        setPending((prev) => prev.filter((e) => e.key !== key));
        void commit();
      }, UNDO_WINDOW_MS);

      timers.current.set(key, timer);
      setPending((prev) => [...prev.filter((e) => e.key !== key), entry]);
    },
    []
  );

  const isPending = useCallback(
    (key: string) => pending.some((e) => e.key === key),
    [pending]
  );

  return (
    <UndoContext.Provider
      value={{ pending, scheduleDelete, cancelDelete, isPending }}
    >
      {children}
      {pending.length > 0 && (
        <div className="undo-toast-stack" role="status" aria-live="polite">
          {pending.map((entry) => (
            <div className="undo-toast" key={entry.key}>
              <span className="undo-toast-message">{entry.message}</span>
              <button
                type="button"
                className="undo-toast-action"
                onClick={() => cancelDelete(entry.key)}
              >
                Отменить
              </button>
              <span className="undo-toast-bar" />
            </div>
          ))}
        </div>
      )}
    </UndoContext.Provider>
  );
}
