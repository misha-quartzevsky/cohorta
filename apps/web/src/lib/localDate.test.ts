import { describe, it, expect } from "vitest";
import { toDateStr, fromDateStr, mondayOf, addDays, daysBetween, weekdayMon1, calendarDaysUntil } from "./localDate";

describe("localDate", () => {
  it("toDateStr/fromDateStr круговой обход", () => {
    expect(toDateStr(fromDateStr("2026-10-16"))).toBe("2026-10-16");
  });

  it("mondayOf приводит к понедельнику", () => {
    // 2026-10-16 — пятница; понедельник недели — 2026-10-12.
    expect(toDateStr(mondayOf(new Date(2026, 9, 16, 12)))).toBe("2026-10-12");
    // Сам понедельник остаётся собой.
    expect(toDateStr(mondayOf(new Date(2026, 9, 12, 12)))).toBe("2026-10-12");
    // Воскресенье относится к той же неделе.
    expect(toDateStr(mondayOf(new Date(2026, 9, 18, 12)))).toBe("2026-10-12");
  });

  it("addDays и daysBetween", () => {
    const d = fromDateStr("2026-10-16");
    expect(toDateStr(addDays(d, 7))).toBe("2026-10-23");
    expect(daysBetween(fromDateStr("2026-10-16"), fromDateStr("2026-10-23"))).toBe(7);
  });

  it("weekdayMon1: пн=1, вс=7", () => {
    expect(weekdayMon1(new Date(2026, 9, 12, 12))).toBe(1);
    expect(weekdayMon1(new Date(2026, 9, 18, 12))).toBe(7);
  });
});

describe("calendarDaysUntil", () => {
  // «Сейчас» и цель строятся от локальных часов: результат не зависит от часового пояса.
  const pb = (d: Date) => d.toISOString().replace("T", " ");
  const now = new Date(2026, 9, 26, 9, 0);
  it("даты нет или она не разбирается — null", () => {
    expect(calendarDaysUntil(undefined, now)).toBeNull();
    expect(calendarDaysUntil("", now)).toBeNull();
    expect(calendarDaysUntil("не дата", now)).toBeNull();
  });
  it("сегодня — 0 независимо от часа", () => {
    expect(calendarDaysUntil(pb(new Date(2026, 9, 26, 18, 0)), now)).toBe(0);
  });
  it("завтра утром — 1, через две недели — 14", () => {
    expect(calendarDaysUntil(pb(new Date(2026, 9, 27, 8, 0)), now)).toBe(1);
    expect(calendarDaysUntil(pb(new Date(2026, 10, 9, 12, 0)), now)).toBe(14);
  });
  it("прошедшая дата — отрицательное число", () => {
    expect(calendarDaysUntil(pb(new Date(2026, 9, 25, 12, 0)), now)).toBe(-1);
  });
});
