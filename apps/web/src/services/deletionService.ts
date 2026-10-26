/**
 * ============================================
 *  deletionService.ts — запрос на удаление аккаунта
 * ============================================
 *
 * Путь «удалить меня» без полной автоматизации: создаём строку
 * `deletion_requests`, дальше её обрабатывает человек через
 * админку PocketBase (new → done).
 */

import { MONTHS_GENITIVE } from "../lib/format";
import { pb, currentUserId } from "../lib/pocketbase";
import type { PbRecord } from "../lib/types";

export interface DeletionRequest extends PbRecord {
  user: string;
  email?: string;
  reason?: string;
  status?: "new" | "done" | "cancelled";
  /** Когда аккаунт будет удалён ("2026-11-02 09:30:00.000Z"), +14 дней от запроса. */
  scheduled_for?: string;
}

/** Ответ сервера: владелец группы должен сначала передать её. */
export class GroupOwnerError extends Error {
  groupName: string;
  constructor(groupName: string) {
    super("Ты владелец группы " + groupName + ". Сначала передай владение: иначе группа останется без владельца.");
    this.name = "GroupOwnerError";
    this.groupName = groupName;
  }
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

/**
 * Запросить удаление: аккаунт скрывается сразу, данные стираются через
 * 14 дней (серверная задача), до этого срок можно отменить. Владелец
 * группы, где есть другие участники, получает GroupOwnerError.
 */
export async function requestAccountDeletion(): Promise<{ scheduled_for: string }> {
  try {
    return await pb.send("/api/account/delete-request", { method: "POST" });
  } catch (e) {
    const err = e as { status?: number; response?: { code?: string; group_name?: string } };
    if (err.status === 409 && err.response?.code === "group_owner") {
      throw new GroupOwnerError(String(err.response.group_name ?? ""));
    }
    throw e;
  }
}

/** Отменить удаление (человек вошёл и передумал). */
export async function cancelAccountDeletion(): Promise<void> {
  await pb.send("/api/account/delete-cancel", { method: "POST" });
}

/** "2 ноября" из "2026-11-02 09:30:00.000Z". */
export function deletionDateLabel(scheduledFor: string): string {
  const d = new Date(scheduledFor.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return "";
  return d.getDate() + " " + MONTHS_GENITIVE[d.getMonth()];
}
