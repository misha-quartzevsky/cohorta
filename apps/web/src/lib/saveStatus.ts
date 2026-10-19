import { useSyncExternalStore } from "react";

/**
 * Полоса сохранения вверху страницы (Screen-session-states, блок 3):
 * «Нет связи», «Не удалось сохранить», «Связь вернулась, всё сохранено».
 * Один общий статус на приложение; пишет его автосохранение лекции и
 * очередь черновиков, читает components/SaveStatusBanner.tsx.
 */
export type SaveStatus = "ok" | "offline" | "failed" | "restored";

let status: SaveStatus = "ok";
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

export function getSaveStatus(): SaveStatus {
  return status;
}

export function setSaveStatus(next: SaveStatus): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (next === status) return;
  status = next;
  listeners.forEach((l) => l());
  // «Связь вернулась» показываем на пару секунд.
  if (next === "restored") {
    timer = setTimeout(() => setSaveStatus("ok"), 3500);
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useSaveStatus(): SaveStatus {
  return useSyncExternalStore(subscribe, getSaveStatus, getSaveStatus);
}
