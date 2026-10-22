import { describe, expect, it } from "vitest";
import { daysLabel, daysUntil, examDateLabel, examWhen } from "./groupExamText";

const now = new Date(2026, 9, 21, 15, 0);

describe("groupExamText", () => {
  it("считает дни до даты по календарю, а не по часам", () => {
    expect(daysUntil("2026-10-21 00:00:00.000Z", now)).toBe(0);
    expect(daysUntil("2026-10-22 00:00:00.000Z", now)).toBe(1);
    expect(daysUntil("2027-01-12 00:00:00.000Z", now)).toBe(83);
  });
  it("без даты и с прошедшей датой", () => {
    expect(daysUntil("", now)).toBeNull();
    expect(daysUntil("2026-10-01 00:00:00.000Z", now)).toBe(0);
  });
  it("склоняет дни", () => {
    expect(daysLabel(0)).toBe("сегодня");
    expect(daysLabel(1)).toBe("завтра");
    expect(daysLabel(2)).toBe("через 2 дня");
    expect(daysLabel(87)).toBe("через 87 дней");
    expect(daysLabel(21)).toBe("через 21 день");
  });
  it("строка экзамена", () => {
    expect(examWhen("", () => "")).toBe("Дата не задана");
  });
  it("подпись даты экзамена в импорте", () => {
    expect(examDateLabel("2027-01-12 00:00:00.000Z")).toBe("экзамен 12 января");
    expect(examDateLabel("")).toBe("дата экзамена не задана");
    expect(examDateLabel(undefined)).toBe("дата экзамена не задана");
  });
});
