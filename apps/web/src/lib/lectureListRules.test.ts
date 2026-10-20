import { describe, it, expect } from "vitest";
import { ALL_PERIODS, lectureInPeriod, openStartSteps } from "./lectureListRules";
import type { Course, Lecture } from "./types";

const lecture = (course?: Partial<Course>): Lecture =>
  ({
    id: "l1",
    title: "Лекция",
    field: course ? "c1" : "",
    expand: course ? { field: { id: "c1", name: "Предмет", ...course } } : undefined,
  }) as unknown as Lecture;

describe("openStartSteps", () => {
  it("пустой аккаунт: все три шага", () => {
    expect(openStartSteps({ hasSubjects: false, hasPairs: false, hasLectures: false })).toEqual([
      "subjects",
      "pairs",
      "lecture",
    ]);
  });

  it("выполненные шаги исчезают", () => {
    expect(openStartSteps({ hasSubjects: true, hasPairs: false, hasLectures: false })).toEqual(["pairs", "lecture"]);
    expect(openStartSteps({ hasSubjects: true, hasPairs: true, hasLectures: false })).toEqual(["lecture"]);
  });

  it("всё выполнено: карточка исчезает", () => {
    expect(openStartSteps({ hasSubjects: true, hasPairs: true, hasLectures: true })).toEqual([]);
  });
});

describe("lectureInPeriod", () => {
  it("«Все периоды» пропускает всё", () => {
    expect(lectureInPeriod(lecture({ semesters: "s1" }), ALL_PERIODS)).toBe(true);
  });

  it("лекция попадает в период своего предмета", () => {
    expect(lectureInPeriod(lecture({ semesters: "s3" }), "s3")).toBe(true);
    expect(lectureInPeriod(lecture({ semesters: "s2" }), "s3")).toBe(false);
  });

  it("лекция без предмета видна в любом периоде", () => {
    expect(lectureInPeriod(lecture(), "s3")).toBe(true);
  });
});
