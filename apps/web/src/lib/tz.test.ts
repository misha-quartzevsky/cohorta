import { describe, expect, it } from "vitest";

describe("часовой пояс тестов", () => {
  it("совпадает с именем проекта", () => {
    const name = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = new Date(2026, 9, 26, 12).getTimezoneOffset();
    expect(offset).toBe(name === "Europe/Moscow" ? -180 : 0);
    expect(["UTC", "Europe/Moscow"]).toContain(name);
  });
});
