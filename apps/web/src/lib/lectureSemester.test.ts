import { describe, it, expect, beforeEach } from "vitest";
import { semesterSlugForLecture } from "./lectureSemester";
import type { Lecture, Semester } from "./types";

const sems = [
  { id: "s1", slug: "1", order: 1 },
  { id: "s3", slug: "3", order: 3, is_current: true },
] as Semester[];

const lec = (course?: { semesters: string }) => ({ id: "l", expand: course ? { field: course } : undefined }) as unknown as Lecture;

describe("semesterSlugForLecture", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    // @ts-expect-error тестовая подмена localStorage
    globalThis.localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } };
  });
  it("берёт период предмета лекции", () => {
    expect(semesterSlugForLecture(lec({ semesters: "s1" }), sems)).toBe("1");
  });
  it("без предмета и без истории — текущий период", () => {
    expect(semesterSlugForLecture(lec(), sems)).toBe("3");
  });
  it("последний посещённый важнее текущего", () => {
    localStorage.setItem("cohorta:lastSemester", "1");
    expect(semesterSlugForLecture(lec(), sems)).toBe("1");
  });
  it("периодов нет — пустая строка", () => {
    expect(semesterSlugForLecture(lec(), [])).toBe("");
  });
});
