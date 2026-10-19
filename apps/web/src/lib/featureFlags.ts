/**
 * Флаг новой дизайн-основы (миграция, раздел 3 инструкции).
 * Пока волны A и B1 не завершены, старый интерфейс остаётся
 * дефолтным — включать новый только явным VITE_NEW_UI=true
 * (preview-сборки) или настройкой пользователя (TODO волна B6).
 */
export function isNewUI(): boolean {
  return import.meta.env.VITE_NEW_UI === "true";
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
