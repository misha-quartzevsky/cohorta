import { describe, it, expect } from "vitest";
import { findSlotConflict, parityOverlaps, parityPhrase } from "./slotConflict";
import type { ScheduleSlot } from "./types";

const slot = (over: Partial<ScheduleSlot>): ScheduleSlot =>
  ({ id: "a", weekday: 3, pair_number: 2, week_parity: "odd", subject: "s", ...over }) as ScheduleSlot;

describe("parityOverlaps", () => {
  it("any пересекается с любой", () => {
    expect(parityOverlaps("any", "odd")).toBe(true);
    expect(parityOverlaps("even", "any")).toBe(true);
  });
  it("нечётная и чётная не пересекаются", () => {
    expect(parityOverlaps("odd", "even")).toBe(false);
  });
  it("одинаковая пересекается", () => {
    expect(parityOverlaps("odd", "odd")).toBe(true);
  });
});

describe("findSlotConflict", () => {
  const slots = [slot({})];
  it("та же клетка и чётность — конфликт", () => {
    expect(findSlotConflict(slots, { weekday: 3, pair_number: 2, week_parity: "odd" })?.id).toBe("a");
  });
  it("та же клетка, «каждая» против нечётной — конфликт", () => {
    expect(findSlotConflict(slots, { weekday: 3, pair_number: 2, week_parity: "any" })).not.toBeNull();
  });
  it("та же клетка, чётная против нечётной — можно", () => {
    expect(findSlotConflict(slots, { weekday: 3, pair_number: 2, week_parity: "even" })).toBeNull();
  });
  it("другой день или номер пары — можно", () => {
    expect(findSlotConflict(slots, { weekday: 4, pair_number: 2, week_parity: "odd" })).toBeNull();
    expect(findSlotConflict(slots, { weekday: 3, pair_number: 3, week_parity: "odd" })).toBeNull();
  });
  it("правка той же пары не конфликтует сама с собой", () => {
    expect(findSlotConflict(slots, { weekday: 3, pair_number: 2, week_parity: "odd" }, "a")).toBeNull();
  });
});

describe("parityPhrase", () => {
  it("подписи", () => {
    expect(parityPhrase("odd")).toBe("на нечётных неделях");
    expect(parityPhrase("even")).toBe("на чётных неделях");
    expect(parityPhrase("any")).toBe("на каждой неделе");
  });
});
