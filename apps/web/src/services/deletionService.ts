/**
 * ============================================
 *  deletionService.ts — запрос на удаление аккаунта
 * ============================================
 *
 * Путь «удалить меня» без полной автоматизации: создаём строку
 * `deletion_requests`, дальше её обрабатывает человек через
 * админку PocketBase (new → done).
 */

import { pb } from "../lib/pocketbase";
import type { PbRecord } from "../lib/types";

export interface DeletionRequest extends PbRecord {
  user: string;
  email?: string;
  reason?: string;
  status?: "new" | "done";
}

function currentUserId(): string {
  return String(pb.authStore.record?.id ?? "");
}

/** Незакрытый запрос текущего пользователя, либо null. */
export async function fetchMyDeletionRequest(): Promise<DeletionRequest | null> {
  const uid = currentUserId();
  if (!uid) return null;
  try {
    return await pb
      .collection("deletion_requests")
      .getFirstListItem<DeletionRequest>(
        pb.filter('user = {:u} && status = "new"', { u: uid })
      );
  } catch {
    return null;
  }
}

/** Создать запрос на удаление аккаунта/данных. */
export async function requestDeletion(
  reason = ""
): Promise<DeletionRequest> {
  const uid = currentUserId();
  if (!uid) throw new Error("Нужно войти.");
  return pb.collection("deletion_requests").create<DeletionRequest>({
    user: uid,
    email: String(pb.authStore.record?.email ?? ""),
    reason,
    status: "new",
  });
}
