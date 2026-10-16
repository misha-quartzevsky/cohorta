import { describe, it, expect } from "vitest";
import { getWeekParity, slotMatchesParity, findLectureForOccurrence } from "./weekParity";
import type { Lecture, ScheduleSlot } from "./types";

// Якорь — понедельник нечётной недели: 2026-10-12 (пн).
const anchor = new Date(2026, 9, 12, 12);

describe("getWeekParity", () => {
  it("неделя якоря — нечётная", () => {
    expect(getWeekParity(new Date(2026, 9, 12, 12), anchor)).toBe("odd");
    expect(getWeekParity(new Date(2026, 9, 16, 12), anchor)).toBe("odd");
  });

  it("следующая неделя — чётная", () => {
    expect(getWeekParity(new Date(2026, 9, 19, 12), anchor)).toBe("even");
  });

  it("через неделю снова нечётная", () => {
    expect(getWeekParity(new Date(2026, 9, 26, 12), anchor)).toBe("odd");
  });

  it("даты до якоря обрабатываются без сбоя знака", () => {
    // Неделя перед якорной — тоже чётная (чередование симметрично).
    expect(getWeekParity(new Date(2026, 9, 5, 12), anchor)).toBe("even");
    // Две недели назад — нечётная.
    expect(getWeekParity(new Date(2026, 8, 28, 12), anchor)).toBe("odd");
  });

  it("смена месяца и года не ломает чередование", () => {
    const p1 = getWeekParity(new Date(2026, 11, 28, 12), anchor);
    const p2 = getWeekParity(new Date(2027, 0, 4, 12), anchor);
    expect(p1).not.toBe(p2);
  });
});

describe("slotMatchesParity", () => {
  it("any подходит любой неделе", () => {
    expect(slotMatchesParity("any", "odd")).toBe(true);
    expect(slotMatchesParity("any", "even")).toBe(true);
    expect(slotMatchesParity(undefined, "odd")).toBe(true);
  });
  it("odd только нечётной", () => {
    expect(slotMatchesParity("odd", "odd")).toBe(true);
    expect(slotMatchesParity("odd", "even")).toBe(false);
  });
});

describe("findLectureForOccurrence", () => {
  const slot = { id: "slot1" } as ScheduleSlot;
  const lectures = [
    { id: "l1", slot: "slot1", lecture_date: "2026-10-16" },
    { id: "l2", slot: "slot1", lecture_date: "2026-10-23" },
    { id: "l3", slot: "slot2", lecture_date: "2026-10-16" },
  ] as Lecture[];

  it("находит по слоту и дате", () => {
    expect(findLectureForOccurrence(slot, "2026-10-16", lectures)?.id).toBe("l1");
  });
  it("нет совпадения — null", () => {
    expect(findLectureForOccurrence(slot, "2026-10-17", lectures)).toBeNull();
  });
  it("не путает слоты в одну дату", () => {
    expect(findLectureForOccurrence(slot, "2026-10-16", lectures)?.id).not.toBe("l3");
  });
});
