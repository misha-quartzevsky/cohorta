/**
 * Код приглашения в группу (ссылка cohorta.ru/join/КОД) переживает вход,
 * регистрацию и онбординг: лежит в localStorage, пока человек не вступил
 * или не отказался. Ключ тот же, что у старого входа (Login.tsx).
 */
const KEY = "cohorta:pendingInvite";

export function savePendingInvite(code: string): void {
  try {
    localStorage.setItem(KEY, code.trim());
  } catch {
    /* хранилище недоступно — код останется только в адресе */
  }
}

export function readPendingInvite(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function clearPendingInvite(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ничего */
  }
}

/** Куда вести после входа: на подтверждение вступления, если код сохранён. */
export function afterAuthTarget(from: string): string {
  const code = readPendingInvite();
  return code ? `/join/${encodeURIComponent(code)}` : from;
}
