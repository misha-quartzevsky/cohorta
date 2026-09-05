/**
 * ============================================
 *  authErrors.ts — русские сообщения об ошибках auth
 * ============================================
 *
 * PocketBase отдаёт ошибки валидации как
 * `err.response.data = { <field>: { code, message } }`
 * (в некоторых версиях SDK — `err.data`). Здесь мы
 * переводим типовые коды в понятный русский текст;
 * всё нераспознанное падает на общий фолбэк.
 */

import { errorMessage } from "./format";

type FieldError = { code?: string; message?: string };

function fieldErrors(err: unknown): Record<string, FieldError> {
  const e = err as { response?: { data?: unknown }; data?: unknown };
  const data = e?.response?.data ?? e?.data;
  return data && typeof data === "object"
    ? (data as Record<string, FieldError>)
    : {};
}

/** Сообщение для формы регистрации. */
export function registerErrorMessage(err: unknown): string {
  const fields = fieldErrors(err);

  const emailCode = fields.email?.code;
  if (emailCode === "validation_not_unique") {
    return "Этот email уже зарегистрирован.";
  }
  if (emailCode === "validation_invalid_email" || emailCode === "validation_is_email") {
    return "Введите корректный email.";
  }
  if (emailCode) {
    return "Проверьте email — он уже занят или введён неверно.";
  }

  if (fields.password?.code) {
    return "Пароль слишком короткий — нужно не меньше 8 символов.";
  }

  const raw = errorMessage(err);
  if (/failed to create record|Failed to authenticate/i.test(raw)) {
    return "Не удалось зарегистрироваться. Попробуйте ещё раз.";
  }
  return "Не удалось зарегистрироваться. Попробуйте ещё раз.";
}

/** Сообщение для формы входа. */
export function loginErrorMessage(_err: unknown): string {
  return "Не удалось войти. Проверьте email и пароль.";
}
