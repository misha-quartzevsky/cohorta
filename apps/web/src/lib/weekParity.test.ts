import { describe, it, expect } from "vitest";
import {
  getWeekParity,
  slotMatchesParity,
  findLectureForOccurrence,
  slotActiveOn,
  dateForWeekday,
} from "./weekParity";
import type { Lecture, ScheduleSlot, ScheduleSlotLecture } from "./types";

// Якорь — понедельник нечётной недели: 2026-10-12 (пн).
const anchor = new Date(2026, 9, 12, 12);

describe("getWeekParity", () => {
  it("неделя якоря — нечётная", () => {
    expect(getWeekParity(new Date(2026, 9, 12, 12), anchor)).toBe("odd");
    expect(getWeekParity(new Date(2026, 9, 16, 12), anchor)).toBe("odd");
  });

  it("следующая неделя — чётная", () => {
    expect(getWeekParity(new Date(2026, 9, 19, 12), anchor)).toBe("even");
  });

  it("через неделю снова нечётная", () => {
    expect(getWeekParity(new Date(2026, 9, 26, 12), anchor)).toBe("odd");
  });

  it("даты до якоря обрабатываются без сбоя знака", () => {
    // Неделя перед якорной — тоже чётная (чередование симметрично).
    expect(getWeekParity(new Date(2026, 9, 5, 12), anchor)).toBe("even");
    // Две недели назад — нечётная.
    expect(getWeekParity(new Date(2026, 8, 28, 12), anchor)).toBe("odd");
  });

  it("смена месяца и года не ломает чередование", () => {
    const p1 = getWeekParity(new Date(2026, 11, 28, 12), anchor);
    const p2 = getWeekParity(new Date(2027, 0, 4, 12), anchor);
    expect(p1).not.toBe(p2);
  });
});

describe("slotMatchesParity", () => {
  it("any подходит любой неделе", () => {
    expect(slotMatchesParity("any", "odd")).toBe(true);
    expect(slotMatchesParity("any", "even")).toBe(true);
    expect(slotMatchesParity(undefined, "odd")).toBe(true);
  });
  it("odd только нечётной", () => {
    expect(slotMatchesParity("odd", "odd")).toBe(true);
    expect(slotMatchesParity("odd", "even")).toBe(false);
  });
});

describe("findLectureForOccurrence", () => {
  const slot = { id: "slot1" } as ScheduleSlot;
  const lectures = [
    { id: "l1", slot: "slot1", lecture_date: "2026-10-16" },
    { id: "l2", slot: "slot1", lecture_date: "2026-10-23" },
    { id: "l3", slot: "slot2", lecture_date: "2026-10-16" },
  ] as Lecture[];

  it("находит по слоту и дате", () => {
    expect(findLectureForOccurrence(slot, "2026-10-16", lectures)?.id).toBe("l1");
  });
  it("нет совпадения — null", () => {
    expect(findLectureForOccurrence(slot, "2026-10-17", lectures)).toBeNull();
  });
  it("не путает слоты в одну дату", () => {
    expect(findLectureForOccurrence(slot, "2026-10-16", lectures)?.id).not.toBe("l3");
  });

  it("лекция, прикреплённая постфактум (schedule_slot_lectures), находится по ссылке", () => {
    const attached = { id: "l9", title: "Чужая лекция" } as Lecture;
    const links = [
      { id: "link1", slot: "slot1", date: "2026-10-17", expand: { lecture: attached } },
    ] as ScheduleSlotLecture[];
    expect(findLectureForOccurrence(slot, "2026-10-17", lectures, links)?.id).toBe("l9");
  });

  it("родная лекция пары (slot+lecture_date) важнее прикреплённой ссылки на ту же дату", () => {
    const attached = { id: "l9" } as Lecture;
    const links = [
      { id: "link1", slot: "slot1", date: "2026-10-16", expand: { lecture: attached } },
    ] as ScheduleSlotLecture[];
    // На 2026-10-16 у slot1 уже есть родная лекция l1 — она и побеждает.
    expect(findLectureForOccurrence(slot, "2026-10-16", lectures, links)?.id).toBe("l1");
  });

  it("одна и та же лекция прикреплена к двум разным парам/датам одновременно", () => {
    const sharedLecture = { id: "shared-lecture", title: "Общая лекция" } as Lecture;
    const slotTue = { id: "slot-tue" } as ScheduleSlot; // Философия, вторник, 4 пара
    const slotThu = { id: "slot-thu" } as ScheduleSlot; // Философия, четверг, 2 пара
    const links = [
      { id: "link1", slot: "slot-tue", date: "2026-10-20", expand: { lecture: sharedLecture } },
      { id: "link2", slot: "slot-thu", date: "2026-10-15", expand: { lecture: sharedLecture } },
    ] as ScheduleSlotLecture[];
    expect(findLectureForOccurrence(slotTue, "2026-10-20", [], links)?.id).toBe("shared-lecture");
    expect(findLectureForOccurrence(slotThu, "2026-10-15", [], links)?.id).toBe("shared-lecture");
  });

  it("ссылка на другую дату того же слота не подходит", () => {
    const attached = { id: "l9" } as Lecture;
    const links = [
      { id: "link1", slot: "slot1", date: "2026-10-17", expand: { lecture: attached } },
    ] as ScheduleSlotLecture[];
    expect(findLectureForOccurrence(slot, "2026-10-24", [], links)).toBeNull();
  });
});

