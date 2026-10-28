import { describe, expect, it } from "vitest";

import { parsePbDate } from "./format";
import { deletionDateLabel } from "../services/deletionService";
import { trashDaysLeft } from "../services/trashService";
import { ruDate, shortDate } from "../services/groupApi";

// Даты PocketBase всегда приходят с «Z» и пробелом вместо «T». Эти тесты закрепляют результат
// функций, разбирающих такие даты, в двух часовых поясах (проекты vitest `utc` и `msk`),
// чтобы замена `new Date(x.replace(" ", "T"))` на `parsePbDate` ничего не меняла.
const MSK = Intl.DateTimeFormat().resolvedOptions().timeZone === "Europe/Moscow";

const REAL = [
  "2026-10-26 12:00:00.000Z",
  "2026-10-25 00:00:00.000Z",
  "2026-10-25 21:30:00.000Z",
  "2026-12-31 23:59:59.999Z",
  "2027-03-28 00:00:00.000Z",
];

describe("parsePbDate против new Date(x.replace(' ', 'T'))", () => {
  it("значения PocketBase дают один и тот же момент", () => {
    for (const v of REAL) expect(parsePbDate(v)?.getTime()).toBe(new Date(v.replace(" ", "T")).getTime());
  });
  it("дата без времени и ISO из хука тоже совпадают", () => {
    for (const v of ["2026-10-26", "2026-10-26T09:00:00.000Z"]) {
      expect(parsePbDate(v)?.getTime()).toBe(new Date(v.replace(" ", "T")).getTime());
    }
  });
});

describe("вход без зоны (в данных PocketBase не встречается)", () => {
  // Единственное известное расхождение старой формулы и parsePbDate: строка со временем, но без зоны.
  // Раньше она читалась как локальное время, теперь как UTC. Закрепляем, чтобы расхождение было явным.
  it("parsePbDate читает как UTC, старая формула — как локальное", () => {
    const v = "2026-10-26 09:30:00";
    expect(parsePbDate(v)?.toISOString()).toBe("2026-10-26T09:30:00.000Z");
    expect(new Date(v.replace(" ", "T")).getTime()).toBe(
      MSK ? Date.parse("2026-10-26T06:30:00.000Z") : Date.parse("2026-10-26T09:30:00.000Z")
    );
  });
});

describe("deletionDateLabel", () => {
  it("день считается по локальному времени", () => {
    expect(deletionDateLabel("2026-11-02 09:30:00.000Z")).toBe("2 ноября");
    expect(deletionDateLabel("2026-11-02 22:30:00.000Z")).toBe(MSK ? "3 ноября" : "2 ноября");
  });
  it("мусор — пустая строка", () => {
    expect(deletionDateLabel("")).toBe("");
    expect(deletionDateLabel("не дата")).toBe("");
  });
});

describe("trashDaysLeft", () => {
  const now = new Date("2026-10-26T12:00:00.000Z");
  it("считает дни до очистки корзины (30 дней)", () => {
    expect(trashDaysLeft("2026-10-26 11:00:00.000Z", now)).toBe(30);
    expect(trashDaysLeft("2026-10-16 12:00:00.000Z", now)).toBe(20);
    expect(trashDaysLeft("2026-09-01 00:00:00.000Z", now)).toBe(0);
  });
  it("мусор — полный срок", () => {
    expect(trashDaysLeft("", now)).toBe(30);
    expect(trashDaysLeft("не дата", now)).toBe(30);
  });
});

describe("ruDate и shortDate (groupApi)", () => {
  it("«11 октября» и «11 окт» по локальному времени", () => {
    expect(ruDate("2026-10-11 09:00:00.000Z")).toBe("11 октября");
    expect(shortDate("2026-10-11 09:00:00.000Z")).toBe("11 окт");
    expect(ruDate("2026-10-11 22:00:00.000Z")).toBe(MSK ? "12 октября" : "11 октября");
    expect(shortDate("2026-10-11 22:00:00.000Z")).toBe(MSK ? "12 окт" : "11 окт");
  });
  it("пусто и мусор — пустая строка", () => {
    expect(ruDate("")).toBe("");
    expect(shortDate("")).toBe("");
    expect(shortDate("не дата")).toBe("");
  });
});
