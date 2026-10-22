// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseTicketsFromHtml, parseTicketsFromClipboard } from "./examImport";

describe("разбор HTML из буфера обмена", () => {
  it("настоящий <ol>: один пункт — один билет, вложенные списки не считаются", () => {
    const html = "<ol><li>Оферта и акцепт</li><li>Виды сделок<ul><li>вложенный</li></ul></li><li>Форма сделки</li></ol>";
    expect(parseTicketsFromHtml(html)).toEqual([
      { number: 1, question: "Оферта и акцепт" },
      { number: 2, question: "Виды сделок" },
      { number: 3, question: "Форма сделки" },
    ]);
  });

  it("номера внутри пунктов <li> тоже убираются", () => {
    expect(parseTicketsFromHtml("<ul><li>1. Оферта</li><li>2) Виды сделок</li></ul>")?.map((t) => t.question)).toEqual([
      "Оферта",
      "Виды сделок",
    ]);
  });

  it("псевдо-список Word: номер из служебного span не попадает в текст", () => {
    const html =
      '<p style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">5.</span>Оферта и акцепт</p>' +
      '<p style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">9.</span>Виды сделок Ответственный: Иванов ✅</p>';
    expect(parseTicketsFromHtml(html)).toEqual([
      { number: 1, question: "Оферта и акцепт" },
      { number: 2, question: "Виды сделок" },
    ]);
  });

  it("html без списка откатывается на текст", () => {
    const r = parseTicketsFromClipboard("<p>Оферта</p>", "1. Оферта\n2. Виды сделок");
    expect(r.source).toBe("text-lines");
    expect(r.tickets.map((t) => t.question)).toEqual(["Оферта", "Виды сделок"]);
  });
});
