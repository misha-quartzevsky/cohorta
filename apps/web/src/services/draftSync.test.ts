import { beforeEach, describe, expect, it, vi } from "vitest";

import { listDrafts, readDraft, saveDraft } from "../lib/draftQueue";
import { pb } from "../lib/pocketbase";

const updateLecture = vi.fn();
vi.mock("./lectureService", () => ({ updateLecture: (...args: unknown[]) => updateLecture(...args) }));

import { flushDraftsBeforeSignOut, syncDrafts } from "./draftSync";

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

/** JWT со сроком в будущем: authStore.isValid проверяет только exp. */
function jwt(): string {
  const part = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${part({ alg: "none" })}.${part({ exp: Math.floor(Date.now() / 1000) + 3600 })}.x`;
}
function signInAs(id: string): void {
  pb.authStore.save(jwt(), { id, collectionId: "users", collectionName: "users" });
}

describe("отправка черновиков (draftSync)", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", { value: memoryStorage(), configurable: true });
    updateLecture.mockReset();
    signInAs("alice");
  });

  it("отправляет черновики текущего пользователя и убирает их из очереди", async () => {
    saveDraft({ id: "l1", title: "T", content: "<p>1</p>" });
    updateLecture.mockResolvedValue({});
    expect(await syncDrafts()).toBe(true);
    expect(updateLecture).toHaveBeenCalledWith("l1", "T", "<p>1</p>", undefined);
    expect(listDrafts()).toEqual([]);
  });

  it("чужие черновики не отправляются: Боб на устройстве Алисы не пишет её текст от своего имени", async () => {
    saveDraft({ id: "alice-lecture", title: "T", content: "<p>секрет Алисы</p>" });
    signInAs("bob");
    updateLecture.mockResolvedValue({});
    expect(await syncDrafts()).toBe(true);
    expect(updateLecture).not.toHaveBeenCalled();
    signInAs("alice");
    expect(readDraft("alice-lecture")?.content).toBe("<p>секрет Алисы</p>");
  });

  it("404 удаляет только свой черновик, чужой на месте", async () => {
    saveDraft({ id: "gone", title: "T", content: "x" });
    signInAs("bob");
    saveDraft({ id: "gone", title: "Боб", content: "чужой" });
    updateLecture.mockRejectedValue({ status: 404 });
    expect(await syncDrafts()).toBe(true);
    expect(listDrafts()).toEqual([]);
    signInAs("alice");
    expect(readDraft("gone")?.content, "черновик Алисы с тем же id лекции не затронут").toBe("x");
  });

  it("ошибка сервера (403) оставляет черновик в очереди", async () => {
    saveDraft({ id: "l1", title: "T", content: "x" });
    updateLecture.mockRejectedValue({ status: 403 });
    expect(await syncDrafts()).toBe(false);
    expect(readDraft("l1")?.content).toBe("x");
  });

  it("если пока отправляли, появилась новая версия, она остаётся в очереди", async () => {
    saveDraft({ id: "l1", title: "T", content: "v1", ts: 1 });
    updateLecture.mockImplementation(async () => {
      saveDraft({ id: "l1", title: "T", content: "v2", ts: 2 });
      return {};
    });
    await syncDrafts();
    expect(readDraft("l1")?.content).toBe("v2");
  });

  it("без действующей сессии ничего не отправляется", async () => {
    saveDraft({ id: "l1", title: "T", content: "x" });
    pb.authStore.save("просроченный", { id: "alice", collectionId: "users", collectionName: "users" });
    expect(await syncDrafts()).toBe(false);
    expect(updateLecture).not.toHaveBeenCalled();
  });

  it("перед выходом ожидание отправки ограничено: зависший сервер не держит выход", async () => {
    saveDraft({ id: "l1", title: "T", content: "x" });
    updateLecture.mockImplementation(() => new Promise(() => undefined));
    const t = Date.now();
    await flushDraftsBeforeSignOut(80);
    expect(Date.now() - t).toBeLessThan(1500);
  });

  it("перед выходом без черновиков ничего не ждёт", async () => {
    updateLecture.mockImplementation(() => new Promise(() => undefined));
    const t = Date.now();
    await flushDraftsBeforeSignOut(5000);
    expect(Date.now() - t).toBeLessThan(500);
  });
});
