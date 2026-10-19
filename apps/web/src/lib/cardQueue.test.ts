import { describe, expect, it } from "vitest";
import { isRepeat, rate, startQueue } from "./cardQueue";

describe("очередь карточек", () => {
  it("«Снова» и «Трудно» — повторить, «Хорошо» и «Легко» — знаю", () => {
    expect([isRepeat("again"), isRepeat("hard"), isRepeat("good"), isRepeat("easy")]).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  it("«Хорошо» убирает карточку: после трёх оценок очередь закончена", () => {
    let q = startQueue(["a", "b", "c"]);
    q = rate(q, "good");
    q = rate(q, "easy");
    expect(q.done).toBe(false);
    q = rate(q, "good");
    expect(q.done).toBe(true);
    expect(q.known).toBe(3);
    expect(q.repeated).toBe(0);
  });

  it("«Снова» отправляет карточку в конец, колода не заканчивается, пока она не освоена", () => {
    let q = startQueue(["a", "b"]);
    q = rate(q, "again"); // a в конец: b, a
    expect(q.order).toEqual(["a", "b", "a"]);
    q = rate(q, "good"); // b
    expect(q.done).toBe(false);
    q = rate(q, "hard"); // a снова в конец
    expect(q.done).toBe(false);
    q = rate(q, "good");
    expect(q.done).toBe(true);
    expect(q.repeated).toBe(2);
    expect(q.known).toBe(2);
  });

  it("пустая колода сразу закончена, оценка после конца ничего не ломает", () => {
    const empty = startQueue<string>([]);
    expect(empty.done).toBe(true);
    expect(rate(empty, "good").done).toBe(true);
  });
});
