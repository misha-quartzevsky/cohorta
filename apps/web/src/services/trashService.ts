/**
 * ============================================
 *  trashService.ts — корзина (B6)
 * ============================================
 *
 * Лекции и предметы удаляются не сразу: серверные маршруты
 * (`pb_hooks/trash.pb.js`) ставят `deleted_at`, запись исчезает из всех
 * списков и для тех, кому открыт доступ, и 30 дней лежит в корзине.
 * Восстановление возвращает её вместе с доступами.
 */

import { pb } from "../lib/pocketbase";
import { parsePbDate } from "../lib/format";
import { MS_PER_DAY } from "../lib/localDate";

export const TRASH_DAYS = 30;

export type TrashType = "lecture" | "course";

export interface TrashItem {
  type: TrashType;
  id: string;
  title: string;
  /** Для лекции — название её предмета. */
  course_name?: string;
  cover_seed?: number | null;
  /** «2026-10-15 09:30:00.000Z». */
  deleted_at: string;
  /** Для предмета — сколько лекций ушло вместе с ним. */
  lectures: number;
}

export async function fetchTrash(): Promise<TrashItem[]> {
  const res = await pb.send<{ items: TrashItem[] }>("/api/trash", { method: "GET" });
  return res.items ?? [];
}

export async function moveToTrash(type: TrashType, id: string): Promise<void> {
  await pb.send("/api/trash/delete", { method: "POST", body: { type, id } });
}

export async function restoreFromTrash(type: TrashType, id: string): Promise<void> {
  await pb.send("/api/trash/restore", { method: "POST", body: { type, id } });
}

export async function purgeFromTrash(type: TrashType, id: string): Promise<void> {
  await pb.send("/api/trash/purge", { method: "POST", body: { type, id } });
}

export async function emptyTrash(): Promise<void> {
  await pb.send("/api/trash/empty", { method: "POST" });
}

/** Сколько дней ещё лежит в корзине (минимум 0). */
export function trashDaysLeft(deletedAt: string, now: Date = new Date()): number {
  const t = parsePbDate(deletedAt)?.getTime();
  if (t === undefined) return TRASH_DAYS;
  const left = TRASH_DAYS - Math.floor((now.getTime() - t) / MS_PER_DAY);
  return Math.max(0, Math.min(TRASH_DAYS, left));
}
