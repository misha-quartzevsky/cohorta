/**
 * ============================================
 *  useLastVisited.ts — Last Visited Hook
 * ============================================
 *
 * Возвращает последнюю открытую лекцию (блок «Продолжить» на Dashboard).
 * Читает localStorage синхронно при первом рендере (без мерцания) и
 * подписывается на `storage`, чтобы подхватывать изменения в других вкладках.
 */

import { useEffect, useState } from "react";
import {
  readLastVisited,
  LAST_VISITED_KEY,
  type LastVisitedEntry,
} from "../lib/lastVisited";

export type { LastVisitedEntry };

/** Последняя посещённая лекция (null — пока не открывали). */
export function useLastVisited(): LastVisitedEntry | null {
  const [entry, setEntry] = useState<LastVisitedEntry | null>(() =>
    readLastVisited()
  );

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LAST_VISITED_KEY) setEntry(readLastVisited());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return entry;
}
