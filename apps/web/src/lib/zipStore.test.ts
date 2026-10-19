import { describe, expect, it } from "vitest";

import { csvCell, toCsv } from "./htmlToMarkdown";
import { buildZip, crc32, safeFileName, textBytes } from "./zipStore";

describe("zipStore", () => {
  it("crc32 совпадает с эталоном", () => {
    expect(crc32(textBytes("123456789"))).toBe(0xcbf43926);
  });

  it("архив читается: сигнатуры, число файлов, имя и содержимое", () => {
    const zip = buildZip([
      { path: "Философия/Предмет и метод.md", data: textBytes("# Предмет и метод\n") },
      { path: "tasks.csv", data: textBytes("a,b\n") },
    ]);
    const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    const endAt = zip.length - 22;
    expect(v.getUint32(endAt, true)).toBe(0x06054b50);
    expect(v.getUint16(endAt + 10, true)).toBe(2);
    const nameLen = v.getUint16(26, true);
    expect(new TextDecoder().decode(zip.slice(30, 30 + nameLen))).toBe("Философия/Предмет и метод.md");
    const size = v.getUint32(22, true);
    expect(new TextDecoder().decode(zip.slice(30 + nameLen, 30 + nameLen + size))).toBe("# Предмет и метод\n");
  });

  it("имена файлов без запрещённых символов", () => {
    expect(safeFileName('Что: "это"? / да')).toBe("Что это да");
    expect(safeFileName("   ")).toBe("Без названия");
    expect(safeFileName("конец.")).toBe("конец");
  });
});

describe("csv", () => {
  it("экранирует кавычки, запятые и переносы", () => {
    expect(csvCell('a "b", c')).toBe('"a ""b"", c"');
    expect(csvCell("простой")).toBe("простой");
    expect(csvCell(null)).toBe("");
  });
  it("начинается с BOM и использует CRLF", () => {
    const csv = toCsv(["a", "b"], [[1, "x,y"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("a,b\r\n1,\"x,y\"\r\n");
  });
});
