import { beforeEach, describe, expect, it } from "vitest";

import { classifySaveError, listDrafts, readDraft, removeDraft, saveDraft } from "./draftQueue";

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

describe("очередь черновиков", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", { value: memoryStorage(), configurable: true });
  });

  it("черновик на лекцию: запись, чтение, замена, удаление", () => {
    expect(saveDraft({ id: "a", title: "Т", content: "<p>1</p>" })).toBe(true);
    expect(saveDraft({ id: "a", title: "Т", content: "<p>2</p>" })).toBe(true);
    expect(readDraft("a")?.content).toBe("<p>2</p>");
    expect(listDrafts()).toHaveLength(1);
    removeDraft("a");
    expect(readDraft("a")).toBeNull();
  });

  it("несколько лекций — по очереди записи", () => {
    saveDraft({ id: "b", title: "B", content: "b", ts: 2 });
    saveDraft({ id: "a", title: "A", content: "a", ts: 1 });
    expect(listDrafts().map((d) => d.id)).toEqual(["a", "b"]);
  });

  it("хранилище недоступно — saveDraft возвращает false, а не падает", () => {
    Object.defineProperty(globalThis, "localStorage", {
      value: { ...memoryStorage(), setItem: () => { throw new Error("quota"); } },
      configurable: true,
    });
    expect(saveDraft({ id: "x", title: "x", content: "x" })).toBe(false);
  });
});

describe("classifySaveError", () => {
  it("токен истёк — session, даже если ошибка сетевая", () => {
    expect(classifySaveError({ status: 0 }, false)).toBe("session");
  });
  it("нет сети и ошибки сервера — offline", () => {
    expect(classifySaveError({ status: 0 }, true)).toBe("offline");
    expect(classifySaveError({ status: 503 }, true)).toBe("offline");
    expect(classifySaveError(new TypeError("Failed to fetch"), true)).toBe("offline");
  });
  it("401 — session; отказ по правилам — failed", () => {
    expect(classifySaveError({ status: 401 }, true)).toBe("session");
    expect(classifySaveError({ status: 403 }, true)).toBe("failed");
    expect(classifySaveError({ status: 400 }, true)).toBe("failed");
  });
});
