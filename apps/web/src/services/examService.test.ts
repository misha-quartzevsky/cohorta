import { describe, expect, it, vi } from "vitest";

import { todayStr } from "../lib/localDate";

const captured: { params?: Record<string, unknown> } = {};

vi.mock("../lib/pocketbase", () => ({
  currentUserId: () => "u1",
  pb: {
    filter: (_expr: string, params: Record<string, unknown>) => {
      captured.params = params;
      return "filter";
    },
    collection: () => ({ getFirstListItem: async () => ({ id: "e1" }) }),
  },
}));

import { fetchUpcomingExam } from "./examService";

describe("fetchUpcomingExam: «сегодня» для фильтра", () => {
  // Известное расхождение (не исправляется, см. «Нашёл по пути»): день берётся по UTC
  // (`toISOString`), а остальные места приложения считают день по локальному времени (`todayStr`).
  // Они расходятся около полуночи, если часовой пояс не UTC.
  it("день по UTC", async () => {
    await fetchUpcomingExam(new Date("2026-10-26T22:30:00.000Z"));
    expect(captured.params?.today).toBe("2026-10-26");
  });
  it("локальный todayStr в тот же момент даёт другой день в Europe/Moscow", () => {
    const now = new Date("2026-10-26T22:30:00.000Z");
    const moscow = Intl.DateTimeFormat().resolvedOptions().timeZone === "Europe/Moscow";
    expect(todayStr(now)).toBe(moscow ? "2026-10-27" : "2026-10-26");
  });
});
