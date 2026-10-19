/**
 * ============================================
 *  draftQueue.ts — очередь несохранённого текста лекции (B6)
 * ============================================
 *
 * Если сохранить лекцию не вышло (нет связи, сервер недоступен, сессия
 * истекла), последний текст остаётся на этом устройстве: по одному
 * черновику на лекцию в localStorage. Он уйдёт на сервер, когда связь
 * вернётся или человек войдёт снова (services/draftSync.ts), а при
 * открытии лекции подставится в редактор.
 *
 * Очередь только для текста лекций. Задачи, карточки и билеты по-прежнему
 * сохраняются сразу, без очереди.
 */

const PREFIX = "cohorta:draft:lecture:";

export interface LectureDraft {
  id: string;
  title: string;
  /** Содержимое в виде, готовом к записи (с токенами [[file:…]]). */
  content: string;
  tags?: string[];
  /** Когда черновик записан, мс. */
  ts: number;
}

export type SaveFailure = "offline" | "session" | "failed";

/** Записать черновик. false — хранилище недоступно или переполнено. */
export function saveDraft(d: Omit<LectureDraft, "ts"> & { ts?: number }): boolean {
  try {
    localStorage.setItem(PREFIX + d.id, JSON.stringify({ ...d, ts: d.ts ?? Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function readDraft(id: string): LectureDraft | null {
  try {
    const raw = localStorage.getItem(PREFIX + id);
    if (!raw) return null;
    const d = JSON.parse(raw) as LectureDraft;
    return typeof d?.content === "string" ? d : null;
  } catch {
    return null;
  }
}

export function removeDraft(id: string): void {
  try {
    localStorage.removeItem(PREFIX + id);
  } catch {
    /* ничего: хранилище недоступно */
  }
}

export function listDrafts(): LectureDraft[] {
  const out: LectureDraft[] = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) {
        const d = readDraft(k.slice(PREFIX.length));
        if (d) out.push(d);
      }
    }
  } catch {
    /* ничего */
  }
  return out.sort((a, b) => a.ts - b.ts);
}

/**
 * Что случилось при сохранении:
 *  - session — токен истёк, нужен вход;
 *  - offline — связи нет или сервер не отвечает (стоит повторить позже);
 *  - failed  — сервер отказал (например, правила доступа), повтор не поможет.
 */
export function classifySaveError(err: unknown, authValid: boolean): SaveFailure {
  if (!authValid) return "session";
  const e = err as { status?: number; message?: string } | null;
  if (e && typeof e.status === "number") {
    if (e.status === 401) return "session";
    if (e.status === 0 || e.status >= 500) return "offline";
    return "failed";
  }
  if (err instanceof TypeError) return "offline";
  if (e?.message && /timeout|network|fetch|abort|failed to connect/i.test(e.message)) return "offline";
  return "failed";
}
