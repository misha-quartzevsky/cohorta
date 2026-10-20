import { describe, it, expect } from "vitest";
import { taskInPeriod } from "./taskView";
import type { Task } from "./types";

const courses = [
  { id: "c1", semesters: "s3" },
  { id: "c2", semesters: "s2" },
];
const task = (subject?: string) => ({ id: "t", title: "x", subject }) as Task;

describe("taskInPeriod", () => {
  it("«Все периоды» пропускает всё", () => {
    expect(taskInPeriod(task("c2"), courses, "all")).toBe(true);
  });
  it("задача без предмета видна в любом периоде", () => {
    expect(taskInPeriod(task(undefined), courses, "s3")).toBe(true);
    expect(taskInPeriod(task(""), courses, "s2")).toBe(true);
  });
  it("задача предмета видна только в его периоде", () => {
    expect(taskInPeriod(task("c1"), courses, "s3")).toBe(true);
    expect(taskInPeriod(task("c1"), courses, "s2")).toBe(false);
  });
  it("предмет не найден — задачу не прячем", () => {
    expect(taskInPeriod(task("gone"), courses, "s3")).toBe(true);
  });
});
