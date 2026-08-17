/**
 * ============================================
 *  pocketbase.ts — PocketBase Client Init
 * ============================================
 *
 * The PocketBase URL is read from the Vite environment
 * (`VITE_PB_URL`, falling back to `VITE_POCKETBASE_URL`
 * for backward compatibility).  This makes the
 * endpoint configurable per-environment without
 * code changes.
 */

import PocketBase from "pocketbase";

const url =
  import.meta.env.VITE_PB_URL ??
  import.meta.env.VITE_POCKETBASE_URL ??
  "http://127.0.0.1:8090";

export const pb = new PocketBase(url);

// Отключаем "авто-отмену" запросов — иначе в dev-режиме React
// (двойной вызов useEffect) отменяет наш запрос к курсам/лекциям.
pb.autoCancellation(false);
