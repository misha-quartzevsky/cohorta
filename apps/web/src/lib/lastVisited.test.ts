import { describe, it, expect } from "vitest";
import { lastVisitedSlug } from "./lastVisited";

describe("lastVisitedSlug", () => {
  it("берёт слаг лекции из пути", () => {
    expect(lastVisitedSlug("/s/5/math/limit")).toBe("limit");
    expect(lastVisitedSlug("/s/5/math/limit/edit")).toBe("limit");
    expect(lastVisitedSlug("/note/idea")).toBe("idea");
    expect(lastVisitedSlug("/note/idea/edit?x=1")).toBe("idea");
  });
});
