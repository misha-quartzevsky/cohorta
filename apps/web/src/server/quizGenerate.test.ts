// Тест серверной функции генерации квиза. Лежит в src/, а не в functions/: всё, что
// в functions/, Cloudflare Pages превращает в маршрут и собирает вместе с функцией.
import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestPost, startOfDayUtc } from "../../functions/api/quiz/generate";

const TEXT = "Договор считается заключённым, когда стороны достигли согласия. ".repeat(8);
const SECRET = "secret-gemini-key";

function goodQuestions(n: number) {
  return {
    questions: Array.from({ length: n }, (_, i) => ({
      type: "mcq",
      topic: "Заключение договора",
      prompt: `Вопрос ${i + 1}?`,
      options: ["a", "b", "c", "d"],
      correct_index: 1,
      explanation: "Потому что так.",
      quote: "Договор считается заключённым",
    })),
  };
}

interface Mock {
  authOk?: boolean;
  lectureOk?: boolean;
  quizzesToday?: number;
  gemini?: Array<unknown | "http500">;
}

function installFetch(m: Mock) {
  let geminiCall = 0;
  const calls: string[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("auth-refresh")) {
      return m.authOk === false
        ? new Response("{}", { status: 401 })
        : new Response(JSON.stringify({ record: { id: "u1" } }), { status: 200 });
    }
    if (url.includes("/collections/lectures/records/")) {
      return new Response("{}", { status: m.lectureOk === false ? 404 : 200 });
    }
    if (url.includes("/collections/quizzes/records")) {
      return new Response(JSON.stringify({ totalItems: m.quizzesToday ?? 0 }), { status: 200 });
    }
    if (url.includes("generativelanguage")) {
      const item = (m.gemini ?? [])[geminiCall++];
      if (item === "http500") return new Response("{}", { status: 500 });
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(item) }] } }] }),
        { status: 200 }
      );
    }
    throw new Error("unexpected url " + url);
  });
  vi.stubGlobal("fetch", fn);
  return { calls, fn };
}

async function call(body: unknown, headers: Record<string, string> = { Authorization: "tok" }, env = {}) {
  const request = new Request("https://x.test/api/quiz/generate", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const res = await onRequestPost({
    request,
    env: { GEMINI_API_KEY: SECRET, PB_URL: "https://pb.test", ...env },
  } as unknown as Parameters<typeof onRequestPost>[0]);
  return { status: res.status, text: await res.text() };
}

const ok = { lectureId: "l1", title: "Лекция", text: TEXT, size: 5 };

afterEach(() => vi.unstubAllGlobals());

describe("POST /api/quiz/generate", () => {
  it("401 без заголовка и при отказе PocketBase", async () => {
    installFetch({});
    expect((await call(ok, {})).status).toBe(401);
    installFetch({ authOk: false });
    expect((await call(ok)).status).toBe(401);
  });

  it("404 для лекции, которую пользователь не видит", async () => {
    installFetch({ lectureOk: false });
    expect((await call(ok)).status).toBe(404);
  });

  it("422: неверный размер и мало текста (порог 300 приходит в ответе)", async () => {
    installFetch({});
    expect((await call({ ...ok, size: 7 })).status).toBe(422);
    const short = await call({ ...ok, text: "x".repeat(299) });
    expect(short.status).toBe(422);
    expect(JSON.parse(short.text)).toEqual({ error: "not_enough_text", min: 300 });
    // ровно 300 знаков — уже достаточно
    installFetch({ gemini: [goodQuestions(5)] });
    expect((await call({ ...ok, text: "x".repeat(300) })).status).toBe(200);
  });

  it("429: по умолчанию 5 в день, в ответе limit и used; Gemini не вызывается", async () => {
    const { calls } = installFetch({ quizzesToday: 5 });
    const r = await call(ok);
    expect(r.status).toBe(429);
    expect(JSON.parse(r.text)).toEqual({ error: "daily_limit", limit: 5, used: 5 });
    expect(calls.some((u) => u.includes("generativelanguage"))).toBe(false);
  });

  it("4 квиза из 5 — ещё можно; QUIZ_DAILY_LIMIT переопределяет порог", async () => {
    installFetch({ quizzesToday: 4, gemini: [goodQuestions(5)] });
    expect((await call(ok)).status).toBe(200);
    installFetch({ quizzesToday: 4 });
    const r = await call(ok, undefined, { QUIZ_DAILY_LIMIT: "4" });
    expect(r.status).toBe(429);
    expect(JSON.parse(r.text)).toMatchObject({ limit: 4, used: 4 });
  });

  it("502 после двух невалидных ответов Gemini", async () => {
    const { calls } = installFetch({ gemini: [{ questions: [] }, "http500"] });
    const r = await call(ok);
    expect(r.status).toBe(502);
    expect(JSON.parse(r.text)).toEqual({ error: "generation_failed" });
    expect(calls.filter((u) => u.includes("generativelanguage"))).toHaveLength(2);
  });

  it("успех со вторым запросом; ключ не попадает в ответ", async () => {
    installFetch({ gemini: [{ questions: [] }, goodQuestions(5)] });
    const r = await call(ok);
    expect(r.status).toBe(200);
    expect(r.text).not.toContain(SECRET);
    expect(JSON.parse(r.text).questions).toHaveLength(5);
  });

  it("ключ уходит в заголовок, не в адрес", async () => {
    const { fn } = installFetch({ gemini: [goodQuestions(5)] });
    await call(ok);
    const geminiCall = fn.mock.calls.find((c) => String(c[0]).includes("generativelanguage"))!;
    expect(String(geminiCall[0])).not.toContain(SECRET);
    expect((geminiCall[1]!.headers as Record<string, string>)["x-goog-api-key"]).toBe(SECRET);
  });
});

describe("startOfDayUtc — сутки лимита по Москве", () => {
  it("днём по Москве: полночь была вчера в 21:00 UTC", () => {
    expect(startOfDayUtc(new Date("2026-10-19T10:00:00Z"), "Europe/Moscow")).toBe("2026-10-18 21:00:00");
  });
  it("в 00:30 по Москве уже новые сутки", () => {
    expect(startOfDayUtc(new Date("2026-10-19T21:30:00Z"), "Europe/Moscow")).toBe("2026-10-19 21:00:00");
  });
  it("в UTC — обычная полночь", () => {
    expect(startOfDayUtc(new Date("2026-10-19T10:00:00Z"), "UTC")).toBe("2026-10-19 00:00:00");
  });
});
