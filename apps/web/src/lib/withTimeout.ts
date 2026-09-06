/**
 * ============================================
 *  withTimeout.ts — жёсткий тайм-аут для промисов
 * ============================================
 *
 * PocketBase SDK не отменяет запрос сам (autoCancellation отключён),
 * а `fetch` к недоступному хосту (неверный `VITE_PB_URL`, лежащий
 * бэкенд) может висеть минутами. Оборачиваем сетевые вызовы, чтобы
 * вместо «зависания» пользователь получал понятную ошибку.
 */

export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(
      `Не дождались ответа сервера (${label}, ${Math.round(ms / 1000)} с). ` +
        "Проверьте соединение и адрес бэкенда."
    );
    this.name = "TimeoutError";
  }
}

/**
 * Отклоняет промис через `ms` мс, если исходный не успел.
 * Исходный запрос при этом не отменяется (PB SDK это и не умеет),
 * но UI перестаёт ждать.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  label: string,
  ms = 15000
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() =>
    clearTimeout(timer)
  ) as Promise<T>;
}
