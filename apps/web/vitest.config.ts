import { defineConfig } from "vitest/config";

// Юнит-тесты чистых функций. Только src/**/*.test.ts, чтобы не пересекаться
// с Playwright-спеками в tests/ (*.spec.ts).
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
