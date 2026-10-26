import { describe, expect, it } from "vitest";
import { dueLabel, isOpen, isOverdue, taskInPeriod } from "./taskView";
import type { Task } from "./types";

const task = (partial: Partial<Task>) => ({ id: "t1", owner: "u1", title: "Задача", ...partial }) as Task;

describe("isOpen / isOverdue", () => {
  it("без done_at задача открыта", () => {
    expect(isOpen(task({}))).toBe(true);
    expect(isOpen(task({ done_at: "2026-10-20" }))).toBe(false);
  });
  it("просрочена: открыта и срок раньше сегодня", () => {
    expect(isOverdue(task({ due: "2026-10-19" }), "2026-10-20")).toBe(true);
  });
  it("срок сегодня — ещё не просрочена", () => {
    expect(isOverdue(task({ due: "2026-10-20" }), "2026-10-20")).toBe(false);
  });
  it("без срока не просрочена", () => {
    expect(isOverdue(task({}), "2026-10-20")).toBe(false);
  });
  it("выполненная не просрочена", () => {
    expect(isOverdue(task({ due: "2026-10-01", done_at: "2026-10-02" }), "2026-10-20")).toBe(false);
  });
});

describe("dueLabel", () => {
  const today = "2026-10-20"; // вторник
  it("сегодня и завтра", () => {
    expect(dueLabel("2026-10-20", today)).toBe("Сегодня");
    expect(dueLabel("2026-10-21", today)).toBe("Завтра");
  });
  it("в ближайшую неделю — с днём недели", () => {
    expect(dueLabel("2026-10-24", today)).toBe("сб, 24 окт");
    expect(dueLabel("2026-10-27", today)).toBe("вт, 27 окт");
  });
  it("дальше недели — без дня недели", () => {
    expect(dueLabel("2026-10-28", today)).toBe("28 окт");
  });
  it("прошедшая дата — без дня недели", () => {
    expect(dueLabel("2026-10-15", today)).toBe("15 окт");
  });
  it("другой год — с годом", () => {
    expect(dueLabel("2027-01-05", today)).toBe("5 янв 2027");
  });
});

describe("taskInPeriod", () => {
  const courses = [
    { id: "c1", semesters: "s1" },
    { id: "c2", semesters: "s2" },
  ];
  it("«all» подходит любой задаче", () => {
    expect(taskInPeriod(task({ subject: "c1" }), courses, "all")).toBe(true);
  });
  it("задача без предмета видна в любом периоде", () => {
    expect(taskInPeriod(task({}), courses, "s2")).toBe(true);
  });
  it("предмет не найден в списке — видна в любом периоде", () => {
    expect(taskInPeriod(task({ subject: "zzz" }), courses, "s1")).toBe(true);
  });
  it("предмет в этом периоде — видна, в другом — нет", () => {
    expect(taskInPeriod(task({ subject: "c1" }), courses, "s1")).toBe(true);
    expect(taskInPeriod(task({ subject: "c1" }), courses, "s2")).toBe(false);
  });
});
