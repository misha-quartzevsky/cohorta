/**
 * ============================================
 *  onboardingService.ts — Onboarding writes
 * ============================================
 *
 * Пишет профиль студента в свою запись `users` и ставит флаг
 * `onboarding_completed`. Коллекция `users` закрыта на листинг,
 * поэтому уникальность `username` проверяем не отдельным запросом,
 * а по ошибке unique-constraint при записи (см. `UsernameTakenError`).
 */

import { ClientResponseError } from "pocketbase";

import { pb } from "../lib/pocketbase";
import type { DegreeLevel, User } from "../lib/types";
import { FIELDS } from "../lib/types";
import { withTimeout } from "../lib/withTimeout";

/** Id текущего пользователя. Кидает, если сессии нет. */
function requireUserId(): string {
  const id = String(pb.authStore.record?.id ?? "");
  if (!id) throw new Error("Нет активной сессии.");
  return id;
}

/** Логин занят: брошено из `setUsername` при коллизии unique-индекса. */
export class UsernameTakenError extends Error {
  constructor() {
    super("Этот логин уже занят. Попробуйте другой.");
    this.name = "UsernameTakenError";
  }
}

function isNotUnique(err: unknown, field: string): boolean {
  if (!(err instanceof ClientResponseError)) return false;
  if (err.status !== 400) return false;
  const fieldErr = (
    err.response?.data as Record<string, { code?: string }> | undefined
  )?.[field];
  const code = fieldErr?.code ?? "";
  return code === "validation_not_unique" || code.includes("unique");
}

/**
 * Записать логин. При коллизии — `UsernameTakenError` (экран 1
 * остаётся, показываем понятный текст).
 */
export async function setUsername(username: string): Promise<void> {
  const value = username.trim();
  try {
    await withTimeout(
      pb.collection("users").update(requireUserId(), { [FIELDS.userUsername]: value }),
      "сохранение логина"
    );
  } catch (err) {
    if (isNotUnique(err, FIELDS.userUsername)) throw new UsernameTakenError();
    throw err;
  }
}

export interface ProfileInput {
  /** Имя, по которому сервис обращается к пользователю (`users.name`). */
  name: string;
  city: string;
  /** id из `universities` либо "" (тогда заполняем `university_custom`). */
  university: string;
  universityCustom: string;
  degreeLevel: DegreeLevel;
  degreeLevelCustom: string;
  /** null — курс не задан (например, ступень «Другое» без ввода). */
  course: number | null;
}

/**
 * Сохранить профиль. `university` / `university_custom` и
 * `degree_level_custom` — взаимоисключающие: пустую сторону явно
 * очищаем, чтобы не осталось мусора от предыдущих шагов «назад».
 */
export async function saveProfile(input: ProfileInput): Promise<void> {
  const hasUniversity = Boolean(input.university);
  const isOther = input.degreeLevel === "other";

  await withTimeout(
    pb.collection("users").update(requireUserId(), {
      [FIELDS.userDisplayName]: input.name.trim(),
      [FIELDS.userCity]: input.city.trim(),
      [FIELDS.userUniversity]: hasUniversity ? input.university : "",
      [FIELDS.userUniversityCustom]: hasUniversity ? "" : input.universityCustom.trim(),
      [FIELDS.userDegreeLevel]: input.degreeLevel,
      [FIELDS.userDegreeLevelCustom]: isOther ? input.degreeLevelCustom.trim() : "",
      [FIELDS.userCourse]: input.course ?? null,
    }),
    "сохранение профиля"
  );
}

/** Загрузить аватар (поле `avatar`, стандартный file-upload PocketBase). */
export async function uploadAvatar(file: File): Promise<void> {
  const form = new FormData();
  form.append("avatar", file);
  await withTimeout(
    pb.collection("users").update(requireUserId(), form),
    "загрузка аватара",
    30000
  );
}

/**
 * Отметить онбординг пройденным и обновить закешированную запись в
 * authStore (`authRefresh`), чтобы гейт `AppLayout` сразу пропустил
 * в приложение.
 */
export async function completeOnboarding(): Promise<User> {
  await withTimeout(
    pb
      .collection("users")
      .update(requireUserId(), { [FIELDS.userOnboardingCompleted]: true }),
    "завершение онбординга"
  );
  const { record } = await withTimeout(
    pb.collection("users").authRefresh<User>(),
    "обновление сессии"
  );
  return record;
}
