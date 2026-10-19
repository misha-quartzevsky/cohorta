import { describe, expect, it } from "vitest";
import { parseTicketList, parseTicketsFromClipboard, cleanQuestionTail } from "./examImport";

describe("parseTicketList — нумерация «1.»", () => {
  it("разбирает билеты, пронумерованные точкой", () => {
    const text = "1. Оферта и акцепт\n2. Заключение договора\n3. Недействительность сделок";
    expect(parseTicketList(text)).toEqual([
      { number: 1, question: "Оферта и акцепт" },
      { number: 2, question: "Заключение договора" },
      { number: 3, question: "Недействительность сделок" },
    ]);
  });
});

describe("parseTicketList — нумерация «1)»", () => {
  it("разбирает билеты, пронумерованные закрывающей скобкой", () => {
    const text = "1) Оферта и акцепт\n2) Заключение договора";
    expect(parseTicketList(text)).toEqual([
      { number: 1, question: "Оферта и акцепт" },
      { number: 2, question: "Заключение договора" },
    ]);
  });

  it("разбирает билеты вида «№3» и «Билет 4»", () => {
    const text = "№1 Оферта и акцепт\nБилет 2 Заключение договора";
    expect(parseTicketList(text)).toEqual([
      { number: 1, question: "Оферта и акцепт" },
      { number: 2, question: "Заключение договора" },
    ]);
  });
});

describe("parseTicketList — без номеров", () => {
  it("нумерует билеты по порядку, когда маркеров нет вообще", () => {
    const text = "Оферта и акцепт\nЗаключение договора\nНедействительность сделок";
    expect(parseTicketList(text)).toEqual([
      { number: 1, question: "Оферта и акцепт" },
      { number: 2, question: "Заключение договора" },
      { number: 3, question: "Недействительность сделок" },
    ]);
  });
});

describe("parseTicketList — билет сам начинается с числа (найдено владелицей)", () => {
  it("не принимает вопрос вида «7 сил Портера» за маркер №7", () => {
    expect(parseTicketList("7 сил Портера")).toEqual([
      { number: 1, question: "7 сил Портера" },
    ]);
  });

  it("не склеивает весь список без номеров в один билет из-за строки, похожей на маркер", () => {
    // Воспроизводит баг из владелицыного скриншота: пять строк без явной
    // нумерации, последняя случайно начинается с «12 ...» без разделителя —
    // раньше это ложно включало режим «есть маркеры» и собирало все строки
    // до неё в один билет («Тест Проверка Вопрос AAAAA»), вместо пяти
    // отдельных билетов.
    const text = "Тест\nПроверка\nВопрос\nAAAAA\n12 друзей оушена";
    expect(parseTicketList(text)).toEqual([
      { number: 1, question: "Тест" },
      { number: 2, question: "Проверка" },
      { number: 3, question: "Вопрос" },
      { number: 4, question: "AAAAA" },
      { number: 5, question: "12 друзей оушена" },
    ]);
  });

  it("реальный маркер («7.») всё ещё начинает билет, даже если ответ дальше тоже с числа", () => {
    const text = "6. Что-то\n7. 7 сил Портера\n8. Оферта и акцепт";
    expect(parseTicketList(text)).toEqual([
      { number: 6, question: "Что-то" },
      { number: 7, question: "7 сил Портера" },
      { number: 8, question: "Оферта и акцепт" },
    ]);
  });
});

describe("parseTicketList — пустые строки", () => {
  it("игнорирует пустые строки между билетами", () => {
    const text = "1. Оферта и акцепт\n\n\n2. Заключение договора\n   \n3. Недействительность сделок";
    expect(parseTicketList(text)).toEqual([
      { number: 1, question: "Оферта и акцепт" },
      { number: 2, question: "Заключение договора" },
      { number: 3, question: "Недействительность сделок" },
    ]);
  });

  it("возвращает пустой список для пустой или пробельной строки", () => {
    expect(parseTicketList("")).toEqual([]);
    expect(parseTicketList("   \n\n  ")).toEqual([]);
  });
});

describe("parseTicketList — перенос длинного вопроса", () => {
  it("склеивает строку без маркера со следующим за ней билетом", () => {
    const text = "1. Понятие и виды\nсделок в гражданском праве\n2. Оферта и акцепт";
    expect(parseTicketList(text)).toEqual([
      { number: 1, question: "Понятие и виды сделок в гражданском праве" },
      { number: 2, question: "Оферта и акцепт" },
    ]);
  });
});

describe("cleanQuestionTail", () => {
  it("срезает «Ответственный: Имя» и завершающую галочку", () => {
    expect(cleanQuestionTail("Оферта и акцепт Ответственный: Иванов ✅")).toBe(
      "Оферта и акцепт"
    );
  });

  it("схлопывает переносы строк и лишние пробелы", () => {
    expect(cleanQuestionTail("Длинный   вопрос\nс переносом")).toBe(
      "Длинный вопрос с переносом"
    );
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

  // Разбор настоящего HTML-списка (parseTicketsFromHtml) требует DOMParser —
  // окружение тестов здесь "node" (vitest.config.ts), без jsdom, поэтому
  // этот путь не покрыт юнит-тестом; построчный разбор (выше) — да.
});
