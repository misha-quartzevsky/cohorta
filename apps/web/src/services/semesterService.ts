/**
 * ============================================
 *  semesterService.ts — Semester / Period API Service
 * ============================================
 *
 * Все обращения к коллекции `semesters`. С введением онбординга
 * коллекция стала per-user («периоды обучения»): у каждой записи
 * есть владелец `user`, правила PocketBase отдают только свои
 * строки. В URL период по-прежнему адресуется полем `slug`
 * (= `String(order)`), уникальным в пределах пользователя.
 */

import { pb } from "../lib/pocketbase";
import type { PeriodType, Semester } from "../lib/types";
import { FIELDS, semesterOrder } from "../lib/types";
import { withTimeout } from "../lib/withTimeout";

/** Id текущего пользователя ("" — не залогинен). */
function currentUserId(): string {
  return String(pb.authStore.record?.id ?? "");
}

/**
 * Загрузить периоды текущего пользователя, отсортированные по
 * `order` (fallback — числовой `slug`).
 *
 * @returns Resolves to an array of Semester records.
 */
export async function fetchSemesters(): Promise<Semester[]> {
  // Сортировку не отдаём в PB (поле `order` может отсутствовать на
  // не-мигрированном бэкенде → 400); сортируем на клиенте.
  const records = await withTimeout(
    pb.collection("semesters").getFullList<Semester>(),
    "список периодов"
  );

  return [...records].sort((a, b) => semesterOrder(a) - semesterOrder(b));
}

/** Периоды текущего пользователя (алиас `fetchSemesters` для читаемости в онбординге). */
export async function fetchMyPeriods(): Promise<Semester[]> {
  return fetchSemesters();
}

export interface NewPeriod {
  label: string;
  order: number;
  type: PeriodType;
  is_current?: boolean;
}

/** Создать один период за текущего пользователя. `slug` = `String(order)`. */
export async function createPeriod(period: NewPeriod): Promise<Semester> {
  return pb.collection("semesters").create<Semester>({
    [FIELDS.semesterSlug]: String(period.order),
    [FIELDS.periodLabel]: period.label,
    [FIELDS.periodOrder]: period.order,
    [FIELDS.periodType]: period.type,
    [FIELDS.periodIsCurrent]: period.is_current ?? false,
    [FIELDS.periodUser]: currentUserId(),
  });
}

/** Точечно обновить период (переименование, отметка «текущий»). */
export async function updatePeriod(
  id: string,
  patch: Partial<Pick<Semester, "label" | "order" | "type" | "is_current">> & {
    slug?: string;
  }
): Promise<Semester> {
  return pb.collection("semesters").update<Semester>(id, patch);
}

/** Удалить один период. */
export async function deletePeriod(id: string): Promise<void> {
  await pb.collection("semesters").delete(id);
}

/**
 * Удалить ВСЕ периоды текущего пользователя. Используется на экране 6
 * онбординга перед повторной генерацией набора — новые `slug`/`order`
 * не перезаписывают старые записи, а коллизия уникального `slug`
 * уронила бы создание. Кидает, если удаление оборвалось: вызывающий
 * НЕ должен переходить к генерации нового набора.
 */
export async function deleteAllMyPeriods(): Promise<void> {
  const rows = await fetchMyPeriods();
  for (const row of rows) {
    await deletePeriod(row.id);
  }
}
