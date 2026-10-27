import { describe, expect, it } from "vitest";
import { errorMessage, formatDayMonth, formatLocaleDayMonth, nameInitials, parsePbDate } from "./format";

describe("nameInitials", () => {
  it("берёт первые буквы двух слов", () => {
    expect(nameInitials("Анастасия К.")).toBe("АК");
  });
  it("одно слово — одна буква", () => {
    expect(nameInitials("Анастасия")).toBe("А");
  });
  it("лишние пробелы и третье слово не мешают", () => {
    expect(nameInitials("  анна   петровна  иванова ")).toBe("АП");
  });
  it("пустое имя — пустая строка", () => {
    expect(nameInitials("   ")).toBe("");
  });
});

describe("parsePbDate", () => {
  it("значение PocketBase с Z разбирается как UTC", () => {
    expect(parsePbDate("2026-01-15 10:00:00.123Z")?.toISOString()).toBe("2026-01-15T10:00:00.123Z");
  });
  it("совпадает с new Date(x.replace(' ', 'T')) для значений с Z", () => {
    // Так в проекте разбирают даты в 15 местах без parsePbDate: для ответов PocketBase результат тот же.
    for (const v of ["2026-10-26 12:00:00.000Z", "2026-10-25 00:00:00.000Z", "2026-12-31 23:59:59.999Z"]) {
      expect(parsePbDate(v)?.getTime()).toBe(new Date(v.replace(" ", "T")).getTime());
    }
  });
  it("без зоны читает как UTC", () => {
    expect(parsePbDate("2026-01-15 10:00:00")?.toISOString()).toBe("2026-01-15T10:00:00.000Z");
  });
  it("со смещением учитывает его", () => {
    expect(parsePbDate("2026-01-15 10:00:00+03:00")?.toISOString()).toBe("2026-01-15T07:00:00.000Z");
  });
  it("дата без времени — полночь UTC", () => {
    expect(parsePbDate("2026-10-26")?.toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });
  it("пусто и мусор дают null", () => {
    expect(parsePbDate(null)).toBeNull();
    expect(parsePbDate(undefined)).toBeNull();
    expect(parsePbDate("")).toBeNull();
    expect(parsePbDate("не дата")).toBeNull();
  });
});

describe("errorMessage", () => {
  it("Error — его message", () => {
    expect(errorMessage(new Error("Сбой"))).toBe("Сбой");
  });
  it("не Error — строка", () => {
    expect(errorMessage("плохо")).toBe("плохо");
  });
  it("добавляет поля с замечаниями из ответа PocketBase", () => {
    const e = Object.assign(new Error("Failed to create record."), {
      response: { data: { title: { message: "Cannot be blank." }, slug: { message: "Taken." } } },
    });
    expect(errorMessage(e)).toBe("Failed to create record. (title: Cannot be blank.; slug: Taken.)");
  });
  it("пустой data не добавляет скобок", () => {
    const e = Object.assign(new Error("Сбой"), { response: { data: {} } });
    expect(errorMessage(e)).toBe("Сбой");
  });
});

describe("formatDayMonth", () => {
  const d = new Date(2026, 9, 26, 12);
  it("длинный месяц по умолчанию", () => {
    expect(formatDayMonth(d)).toBe("26 октября");
  });
  it("короткий месяц", () => {
    expect(formatDayMonth(d, "short")).toBe("26 окт");
    expect(formatDayMonth(new Date(2026, 4, 3), "short")).toBe("3 мая");
  });
});

describe("formatLocaleDayMonth", () => {
  it("длинный и короткий месяц без точки", () => {
    expect(formatLocaleDayMonth("2026-10-26T12:00:00", "long")).toBe("26 октября");
    expect(formatLocaleDayMonth("2026-10-26T12:00:00", "short")).toBe("26 окт");
  });
  it("пусто и мусор — пустая строка", () => {
    expect(formatLocaleDayMonth(undefined, "long")).toBe("");
    expect(formatLocaleDayMonth("", "short")).toBe("");
    expect(formatLocaleDayMonth("не дата", "long")).toBe("");
  });
});
