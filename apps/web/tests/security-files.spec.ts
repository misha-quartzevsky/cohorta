/**
 * ============================================
 *  tests/security-files.spec.ts — тип и размер загружаемых файлов (A-9, B-2, C-8)
 * ============================================
 *
 * Аудит 2026-10. Без браузера, через API. Миграция 1790017000: lectures.file, deck_cards.attachments,
 * exam_tickets.attachments принимают только картинки (jpeg, png, gif, webp, avif) до 5 МБ,
 * users.avatar до 5 МБ и без image/svg+xml. protected остаётся false (файловые токены: см. отчёт, «Волна 1: варианты»).
 * maxSelect у вложений карточки и билета 99 (как у lectures.file): при 0 PocketBase молча оставлял только последний файл.
 */
import { test, expect } from "@playwright/test";
import { PB, cleanup, createCourse, createExam, createLecture, h, register, uid, type Session } from "./group-api";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const SVG = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>");
const MB = 1024 * 1024;
const big = (mb: number) => Buffer.concat([PNG, Buffer.alloc(mb * MB)]);

interface Part {
  name: string;
  type: string;
  data: Buffer;
}
const png = (n: string): Part => ({ name: n, type: "image/png", data: PNG });
const svg: Part = { name: "x.svg", type: "image/svg+xml", data: SVG };

/** multipart-запрос: несколько файлов под одним именем поля (через FormData). */
async function send(s: Session, method: "POST" | "PATCH", path: string, fields: Record<string, string>, field: string, files: Part[]) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  for (const f of files) form.append(field, new Blob([new Uint8Array(f.data)], { type: f.type }), f.name);
  const r = await fetch(`${PB}${path}`, { method, headers: h(s), body: form });
  return { status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, any> };
}

test.describe("файловые поля", () => {
  let a: Session;
  test.beforeAll(async ({ request }) => {
    a = await register(request, "files");
  });
  test.afterAll(async ({ request }) => cleanup(request, [a]));

  test("lectures.file: картинка, схема-svg и аудио проходят, html и файл больше 10 МБ отклонены", async ({ request }) => {
    const lecture = await createLecture(request, a, `Файлы ${uid()}`);
    const url = `/api/collections/lectures/records/${lecture}`;
    const ok = await send(a, "PATCH", url, {}, "file", [png("a.png")]);
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    // схемы Excalidraw (svg) и аудиозаписи клиент грузит именно в lectures.file
    expect((await send(a, "PATCH", url, {}, "file", [{ ...svg, name: "sketch.svg" }])).status, "svg схемы").toBe(200);
    const audio: Part = { name: "rec.webm", type: "audio/webm", data: Buffer.concat([Buffer.from("1a45dfa39f4286810142f7810142f2810442f381084282847765626d428781044285810 2".replace(/ /g, ""), "hex"), Buffer.alloc(64)]) };
    expect((await send(a, "PATCH", url, {}, "file", [audio])).status, "аудио").toBe(200);
    const html: Part = { name: "x.html", type: "text/html", data: Buffer.from("<script>1</script>") };
    expect((await send(a, "PATCH", url, {}, "file", [html])).status, "html").toBe(400);
    const large: Part = { name: "big.png", type: "image/png", data: big(7) };
    expect((await send(a, "PATCH", url, {}, "file", [large])).status, "7 МБ").toBe(400);
  });

  test("deck_cards.attachments: несколько картинок сохраняются все, svg и большой файл отклонены", async ({ request }) => {
    const deck = (await (await request.post(`${PB}/api/collections/decks/records`, { headers: h(a), data: { title: `Колода ${uid()}`, owner: a.id } })).json()).id as string;
    const fields = { deck, front: "<p>q</p>", back: "<p>a</p>" };
    const path = "/api/collections/deck_cards/records";
    const two = await send(a, "POST", path, fields, "attachments", [png("1.png"), png("2.png")]);
    expect(two.status, JSON.stringify(two.body)).toBe(200);
    expect(two.body.attachments, "оба файла сохранены").toHaveLength(2);
    expect((await send(a, "POST", path, fields, "attachments", [svg])).status, "svg").toBe(400);
    const large: Part = { name: "big.png", type: "image/png", data: big(7) };
    expect((await send(a, "POST", path, fields, "attachments", [large])).status, "7 МБ").toBe(400);
  });

  test("exam_tickets.attachments: несколько картинок сохраняются все, svg и большой файл отклонены", async ({ request }) => {
    const exam = await createExam(request, a, await createCourse(request, a, `Предмет ${uid()}`));
    const path = "/api/collections/exam_tickets/records";
    const fields = (n: number) => ({ exam, number: String(n), question: "Вопрос", status: "empty" });
    const two = await send(a, "POST", path, fields(1), "attachments", [png("1.png"), png("2.png")]);
    expect(two.status, JSON.stringify(two.body)).toBe(200);
    expect(two.body.attachments).toHaveLength(2);
    expect((await send(a, "POST", path, fields(2), "attachments", [svg])).status, "svg").toBe(400);
    const large: Part = { name: "big.png", type: "image/png", data: big(7) };
    expect((await send(a, "POST", path, fields(3), "attachments", [large])).status, "7 МБ").toBe(400);
  });

  test("users.avatar: картинка проходит, svg и файл больше 5 МБ отклонены", async () => {
    const url = `/api/collections/users/records/${a.id}`;
    const ok = await send(a, "PATCH", url, {}, "avatar", [png("me.png")]);
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect((await send(a, "PATCH", url, {}, "avatar", [{ ...svg, name: "me.svg" }])).status, "svg").toBe(400);
    const large: Part = { name: "big.png", type: "image/png", data: big(6) };
    expect((await send(a, "PATCH", url, {}, "avatar", [large])).status, "6 МБ").toBe(400);
  });
});
