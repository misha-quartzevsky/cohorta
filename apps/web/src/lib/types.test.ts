import { describe, expect, it } from "vitest";
import {
  examDaysLeft,
  isPremiumActive,
  lectureExcerpt,
  lectureHref,
  type Course,
  type Exam,
  type Lecture,
  type User,
} from "./types";

const user = (premium_until?: string) => ({ id: "u1", email: "a@b.c", premium_until }) as User;
const exam = (exam_date?: string) => ({ id: "e1", exam_date }) as Exam;
const lecture = (partial: Record<string, unknown>) => ({ id: "l1", ...partial }) as unknown as Lecture;

describe("isPremiumActive", () => {
  const now = new Date("2026-10-26T12:00:00.000Z");
  it("пусто — нет премиума", () => {
    expect(isPremiumActive(user(), now)).toBe(false);
    expect(isPremiumActive(user("  "), now)).toBe(false);
  });
  it("дата в будущем (формат PocketBase) — есть", () => {
    expect(isPremiumActive(user("2026-10-27 00:00:00.000Z"), now)).toBe(true);
  });
  it("дата в будущем (ISO из хука) — есть", () => {
    expect(isPremiumActive(user("2026-11-09T12:00:00.000Z"), now)).toBe(true);
  });
  it("дата в прошлом — нет", () => {
    expect(isPremiumActive(user("2026-10-25 00:00:00.000Z"), now)).toBe(false);
  });
  it("ровно сейчас — нет (строго позже)", () => {
    expect(isPremiumActive(user("2026-10-26 12:00:00.000Z"), now)).toBe(false);
  });
  it("мусор — нет", () => {
    expect(isPremiumActive(user("когда-нибудь"), now)).toBe(false);
  });
});

describe("examDaysLeft", () => {
  // Даты строятся от локальных часов, чтобы тест не зависел от часового пояса.
  const pb = (d: Date) => d.toISOString().replace("T", " ");
  const now = new Date(2026, 9, 26, 9, 0);
  it("не задана — null", () => {
    expect(examDaysLeft(exam(), now)).toBeNull();
    expect(examDaysLeft(exam(""), now)).toBeNull();
  });
  it("не разбирается — null", () => {
    expect(examDaysLeft(exam("не дата"), now)).toBeNull();
  });
  it("сегодня — 0, даже если экзамен позже по часам", () => {
    expect(examDaysLeft(exam(pb(new Date(2026, 9, 26, 18, 0))), now)).toBe(0);
  });
  it("завтра утром — 1", () => {
    expect(examDaysLeft(exam(pb(new Date(2026, 9, 27, 8, 0))), now)).toBe(1);
  });
  it("через две недели — 14", () => {
    expect(examDaysLeft(exam(pb(new Date(2026, 10, 9, 12, 0))), now)).toBe(14);
  });
  it("вчера — минус один", () => {
    expect(examDaysLeft(exam(pb(new Date(2026, 9, 25, 12, 0))), now)).toBe(-1);
  });
});

describe("lectureHref", () => {
  const course = { id: "c1", slug: "philosophy" } as Course;
  it("лекция с предметом — под семестром и предметом", () => {
    const l = lecture({ slug: "lec-1", field: "c1", expand: { field: course } });
    expect(lectureHref(l, "5")).toBe("/s/5/philosophy/lec-1");
  });
  it("лекция без предмета — /note", () => {
    expect(lectureHref(lecture({ slug: "lec-1" }), "5")).toBe("/note/lec-1");
  });
  it("предмет указан, но не раскрыт (expand) — /note", () => {
    expect(lectureHref(lecture({ slug: "lec-1", field: "c1" }), "5")).toBe("/note/lec-1");
  });
  it("без slug берёт id, у предмета тоже", () => {
    const l = lecture({ field: "c2", expand: { field: { id: "c2" } } });
    expect(lectureHref(l, "2")).toBe("/s/2/c2/l1");
  });
});

describe("lectureExcerpt", () => {
  it("короткий текст целиком, теги и токены файлов убраны", () => {
    const l = lecture({ content: "<p>Привет <b>мир</b></p>[[file:a.png]]" });
    expect(lectureExcerpt(l)).toBe("Привет мир");
  });
  it("длинный режется по границе слова с многоточием", () => {
    const l = lecture({ content: "<p>слово слово слово слово</p>" });
    expect(lectureExcerpt(l, 13)).toBe("слово слово…");
  });
  it("одно длинное слово режется по длине", () => {
    const l = lecture({ content: "абвгдежзик" });
    expect(lectureExcerpt(l, 4)).toBe("абвг…");
  });
});
