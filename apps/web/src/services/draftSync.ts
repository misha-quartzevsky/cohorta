/**
 * ============================================
 *  draftSync.ts — отправка черновиков, когда можно (B6)
 * ============================================
 *
 * Повторяет сохранение лекций из очереди (lib/draftQueue.ts): когда
 * вернулась сеть, каждые 15 секунд, пока в очереди что-то есть, и сразу
 * после входа. Работает, пока приложение открыто: фоновой отправки при
 * закрытой вкладке нет — черновик дождётся следующего открытия.
 */

import { classifySaveError, listDrafts, purgeForeignDrafts, removeDraft, readDraft } from "../lib/draftQueue";
import { pb } from "../lib/pocketbase";
import { getSaveStatus, setSaveStatus } from "../lib/saveStatus";
import { updateLecture } from "./lectureService";

const RETRY_MS = 15_000;
let running = false;

/** Отправить всё из очереди. true — очередь пуста. */
export async function syncDrafts(): Promise<boolean> {
  if (running || !pb.authStore.isValid) return listDrafts().length === 0;
  running = true;
  try {
    const before = listDrafts();
    for (const d of before) {
      try {
        await updateLecture(d.id, d.title, d.content, d.tags);
        // Пока отправляли, человек мог дописать — тогда в очереди уже новая версия.
        const now = readDraft(d.id);
        if (!now || now.ts === d.ts) removeDraft(d.id);
      } catch (e) {
        // Лекции больше нет (удалена или закрыта) — этот черновик не нужен (removeDraft трогает только черновики текущего пользователя).
        if ((e as { status?: number })?.status === 404) {
          removeDraft(d.id);
          continue;
        }
        const kind = classifySaveError(e, pb.authStore.isValid);
        if (kind === "failed") {
          // Сервер отказал — повторять бессмысленно, но черновик не теряем.
          setSaveStatus("failed");
        }
        return false;
      }
    }
    const empty = listDrafts().length === 0;
    if (empty && before.length > 0 && (getSaveStatus() === "offline" || getSaveStatus() === "failed")) {
      setSaveStatus("restored");
    }
    return empty;
  } finally {
    running = false;
  }
}

/** Перед выходом: отправить черновики, если связь есть (не дольше `limitMs`); дальше выход всё равно удалит оставшиеся. */
export async function flushDraftsBeforeSignOut(limitMs = 3000): Promise<void> {
  if (listDrafts().length === 0) return;
  await Promise.race([syncDrafts(), new Promise<void>((resolve) => setTimeout(resolve, limitMs))]).catch(() => undefined);
}

/** Запустить повторные попытки на всё время работы приложения. Возвращает отписку. */
export function startDraftSync(): () => void {
  purgeForeignDrafts();
  const tick = () => {
    if (listDrafts().length > 0) void syncDrafts();
  };
  const timer = setInterval(tick, RETRY_MS);
  window.addEventListener("online", tick);
  document.addEventListener("visibilitychange", tick);
  tick();
  return () => {
    clearInterval(timer);
    window.removeEventListener("online", tick);
    document.removeEventListener("visibilitychange", tick);
  };
}
