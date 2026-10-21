import { describe, expect, it } from "vitest";
import { plainToHtml } from "./cardText";

describe("plainToHtml", () => {
  it("делает абзац из каждой непустой строки", () => {
    expect(plainToHtml("первая\n\n вторая ")).toBe("<p>первая</p><p>вторая</p>");
  });
  it("экранирует разметку", () => {
    expect(plainToHtml("a < b & <script>")).toBe("<p>a &lt; b &amp; &lt;script&gt;</p>");
  });
});
