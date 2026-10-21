import { describe, expect, it } from "vitest";
import { keyboardInset } from "./keyboardInset";

const win = (innerHeight: number, height: number, offsetTop = 0) =>
  ({ innerHeight, visualViewport: { height, offsetTop } }) as unknown as Window;

describe("keyboardInset", () => {
  it("без клавиатуры 0", () => {
    expect(keyboardInset(win(844, 844))).toBe(0);
  });
  it("клавиатура поднимает панель на свою высоту", () => {
    expect(keyboardInset(win(844, 520))).toBe(324);
  });
  it("прокрутка визуального окна не считается клавиатурой", () => {
    expect(keyboardInset(win(844, 520, 324))).toBe(0);
  });
  it("нет visualViewport — 0", () => {
    expect(keyboardInset({ innerHeight: 800, visualViewport: null } as unknown as Window)).toBe(0);
  });
});
