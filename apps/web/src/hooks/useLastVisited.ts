/**
 * ============================================
 *  useLastVisited.ts — Last Visited Hook
 * ============================================
 *
 * Возвращает последнюю открытую лекцию (блок «Продолжить» на Dashboard).
 * Запись берётся из localStorage, но показывается только после проверки, что
 * лекция ещё существует и доступна (удалена, в корзине, доступ снят — записи
 * нет): иначе «Продолжить» вело бы на 404. Устаревшая запись стирается.
 * Подписывается на `storage` для изменений в других вкладках.
 */

import { useEffect, useState } from "react";
import {
  readLastVisited,
  clearLastVisited,
  lastVisitedSlug,
  LAST_VISITED_KEY,
  type LastVisitedEntry,
} from "../lib/lastVisited";
import { pb } from "../lib/pocketbase";

export type { LastVisitedEntry };

/** Лекция по слагу есть и видна текущему пользователю (правила чтения скрывают удалённые). */
async function lectureExists(slug: string): Promise<boolean> {
  const escaped = slug.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const res = await pb.collection("lectures").getList(1, 1, { filter: `slug="${escaped}"`, fields: "id" });
  return res.totalItems > 0;
}

/** Последняя посещённая лекция (null — не открывали или её больше нет). */
export function useLastVisited(): LastVisitedEntry | null {
  const [stored, setStored] = useState<LastVisitedEntry | null>(() => readLastVisited());
  const [verified, setVerified] = useState<string | null>(null);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LAST_VISITED_KEY) setStored(readLastVisited());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!stored) return;
    let cancelled = false;
    void lectureExists(lastVisitedSlug(stored.to))
      .then((exists) => {
        if (cancelled) return;
        if (exists) setVerified(stored.to);
        else {
          clearLastVisited();
          setStored(null);
        }
      })
      // Нет связи — не прячем «Продолжить», проверим в следующий раз.
      .catch(() => !cancelled && setVerified(stored.to));
    return () => {
      cancelled = true;
    };
  }, [stored]);

  return stored && verified === stored.to ? stored : null;
}
