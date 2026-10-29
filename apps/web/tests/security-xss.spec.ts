/**
 * ============================================
 *  tests/security-xss.spec.ts — хранимый XSS через лекцию (C-1, C-2)
 * ============================================
 *
 * Аудит 2026-10. Автор записывает в lectures.content через REST то, чего редактор Tiptap не выдаст
 * (<img onerror>, java\tscript:, SMIL, position:fixed), выдаёт жертве доступ с allow_copy. Жертва
 * открывает общий просмотр и нажимает «Добавить в мои конспекты» (POST /api/lectures/{id}/copy).
 * Серверная копия содержимое не очищает (в JSVM нет DOMPurify), поэтому защита стоит на выводе:
 * все dangerouslySetInnerHTML идут через RichHtml → sanitizeHtml (DOMPurify, белый список Tiptap).
 * Тест красный, если вывод не очищается: скрипт из копии выполняется и читает токен жертвы.
 */
import { test, expect, type Page } from "@playwright/test";
import { PB, grantShare, groupWith, h, register, uid } from "./group-api";
import { newPerson } from "./group-ui";

const PAYLOAD =
  `<p>Обычный абзац ${"X".repeat(3)}</p>` +
  `<img src="x" onerror="window.__xss='img:'+(localStorage.getItem('pocketbase_auth')||'').length">` +
  `<p onmouseover="window.__xss='hover'" style="color: red; position:fixed">стиль и обработчик</p>` +
  `<a href="java\tscript:window.__xss='tab'">ссылка с табом</a>` +
  `<a href="\u0001javascript:window.__xss='ctrl'">ссылка с управляющим</a>` +
  `<a href="JaVaScRiPt:window.__xss='case'">ссылка в другом регистре</a>` +
  `<svg><a><animate attributeName="href" values="javascript:window.__xss='smil'"/><text x="0" y="10">smil</text></a></svg>` +
  `<div style="position:fixed;inset:0;z-index:9999;background:#fff">Сессия истекла, введите пароль</div>` +
  `<table style="min-width: 150px"><colgroup><col style="width: 150px"></colgroup><tbody><tr><td colspan="1" rowspan="1"><p>ячейка таблицы</p></td></tr></tbody></table>` +
  `<div data-type="math-block" data-latex="x^2"></div>`;

/** Нет ни выполненного скрипта, ни опасных адресов и стилей в выведенном HTML. */
async function expectClean(page: Page, selector: string) {
  await expect(page.locator(selector).first()).toContainText("Обычный абзац", { timeout: 20_000 });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as unknown as { __xss?: string }).__xss ?? null), "скрипт не выполнился").toBeNull();
  const dom = await page.evaluate((sel) => {
    const root = document.querySelector(sel) as HTMLElement;
    const anchors = [...root.querySelectorAll("a[href]")].map((a) => (a as HTMLAnchorElement).protocol);
    return {
      html: root.innerHTML,
      protocols: anchors,
      fixed: [...root.querySelectorAll("*")].some((el) => getComputedStyle(el).position === "fixed"),
      onAttrs: [...root.querySelectorAll("*")].some((el) => [...el.attributes].some((a) => a.name.startsWith("on"))),
    };
  }, selector);
  expect(dom.onAttrs, "нет on*-атрибутов").toBe(false);
  expect(dom.fixed, "нет position:fixed").toBe(false);
  expect(dom.html).not.toMatch(/java\s*script|\u0001|<animate|<svg|position\s*:\s*fixed|onerror|onmouseover/i);
  for (const p of dom.protocols) expect(["http:", "https:", "mailto:", "tel:"], `протокол ссылки ${p}`).toContain(p);
  expect(dom.html).toContain("ячейка таблицы");
  expect(dom.html).toContain('data-latex="x^2"');
}

test("чужая лекция с вредоносным HTML: общий просмотр и копия «в мои конспекты» ничего не выполняют", async ({ browser, request }) => {
  test.setTimeout(180_000);
  const author = await register(request, "xss-author");
  const victim = await newPerson(browser, request, "xss-victim");
  const g = await groupWith(request, author, [victim.api], "XSS");

  const slug = `xss-${uid()}`;
  const lec = await request.post(`${PB}/api/collections/lectures/records`, {
    headers: h(author),
    data: { title: `Вредная лекция ${uid()}`, slug, content: PAYLOAD, owner: author.id },
  });
  expect(lec.ok(), await lec.text()).toBeTruthy();
  const lectureId = (await lec.json()).id as string;
  const share = await grantShare(request, author, lectureId, victim.api, g.id, true);
  expect(share.ok(), await share.text()).toBeTruthy();

  // копия на сервере: содержимое переносится как есть (серверной очистки нет)
  const copy = await request.post(`${PB}/api/lectures/${lectureId}/copy`, { headers: h(victim.api), data: {} });
  expect(copy.status(), await copy.text()).toBe(200);
  const copied = (await copy.json()) as { id: string; slug: string };
  const stored = await (await request.get(`${PB}/api/collections/lectures/records/${copied.id}`, { headers: h(victim.api) })).json();
  expect(stored.content, "в копии на сервере полезная нагрузка сохранена").toContain("onerror");

  const page = victim.page;
  const dialogs: string[] = [];
  page.on("dialog", async (d) => {
    dialogs.push(d.message());
    await d.dismiss();
  });

  // 1. открытие копии (раньше: window.__xss = "img:801", токен прочитан)
  await page.goto(`/note/${copied.slug}`);
  await expectClean(page, ".lecture-view-content");

  // 2. общий просмотр чужой лекции в режиме группы (C-2: java\tscript:, SMIL, position:fixed оставались)
  await page.evaluate(([group]) => {
    localStorage.setItem("cohorta:mode", "group");
    localStorage.setItem("cohorta:group", group);
  }, [g.id]);
  await page.goto(`/s/1/group/lecture/${lectureId}`);
  await expectClean(page, ".c-gr-readbody");

  // клик по каждой ссылке ничего не запускает
  for (const link of await page.locator(".c-gr-readbody a").all()) {
    await link.click({ noWaitAfter: true, timeout: 2000 }).catch(() => {});
  }
  expect(await page.evaluate(() => (window as unknown as { __xss?: string }).__xss ?? null)).toBeNull();
  expect(dialogs).toEqual([]);
  await victim.ctx.close();
});
