import { describe, it, expect } from "vitest";
import { groupByWeek } from "./lectureGroups";

// Суббота, 17 октября 2026: неделя — с пн 12 по вс 18 октября.
const now = new Date(2026, 9, 17, 12);
const dateOf = (d: string | undefined) => d;

describe("groupByWeek", () => {
  it("делит на «Эта неделя» и «Ранее»", () => {
    const groups = groupByWeek(["2026-10-17", "2026-10-12", "2026-10-11", "2026-09-20"], dateOf, now);
    expect(groups.map((g) => g.title)).toEqual(["Эта неделя", "Ранее"]);
    expect(groups[0].items).toEqual(["2026-10-17", "2026-10-12"]);
    expect(groups[1].items).toEqual(["2026-10-11", "2026-09-20"]);
  });

  it("понедельник и воскресенье входят в неделю, соседние дни нет", () => {
    const groups = groupByWeek(["2026-10-18", "2026-10-12", "2026-10-19", "2026-10-11"], dateOf, now);
    expect(groups[0].items).toEqual(["2026-10-18", "2026-10-12"]);
    expect(groups[1].items).toEqual(["2026-10-19", "2026-10-11"]);
  });

  it("принимает дату в формате PocketBase", () => {
    const groups = groupByWeek(["2026-10-14 00:00:00.000Z"], dateOf, now);
    expect(groups[0].key).toBe("week");
  });

  it("лекция без даты уходит в «Ранее»", () => {
    const groups = groupByWeek([undefined], dateOf, now);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("earlier");
  });

  it("пустые группы не возвращаются", () => {
    expect(groupByWeek([], dateOf, now)).toEqual([]);
    expect(groupByWeek(["2026-08-01"], dateOf, now).map((g) => g.key)).toEqual(["earlier"]);
  });
});
