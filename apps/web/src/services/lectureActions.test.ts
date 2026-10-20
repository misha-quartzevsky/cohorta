import { describe, it, expect } from "vitest";
import { markdownFileName, wordCount } from "./lectureActions";

describe("wordCount", () => {
  it("считает слова без разметки", () => {
    expect(wordCount("<p>раз два</p><p>три&nbsp;четыре</p>")).toBe(4);
  });
  it("пусто — ноль", () => {
    expect(wordCount("")).toBe(0);
    expect(wordCount(undefined)).toBe(0);
    expect(wordCount("<p></p>")).toBe(0);
  });
});

describe("markdownFileName", () => {
  it("убирает символы, запрещённые в именах файлов", () => {
    expect(markdownFileName('Договор: заключение/расторжение?')).toBe("Договор заключение расторжение.md");
  });
  it("пустое название — lecture.md", () => {
    expect(markdownFileName("  ")).toBe("lecture.md");
  });
});
