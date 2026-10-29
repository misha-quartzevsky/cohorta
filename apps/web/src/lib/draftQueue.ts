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

import { currentUserId } from "./pocketbase";

// Ключ содержит id пользователя: на общем устройстве чужой черновик не виден и не отправляется (аудит 2026-10, C-5).
const NS = "cohorta:draft:v2:";
/** Ключ до исправления C-5 (без владельца): у такого черновика нет хозяина, при запуске очереди он удаляется. */
const LEGACY_PREFIX = "cohorta:draft:lecture:";
const prefixOf = (uid: string) => `${NS}${uid}:lecture:`;

export interface LectureDraft {
  id: string;
  /** Чей черновик: id пользователя, который его писал. */
  uid: string;
  title: string;
  /** Содержимое в виде, готовом к записи (с токенами [[file:…]]). */
  content: string;
  tags?: string[];
  /** Когда черновик записан, мс. */
  ts: number;
}

export type SaveFailure = "offline" | "session" | "failed";

/**
 * Записать черновик текущего пользователя. false — хранилище недоступно или переполнено
 * (или некому приписать черновик: нет сессии).
 */
export function saveDraft(d: Omit<LectureDraft, "ts" | "uid"> & { ts?: number }): boolean {
  const uid = currentUserId();
  if (!uid) return false;
  try {
    localStorage.setItem(prefixOf(uid) + d.id, JSON.stringify({ ...d, uid, ts: d.ts ?? Date.now() }));
    return true;
  } catch {
    return false;
  }
}

/** Черновик текущего пользователя; чужой (в теле другой uid) не отдаётся. */
export function readDraft(id: string): LectureDraft | null {
  const uid = currentUserId();
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(prefixOf(uid) + id);
    if (!raw) return null;
    const d = JSON.parse(raw) as LectureDraft;
    return typeof d?.content === "string" && d.uid === uid ? d : null;
  } catch {
    return null;
  }
}

/** Удалить черновик текущего пользователя: чужие этим вызовом не затрагиваются. */
export function removeDraft(id: string): void {
  const uid = currentUserId();
  if (!uid) return;
  try {
    localStorage.removeItem(prefixOf(uid) + id);
  } catch {
    /* ничего: хранилище недоступно */
  }
}

export function listDrafts(): LectureDraft[] {
  const uid = currentUserId();
  const out: LectureDraft[] = [];
  if (!uid) return out;
  const prefix = prefixOf(uid);
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        const d = readDraft(k.slice(prefix.length));
        if (d) out.push(d);
      }
    }
  } catch {
    /* ничего */
  }
  return out.sort((a, b) => a.ts - b.ts);
}

/** Ключи localStorage, подходящие под условие (список снимается до удаления: удаление сдвигает индексы). */
function keysWhere(test: (key: string) => boolean): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && test(k)) keys.push(k);
    }
  } catch {
    /* ничего */
  }
  return keys;
}

function removeKeys(keys: string[]): void {
  for (const k of keys) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ничего */
    }
  }
}

/** Выход: удалить все черновики текущего пользователя с этого устройства. */
export function clearMyDrafts(): void {
  const uid = currentUserId();
  if (uid) removeKeys(keysWhere((k) => k.startsWith(prefixOf(uid))));
}

/**
 * При запуске очереди: убрать черновики без хозяина (старый формат ключа) и чужие (другой пользователь вошёл на
 * этом устройстве после выхода или истечения сессии прежнего). Приватность общего устройства важнее чужих несохранённых правок.
 */
export function purgeForeignDrafts(): void {
  const uid = currentUserId();
  removeKeys(keysWhere((k) => k.startsWith(LEGACY_PREFIX) || (k.startsWith(NS) && !(uid && k.startsWith(prefixOf(uid))))));
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
