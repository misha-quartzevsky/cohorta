import { describe, it, expect } from "vitest";
import { toDateStr, fromDateStr, mondayOf, addDays, daysBetween, weekdayMon1 } from "./localDate";

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
