/**
 * Новый интерфейс — единственный (решение владельца 26.10, тема 5 рефакторинга).
 * Функция остаётся на время удаления старых экранов; её вызовы убираются на шаге D5.
 */
export function isNewUI(): boolean {
  return true;
}

/**
 * Письма (восстановление пароля, подтверждение почты). Экраны готовы, но
 * почты на cohorta.ru в первом запуске нет — включать только вместе с ней:
 * VITE_AUTH_EMAIL=true. Пока выключено, «Забыли пароль?» ведёт на «Напиши
 * в поддержку».
 */
export function isEmailAuthEnabled(): boolean {
  return import.meta.env.VITE_AUTH_EMAIL === "true";
}

/** Адрес поддержки (экран «Не помнишь пароль?»). */
export const SUPPORT_EMAIL = "support@cohorta.ru";
