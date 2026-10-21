import { describe, expect, it } from "vitest";
import { lectureLine, shortDate, subjectsOf, type PreviewRow } from "./groupApi";

const row = (o: Partial<PreviewRow>): PreviewRow => ({
  id: "p",
  lecture: "l",
  owner: "u1",
  title: "Т",
  course: "c1",
  courseTitle: "Философия",
  coverSeed: 10,
  lectureNumber: 0,
  lectureDate: "",
  created: "2026-10-01 10:00:00.000Z",
  ...o,
});

describe("строка лекции одногруппника", () => {
  it("«Лекция N · дата», когда они есть", () => {
    expect(lectureLine({ lectureNumber: 5, lectureDate: "2026-10-11 00:00:00.000Z" })).toBe("Лекция 5 · 11 окт");
  });
  it("только номер или только дата", () => {
    expect(lectureLine({ lectureNumber: 3, lectureDate: "" })).toBe("Лекция 3");
    expect(lectureLine({ lectureNumber: 0, lectureDate: "2026-10-11 00:00:00.000Z" })).toBe("11 окт");
  });
  it("без номера и даты строка пустая (покажется предмет)", () => {
    expect(lectureLine({ lectureNumber: 0, lectureDate: "" })).toBe("");
    expect(shortDate("")).toBe("");
  });
});

describe("предметы одногруппника", () => {
  it("лекции идут от новой к старой: по номеру, без номера по времени создания", () => {
    const previews = [
      row({ id: "a", lecture: "a", lectureNumber: 1 }),
      row({ id: "b", lecture: "b", lectureNumber: 6 }),
      row({ id: "c", lecture: "c", lectureNumber: 0, created: "2026-10-05 10:00:00.000Z" }),
      row({ id: "d", lecture: "d", lectureNumber: 0, created: "2026-10-09 10:00:00.000Z" }),
    ];
    const [subject] = subjectsOf(previews, [], "u1");
    expect(subject.lectures.map((l) => l.id)).toEqual(["b", "a", "d", "c"]);
  });
  it("чужие лекции в предмет не попадают", () => {
    const previews = [row({ id: "a", owner: "u1" }), row({ id: "b", owner: "u2" })];
    expect(subjectsOf(previews, [], "u1")[0].lectures.map((l) => l.id)).toEqual(["a"]);
  });
});
