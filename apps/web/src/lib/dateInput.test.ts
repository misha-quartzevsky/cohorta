import { describe, expect, it } from "vitest";
import { isoToRuDate, maskRuDate, ruDateToIso } from "./dateInput";

describe("dateInput", () => {
  it("расставляет точки по ходу ввода", () => {
    expect(maskRuDate("2")).toBe("2");
    expect(maskRuDate("250")).toBe("25.0");
    expect(maskRuDate("25012027")).toBe("25.01.2027");
    expect(maskRuDate("25.01.2027999")).toBe("25.01.2027");
    expect(maskRuDate("ab25")).toBe("25");
  });
  it("ДД.ММ.ГГГГ → ISO", () => {
    expect(ruDateToIso("25.01.2027")).toBe("2027-01-25");
    expect(ruDateToIso("29.02.2028")).toBe("2028-02-29");
  });
  it("неполные и несуществующие даты → пусто", () => {
    expect(ruDateToIso("25.01")).toBe("");
    expect(ruDateToIso("31.02.2027")).toBe("");
    expect(ruDateToIso("29.02.2027")).toBe("");
    expect(ruDateToIso("00.01.2027")).toBe("");
  });
  it("ISO → ДД.ММ.ГГГГ", () => {
    expect(isoToRuDate("2027-01-25")).toBe("25.01.2027");
    expect(isoToRuDate("2027-01-25 00:00:00.000Z")).toBe("25.01.2027");
    expect(isoToRuDate("")).toBe("");
  });
});
