/**
 * Логин пользователя = адрес профиля 3-го уровня: `username.cohorta.ru`.
 * Значит — только строчные латинские буквы, цифры и дефис, не в
 * начале/конце, длина 3–40 символов.
 */
export function isValidHandle(value: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(value.trim());
}
