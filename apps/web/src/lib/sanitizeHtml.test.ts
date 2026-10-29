// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { cleanStyle, sanitizeHtml } from "./sanitizeHtml";

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

describe("sanitizeHtml: обходы чёрного списка (C-2)", () => {
  it("ссылки с табом, управляющим символом и регистром в схеме не проходят", () => {
    for (const href of ["java\tscript:alert(1)", "\u0001javascript:alert(1)", "JaVaScRiPt:alert(1)", " javascript:alert(1)", "java&#x09;script:alert(1)", "vbscript:x", "data:text/html,<script>1</script>"]) {
      const out = sanitizeHtml(`<a href="${href}">x</a>`);
      expect(out, href).not.toMatch(/script/i);
      expect(out, href).not.toContain("href");
    }
  });

  it("разрешены только http, https, mailto, tel и относительные адреса", () => {
    for (const href of ["https://example.com/a?b=1", "http://example.com", "mailto:a@b.test", "tel:+79001234567", "/s/1/course", "page#anchor", "../x"]) {
      expect(sanitizeHtml(`<a href="${href}">x</a>`), href).toContain("href=");
    }
    for (const href of ["ftp://x.test/f", "sms:123", "file:///etc/passwd", "blob:https://x/1"]) {
      expect(sanitizeHtml(`<a href="${href}">x</a>`), href).not.toContain("href");
    }
  });

  it("внешние ссылки открываются в новой вкладке с noopener, относительные без target", () => {
    const out = sanitizeHtml('<a href="https://example.com" target="_self">x</a><a href="/s/1" target="_blank">y</a>');
    expect(out).toContain('href="https://example.com"');
    expect(out).toMatch(/<a [^>]*href="https:\/\/example\.com"[^>]*target="_blank"|<a [^>]*target="_blank"[^>]*href="https:\/\/example\.com"/);
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).not.toMatch(/href="\/s\/1"[^>]*target|target[^>]*href="\/s\/1"/);
  });

  it("svg и SMIL убираются, соседняя разметка остаётся", () => {
    const out = sanitizeHtml('<svg><a><animate attributeName="href" values="javascript:alert(1)"/></a></svg><p>ок</p>');
    expect(out).not.toMatch(/svg|animate|javascript/i);
    expect(out).toContain("<p>ок</p>");
  });

  it("math, noscript (mXSS), style, base, template не дают ни скрипта, ни обработчика", () => {
    const out = sanitizeHtml(
      '<math><mi xlink:href="javascript:alert(1)">x</mi></math>' +
        '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript><style>*{display:none}</style><base href="https://evil.test/"><template><img src=x onerror=alert(1)></template><p>ок</p>'
    );
    // DOMPurify может отбросить весь фрагмент целиком, если заподозрит mXSS: пустой результат допустим
    expect(out).not.toMatch(/math|noscript|<style|<base|template|onerror|javascript/i);
  });

  it("style: position:fixed, inset, z-index, url() и expression отбрасываются, цвет и выравнивание остаются", () => {
    const out = sanitizeHtml(
      '<div style="position:fixed;inset:0;z-index:9999;background:#fff">Сессия истекла</div>' +
        '<p style="color: red; background-image:url(https://evil.test/x.png); text-align:center">а</p>' +
        '<p style="width: expression(alert(1))">б</p><p style="background:url(javascript:alert(1))">в</p>'
    );
    expect(out).not.toMatch(/position|inset|z-index|url\(|expression|background-image/i);
    expect(out).toContain('style="color: red; text-align: center"');
    expect(out).toContain("Сессия истекла");
  });

  it("class режется до классов Tiptap: служебные классы интерфейса не проходят", () => {
    const out = sanitizeHtml('<div class="c-modal-backdrop is-open">x</div><pre><code class="language-js hljs">y</code></pre><figure class="media-figure c-toast"></figure>');
    expect(out).not.toContain("c-modal-backdrop");
    expect(out).not.toContain("c-toast");
    expect(out).toContain('class="language-js"');
    expect(out).toContain('class="media-figure"');
  });

  it("id и name не проходят (DOM clobbering)", () => {
    const out = sanitizeHtml('<p id="x" name="y">а</p><img name="body" src="https://x.test/a.png">');
    expect(out).not.toMatch(/\sid=|\sname=/);
  });

  it("input только чекбокс", () => {
    const out = sanitizeHtml('<input type="text" value="x"><input type="checkbox" checked><input type="image" src="x" onerror="1">');
    expect(out.match(/<input/g)).toHaveLength(1);
    expect(out).toContain('type="checkbox"');
  });
});

describe("sanitizeHtml: разметка Tiptap остаётся как есть (без расхождений в показе)", () => {
  const samples: Record<string, string> = {
    таблица:
      '<table style="min-width: 150px"><colgroup><col style="width: 150px"><col><col></colgroup><tbody><tr><th colspan="1" rowspan="1" colwidth="150"><p>A</p></th><th colspan="1" rowspan="1"><p>B</p></th></tr><tr><td colspan="1" rowspan="1"><p>1</p></td><td colspan="2" rowspan="1"><p>2</p></td></tr></tbody></table>',
    формула: '<div data-type="math-block" data-latex="\\frac{a}{b}+\\sqrt{x^2+1}"></div>',
    картинка: '<figure class="media-figure"><img src="http://127.0.0.1:8090/api/files/lectures/abc/pic_x.png" alt="картинка"><figcaption>Подпись</figcaption></figure>',
    "картинка из буфера": '<img src="data:image/png;base64,iVBORw0KGgo=" alt="">',
    "схема Excalidraw": '<div data-type="sketch-block" data-scene="{&quot;elements&quot;:[]}" class="media-figure"><img src="http://127.0.0.1:8090/api/files/lectures/abc/sk.png" alt="Схема" class="media-block-img"></div>',
    выделение: '<mark data-color="#fde68a" style="background-color: #fde68a; color: inherit">текст</mark>',
    "цвет через палитру": '<span style="color: var(--accent)">текст</span>',
    чеклист:
      '<ul data-type="taskList"><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>сделано</p></div></li></ul>',
    "метка времени": '<p data-ts="1790000000000" data-ts-label="12:00">абзац</p>',
    код: '<pre><code class="language-js">const a = 1;</code></pre>',
    аудио: '<audio controls="true" preload="metadata" src="http://127.0.0.1:8090/api/files/lectures/abc/rec.webm"></audio>',
    "цитата и списки": "<blockquote><p>q</p></blockquote><ol><li><p>1</p></li></ol><hr>",
  };
  for (const [name, html] of Object.entries(samples)) {
    it(name, () => {
      const normalize = (s: string) => {
        const d = document.createElement("div");
        d.innerHTML = s;
        return d.innerHTML;
      };
      expect(sanitizeHtml(html)).toBe(normalize(html));
    });
  }
});

describe("cleanStyle", () => {
  it("оставляет разрешённые свойства и режет остальные", () => {
    expect(cleanStyle("color: #333; position: absolute; text-align: right")).toBe("color: #333; text-align: right");
    expect(cleanStyle("width: 50%; max-width: 100%")).toBe("width: 50%; max-width: 100%");
    expect(cleanStyle("position: fixed")).toBe("");
    expect(cleanStyle("background: url(x.png)")).toBe("");
    expect(cleanStyle("color: red !important")).toBe("");
    expect(cleanStyle("")).toBe("");
  });
});