describe("slotActiveOn (границы семестра и чётности)", () => {
  // Якорь — та же нечётная неделя, что и выше.
  it("без date_from/date_to — активен всегда, по одной только чётности", () => {
    const slot = { week_parity: "odd" } as ScheduleSlot;
    expect(slotActiveOn(slot, "2026-10-12", anchor)).toBe(true);
    expect(slotActiveOn(slot, "2026-10-19", anchor)).toBe(false); // чётная неделя
  });

  it("смена семестра: дата до date_from — слот ещё не активен", () => {
    const slot = {
      week_parity: "any",
      date_from: "2026-10-12",
    } as ScheduleSlot;
    expect(slotActiveOn(slot, "2026-10-11", anchor)).toBe(false);
  });

  it("смена семестра: дата в день date_from — уже активен (граница включительно)", () => {
    const slot = { week_parity: "any", date_from: "2026-10-12" } as ScheduleSlot;
    expect(slotActiveOn(slot, "2026-10-12", anchor)).toBe(true);
  });

  it("смена семестра: дата после date_to — старый слот прошлого семестра больше не активен", () => {
    const slot = {
      week_parity: "any",
      date_from: "2026-02-01",
      date_to: "2026-06-30",
    } as ScheduleSlot;
    // Новый семестр уже начался (октябрь), старый слот весеннего не должен подставляться.
    expect(slotActiveOn(slot, "2026-10-12", anchor)).toBe(false);
  });

  it("смена семестра: дата в день date_to — ещё активен (граница включительно)", () => {
    const slot = { week_parity: "any", date_from: "2026-02-01", date_to: "2026-06-30" } as ScheduleSlot;
    expect(slotActiveOn(slot, "2026-06-30", anchor)).toBe(true);
  });

  it("воскресенье: чётность считается корректно, хотя сетка расписания воскресенье не показывает", () => {
    const slot = { week_parity: "odd" } as ScheduleSlot;
    // 2026-10-18 — воскресенье нечётной недели (anchor = 2026-10-12, пн).
    expect(slotActiveOn(slot, "2026-10-18", anchor)).toBe(true);
    // 2026-10-25 — воскресенье следующей (чётной) недели.
    expect(slotActiveOn(slot, "2026-10-25", anchor)).toBe(false);
  });
});

describe("dateForWeekday", () => {
  it("день недели в неделе, содержащей дату (1 = понедельник)", () => {
    const ref = new Date(2026, 9, 14, 12); // среда
    expect(dateForWeekday(ref, 1)).toBe("2026-10-12");
    expect(dateForWeekday(ref, 3)).toBe("2026-10-14");
    expect(dateForWeekday(ref, 7)).toBe("2026-10-18");
  });
  it("воскресенье относится к неделе, которая началась в понедельник до него", () => {
    const sunday = new Date(2026, 9, 18, 12);
    expect(dateForWeekday(sunday, 1)).toBe("2026-10-12");
    expect(dateForWeekday(sunday, 7)).toBe("2026-10-18");
  });
  it("переход через конец года", () => {
    const ref = new Date(2026, 11, 31, 12); // четверг
    expect(dateForWeekday(ref, 1)).toBe("2026-12-28");
    expect(dateForWeekday(ref, 5)).toBe("2027-01-01");
  });
});
