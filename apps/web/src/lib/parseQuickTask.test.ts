import { describe, it, expect } from "vitest";
import { parseQuickTask, type SubjectRef } from "./parseQuickTask";

// «Сегодня» для тестов — четверг 2026-10-15.
const today = new Date(2026, 9, 15, 12);
const subjects: SubjectRef[] = [
  { id: "phil", name: "Философия" },
  { id: "civ", name: "Гражданское право" },
];

describe("parseQuickTask", () => {
  it("распознаёт месяц и предмет по стему", () => {
    const r = parseQuickTask("Реферат по философии до 25 октября", today, subjects);
    expect(r.due).toBe("2026-10-25");
    expect(r.subjectId).toBe("phil");
    expect(r.title).toBe("Реферат по философии");
    expect(r.dueLabel).toBe("25 октября");
  });

  it("«завтра» без предмета", () => {
    const r = parseQuickTask("сдать лабу завтра", today, subjects);
    expect(r.due).toBe("2026-10-16");
    expect(r.subjectId).toBeNull();
    expect(r.title).toBe("сдать лабу");
  });

  it("«до пятницы» — ближайшая пятница", () => {
    const r = parseQuickTask("дочитать до пятницы", today, subjects);
    // Четверг 15-го → пятница 16-го.
    expect(r.due).toBe("2026-10-16");
    expect(r.title).toBe("дочитать");
  });

  it("без срока — due null, заголовок целиком", () => {
    const r = parseQuickTask("просто задача", today, subjects);
    expect(r.due).toBeNull();
    expect(r.title).toBe("просто задача");
  });

  it("неизвестный предмет — subjectId null", () => {
    const r = parseQuickTask("почитать химию", today, subjects);
    expect(r.subjectId).toBeNull();
  });

  it("многословный предмет по подстроке", () => {
    const r = parseQuickTask("конспект гражданское право сегодня", today, subjects);
    expect(r.subjectId).toBe("civ");
    expect(r.due).toBe("2026-10-15");
  });

  it("числовая дата DD.MM", () => {
    const r = parseQuickTask("эссе до 20.11", today, subjects);
    expect(r.due).toBe("2026-11-20");
  });
});
