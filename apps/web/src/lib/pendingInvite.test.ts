import { beforeEach, describe, expect, it } from "vitest";

import { afterAuthTarget, clearPendingInvite, readPendingInvite, savePendingInvite } from "./pendingInvite";

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

describe("pendingInvite", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", { value: memoryStorage(), configurable: true });
  });

  it("код переживает чтение и стирается по clear", () => {
    savePendingInvite(" mk31-7x4p ");
    expect(readPendingInvite()).toBe("mk31-7x4p");
    clearPendingInvite();
    expect(readPendingInvite()).toBe("");
  });

  it("после входа ведёт на подтверждение вступления, если код сохранён", () => {
    expect(afterAuthTarget("/tasks")).toBe("/tasks");
    savePendingInvite("abc 1");
    expect(afterAuthTarget("/tasks")).toBe("/join/abc%201");
  });
});
