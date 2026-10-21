// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "./sanitizeHtml";

describe("sanitizeHtml", () => {
  it("убирает скрипты, обработчики событий и javascript-ссылки", () => {
    const out = sanitizeHtml('<p onclick="x()">Текст</p><script>alert(1)</script><a href="javascript:alert(1)">ссылка</a><img src="x" onerror="alert(2)">');
    expect(out).not.toContain("script");
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("javascript:");
    expect(out).toContain("Текст");
  });

  it("оставляет обычную разметку лекции", () => {
    const out = sanitizeHtml("<h2>Заголовок</h2><p>Абзац <strong>жирный</strong></p><ul><li>раз</li></ul>");
    expect(out).toBe("<h2>Заголовок</h2><p>Абзац <strong>жирный</strong></p><ul><li>раз</li></ul>");
  });

  it("убирает iframe и формы", () => {
    const out = sanitizeHtml('<iframe src="https://evil.test"></iframe><form action="/x"><input></form><p>ок</p>');
    expect(out).toBe("<p>ок</p>");
  });
});
