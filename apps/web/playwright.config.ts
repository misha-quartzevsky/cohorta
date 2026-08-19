/**
 * ============================================
 *  playwright.config.ts — E2E smoke + stability
 * ============================================
 *
 * - Только Firefox (движок gecko).
 * - workers: 1 — робот ходит по страницам последовательно, в headed-окне
 *   видно каждый шаг.
 * - trace: on-first-retry — трейс/видео падения пишется на повторе.
 *
 * Перед прогоном должен быть доступен PocketBase на 8090 (npm run pocketbase).
 * Vite dev-сервер (5173) поднимается автоматически, если не запущен.
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: "list",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:5173",
    headless: false,
    trace: "on-first-retry",
    // Ширина 1280px важна: при <1180px лекционный сайдбар скрывается
    // медиа-запросом, а тесты считают его видимым.
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});