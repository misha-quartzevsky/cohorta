import { describe, it, expect } from "vitest";
import { extractText, normalizeText } from "./extractText";

describe("extractText", () => {
  it("пустая лекция -> пустая строка", () => {
    expect(extractText("")).toBe("");
    expect(extractText(null)).toBe("");
    expect(extractText(undefined)).toBe("");
  });

  it("заголовки как отдельные строки", () => {
    const html = "<h2>Введение</h2><p>Первый абзац.</p><h3>Раздел 1</h3><p>Текст.</p>";
    const text = extractText(html);
    expect(text.split("\n")).toEqual([
      "Введение",
      "Первый абзац.",
      "Раздел 1",
      "Текст.",
    ]);
  });

  it("убирает теги форматирования, сохраняя текст", () => {
    const html = "<p>Это <strong>жирный</strong> и <em>курсив</em>.</p>";
    expect(extractText(html)).toBe("Это жирный и курсив.");
  });

  it("списки — каждый пункт на своей строке", () => {
    const html = "<ul><li>Раз</li><li>Два</li></ul>";
    expect(extractText(html)).toBe("Раз\nДва");
  });

  it("декодирует HTML-сущности", () => {
    expect(extractText("<p>А&amp;Б &laquo;В&raquo;</p>")).toBe("А&Б «В»");
  });

  it("схлопывает пустые строки", () => {
    const html = "<p>Раз</p><p></p><p>Два</p>";
    expect(extractText(html)).toBe("Раз\nДва");
  });
});

describe("normalizeText", () => {
  it("нижний регистр и схлопнутые пробелы", () => {
    expect(normalizeText("  Текст   С   Пробелами  ")).toBe("текст с пробелами");
  });
  it("убирает кавычки-ёлочки", () => {
    expect(normalizeText("«цитата»")).toBe("цитата");
  });
});
