import { describe, expect, it } from "vitest";
import { lectureDateLabel, repeatedAgoLabel } from "./lectureMeta";

const now = new Date(2026, 9, 21, 15, 0);

describe("lectureMeta", () => {
  it("дата без года в текущем году, с годом в другом", () => {
    expect(lectureDateLabel(new Date(2026, 9, 11), now)).toBe("11 октября");
    expect(lectureDateLabel(new Date(2025, 9, 11), now)).toBe("11 октября 2025 г.");
  });
  it("давность повторения", () => {
    expect(repeatedAgoLabel(new Date(2026, 9, 21, 9, 0), now)).toBe("повторяли сегодня");
    expect(repeatedAgoLabel(new Date(2026, 9, 20, 23, 0), now)).toBe("повторяли вчера");
    expect(repeatedAgoLabel(new Date(2026, 9, 17), now)).toBe("повторяли 4 дня назад");
    expect(repeatedAgoLabel(new Date(2026, 9, 16), now)).toBe("повторяли 5 дней назад");
    expect(repeatedAgoLabel(new Date(2026, 9, 1), now)).toBe("повторяли 20 дней назад");
  });
});
