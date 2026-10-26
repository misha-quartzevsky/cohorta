/**
 * ============================================
 *  profileService.ts — правка профиля в настройках (B6)
 * ============================================
 */

import { pb } from "../lib/pocketbase";
import type { DegreeLevel, University, User } from "../lib/types";
import { withTimeout } from "../lib/withTimeout";

function uid(): string {
  const id = String(pb.authStore.record?.id ?? "");
  if (!id) throw new Error("Нет активной сессии.");
  return id;
}

/** Обновить поля своей записи; authStore обновляется сам. */
async function updateMyProfile(patch: Record<string, unknown>): Promise<User> {
  return withTimeout(pb.collection("users").update<User>(uid(), patch), "сохранение профиля");
}

export async function setDegreeAndCourse(degree: DegreeLevel, course: number | null): Promise<User> {
  return updateMyProfile({
    degree_level: degree,
    degree_level_custom: "",
    course,
  });
}

export async function setCityUniversity(input: {
  city: string;
  universityId: string;
  universityCustom: string;
}): Promise<User> {
  const hasUni = Boolean(input.universityId);
  return updateMyProfile({
    city: input.city.trim(),
    university: hasUni ? input.universityId : "",
    university_custom: hasUni ? "" : input.universityCustom.trim(),
  });
}

export async function fetchUniversityName(id: string): Promise<string> {
  if (!id) return "";
  try {
    const u = await pb.collection("universities").getOne<University>(id);
    return String(u.name ?? "");
  } catch {
    return "";
  }
}

/** Адрес картинки аватара ("" — файла нет). */
export function avatarUrl(user: User): string {
  return user.avatar ? pb.files.getURL(user, user.avatar) : "";
}
