import { describe, expect, it } from "vitest";
import {
  cleanQuestionTail,
  numberAfter,
  parseTicketList,
  parseTicketsFromClipboard,
  stripTicketNumbering,
} from "./examImport";

const questions = (text: string) => parseTicketList(text).map((t) => t.question);

describe("ведущая нумерация убирается", () => {
  it.each([
    ["1. Оферта и акцепт", "Оферта и акцепт"],
    ["12) Оферта и акцепт", "Оферта и акцепт"],
    ["1 – Оферта и акцепт", "Оферта и акцепт"],
    ["1 — Оферта и акцепт", "Оферта и акцепт"],
    ["1 - Оферта и акцепт", "Оферта и акцепт"],
    ["1: Оферта и акцепт", "Оферта и акцепт"],
    ["1.Оферта и акцепт", "Оферта и акцепт"],
    ["1]\tОферта и акцепт", "Оферта и акцепт"],
    ["3.    Оферта и акцепт", "Оферта и акцепт"],
    ["\t4.\tОферта и акцепт", "Оферта и акцепт"],
    ["№3 Оферта и акцепт", "Оферта и акцепт"],
    ["Билет 4. Оферта и акцепт", "Оферта и акцепт"],
    ["Билет 4 Оферта и акцепт", "Оферта и акцепт"],
    ["• Оферта и акцепт", "Оферта и акцепт"],
    ["- Оферта и акцепт", "Оферта и акцепт"],
    ["* Оферта и акцепт", "Оферта и акцепт"],
    ["– Оферта и акцепт", "Оферта и акцепт"],
    ["• 3. Оферта и акцепт", "Оферта и акцепт"],
    ["1.1. Оферта и акцепт", "Оферта и акцепт"],
  ])("%s", (line, expected) => {
    expect(stripTicketNumbering(line)).toBe(expected);
  });

  it("число и пробел убираются, когда так начинается весь список", () => {
    expect(questions("1 Оферта\n2 Виды сделок\n3 Форма сделки")).toEqual(["Оферта", "Виды сделок", "Форма сделки"]);
    expect(questions("1\tОферта\n2\tВиды сделок")).toEqual(["Оферта", "Виды сделок"]);
  });

  it("билет, чей текст сам начинается с числа, не теряет слова", () => {
    expect(questions("7 сил Портера")).toEqual(["7 сил Портера"]);
    expect(questions("Тест\nПроверка\n12 друзей оушена")).toEqual(["Тест", "Проверка", "12 друзей оушена"]);
    expect(questions("1. Что-то\n2. 7 сил Портера")).toEqual(["Что-то", "7 сил Портера"]);
  });

  it("дефис внутри слова после числа не считается маркером", () => {
    expect(stripTicketNumbering("12-й съезд партии")).toBe("12-й съезд партии");
  });
});

describe("список: одна непустая строка — один билет", () => {
  it("номера из текста не используются, билеты нумеруются по порядку", () => {
    expect(parseTicketList("5. Оферта\n9) Виды сделок\n2: Форма сделки")).toEqual([
      { number: 1, question: "Оферта" },
      { number: 2, question: "Виды сделок" },
      { number: 3, question: "Форма сделки" },
    ]);
  });

  it("пустые строки и пробелы по краям пропускаются", () => {
    expect(questions("  1. Оферта  \n\n   \n2. Виды сделок\n\n")).toEqual(["Оферта", "Виды сделок"]);
    expect(parseTicketList("")).toEqual([]);
    expect(parseTicketList("  \n \n")).toEqual([]);
  });

  it("строка без маркера не склеивается с соседней", () => {
    expect(questions("1. Первый вопрос\nпродолжение без номера\n2. Второй")).toEqual([
      "Первый вопрос",
      "продолжение без номера",
      "Второй",
    ]);
  });

  it("одинаковые названия — два билета", () => {
    expect(questions("1. Оферта\n2. Оферта\nОферта")).toEqual(["Оферта", "Оферта", "Оферта"]);
  });

  it("строка из одного номера пропускается (пустой вопрос)", () => {
    expect(questions("1.\n2. Виды сделок")).toEqual(["Виды сделок"]);
  });

  it("список без номеров", () => {
    expect(questions("Оферта и акцепт\nЗаключение договора")).toEqual(["Оферта и акцепт", "Заключение договора"]);
  });

  it("27 строк дают 27 билетов, ни одна не потеряна", () => {
    const lines = Array.from({ length: 27 }, (_, i) => `${i + 1}. Вопрос ${i + 1}`);
    const parsed = parseTicketList(lines.join("\n"));
    expect(parsed).toHaveLength(27);
    expect(parsed[26]).toEqual({ number: 27, question: "Вопрос 27" });
  });

  it("27 строк со случайными номерами и маркерами тоже дают 27", () => {
    const marks = ["1.", "2)", "3 –", "4:", "•", "-", "*", "", "12)", "7 —", "№9", "Билет 5."];
    const lines = Array.from({ length: 27 }, (_, i) => `${marks[i % marks.length]} Вопрос ${i + 1}`);
    const parsed = parseTicketList(lines.join("\n"));
    expect(parsed).toHaveLength(27);
    expect(parsed.map((t) => t.question)).toEqual(Array.from({ length: 27 }, (_, i) => `Вопрос ${i + 1}`));
  });
});

describe("номера новых билетов после существующих", () => {
  const parsed = parseTicketList("a\nb\nc");

  it("были 1–3: новые получают 4, 5, 6 в порядке текста", () => {
    expect(numberAfter(parsed, [1, 2, 3]).map((t) => t.number)).toEqual([4, 5, 6]);
    expect(numberAfter(parsed, [1, 2, 3]).map((t) => t.question)).toEqual(["a", "b", "c"]);
  });

  it("в пустом экзамене с единицы", () => {
    expect(numberAfter(parsed, []).map((t) => t.number)).toEqual([1, 2, 3]);
  });

  it("после наибольшего номера, даже если в нумерации дыры", () => {
    expect(numberAfter(parsed, [1, 2, 7]).map((t) => t.number)).toEqual([8, 9, 10]);
  });

  it("27 строк при трёх существующих билетах: 27 новых, номера 4…30 подряд, ни одна не пропущена", () => {
    const lines = Array.from({ length: 27 }, (_, i) => `${i + 1}. Вопрос ${i + 1}`).join("\n");
    const numbered = numberAfter(parseTicketList(lines), [1, 2, 3]);
    expect(numbered).toHaveLength(27);
    expect(numbered.map((t) => t.number)).toEqual(Array.from({ length: 27 }, (_, i) => i + 4));
  });
});

describe("cleanQuestionTail", () => {
  it("срезает «Ответственный: Имя» и завершающую галочку", () => {
    expect(cleanQuestionTail("Оферта и акцепт Ответственный: Иванов ✅")).toBe("Оферта и акцепт");
  });

  it("схлопывает переносы строк и лишние пробелы", () => {
    expect(cleanQuestionTail("Длинный   вопрос\nс переносом")).toBe("Длинный вопрос с переносом");
  });
});

describe("parseTicketsFromClipboard", () => {
  it("откатывается на построчный разбор, когда html пуст", () => {
    const result = parseTicketsFromClipboard("", "1. Оферта и акцепт\n2. Заключение договора");
    expect(result.source).toBe("text-lines");
    expect(result.tickets).toEqual([
      { number: 1, question: "Оферта и акцепт" },
      { number: 2, question: "Заключение договора" },
    ]);
  });
});
