import { describe, expect, it } from "vitest";
import { nameInitials } from "./format";

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
