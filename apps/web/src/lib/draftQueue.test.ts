import { beforeEach, describe, expect, it } from "vitest";

import { classifySaveError, clearMyDrafts, listDrafts, purgeForeignDrafts, readDraft, removeDraft, saveDraft } from "./draftQueue";
import { pb } from "./pocketbase";

/** Войти как пользователь без сети: draftQueue смотрит только на id записи в authStore. */
function signInAs(id: string): void {
  pb.authStore.save("token", { id, collectionId: "users", collectionName: "users" });
}

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
    signInAs("u1");
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

describe("черновики привязаны к пользователю (C-5)", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", { value: memoryStorage(), configurable: true });
  });

  it("ключ и тело записи содержат id пользователя", () => {
    signInAs("alice");
    saveDraft({ id: "l1", title: "T", content: "<p>секрет</p>" });
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) as string);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toContain("alice");
    expect(JSON.parse(localStorage.getItem(keys[0]) as string).uid).toBe("alice");
  });

  it("другой пользователь на этом устройстве не видит и не читает чужой черновик", () => {
    signInAs("alice");
    saveDraft({ id: "l1", title: "T", content: "<p>секрет Алисы</p>" });
    signInAs("bob");
    expect(readDraft("l1")).toBeNull();
    expect(listDrafts()).toEqual([]);
    removeDraft("l1"); // удаляет только черновик Боба: Алисин на месте
    signInAs("alice");
    expect(readDraft("l1")?.content).toBe("<p>секрет Алисы</p>");
  });

  it("запись с подменённым uid в теле не читается", () => {
    signInAs("alice");
    saveDraft({ id: "l1", title: "T", content: "x" });
    const key = localStorage.key(0) as string;
    localStorage.setItem(key, JSON.stringify({ id: "l1", title: "T", content: "x", uid: "mallory", ts: 1 }));
    expect(readDraft("l1")).toBeNull();
    expect(listDrafts()).toEqual([]);
  });

  it("без сессии черновик не пишется", () => {
    pb.authStore.clear();
    expect(saveDraft({ id: "l1", title: "T", content: "x" })).toBe(false);
    expect(listDrafts()).toEqual([]);
  });

  it("выход очищает черновики текущего пользователя, чужие не трогает", () => {
    signInAs("alice");
    saveDraft({ id: "a1", title: "A", content: "a" });
    saveDraft({ id: "a2", title: "A", content: "a" });
    signInAs("bob");
    saveDraft({ id: "b1", title: "B", content: "b" });
    signInAs("alice");
    clearMyDrafts();
    expect(listDrafts()).toEqual([]);
    signInAs("bob");
    expect(listDrafts().map((d) => d.id)).toEqual(["b1"]);
  });

  it("запуск очереди удаляет чужие черновики и черновики старого формата без хозяина", () => {
    signInAs("alice");
    saveDraft({ id: "a1", title: "A", content: "a" });
    localStorage.setItem("cohorta:draft:lecture:old1", JSON.stringify({ id: "old1", title: "?", content: "без хозяина", ts: 1 }));
    signInAs("bob");
    saveDraft({ id: "b1", title: "B", content: "b" });
    purgeForeignDrafts();
    expect(listDrafts().map((d) => d.id)).toEqual(["b1"]);
    expect(localStorage.getItem("cohorta:draft:lecture:old1")).toBeNull();
    signInAs("alice");
    expect(readDraft("a1")).toBeNull();
  });
});
