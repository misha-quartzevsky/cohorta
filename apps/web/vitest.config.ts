import { defineConfig } from "vitest/config";

// Юнит-тесты чистых функций. Только src/**/*.test.ts, чтобы не пересекаться
// с Playwright-спеками в tests/ (*.spec.ts).
// Каждый тест идёт дважды: в UTC и в Europe/Moscow (даты считают по локальному времени).
const shared = { include: ["src/**/*.test.ts"], environment: "node" as const };

export default defineConfig({
  test: {
    projects: [
      { test: { ...shared, name: "utc", env: { TZ: "UTC" } } },
      { test: { ...shared, name: "msk", env: { TZ: "Europe/Moscow" } } },
    ],
  },
});
