/**
 * Извлечение обычного текста из HTML лекции (поле `content`, Tiptap).
 * Заголовки и абзацы — отдельные строки (spec 6.2, 10). Строковый парсер
 * без DOMParser: контент — доверенный HTML нашего же редактора, а строковый
 * подход тестируется в Node без jsdom.
 */

const BLOCK_CLOSE_TO_NEWLINE =
  /<\/(p|h1|h2|h3|h4|h5|h6|li|div|tr|blockquote|pre)\s*>/gi;
const BR_TO_NEWLINE = /<br\s*\/?>/gi;
const SCRIPT_STYLE = /<(script|style)[^>]*>[\s\S]*?<\/\1>/gi;
const ANY_TAG = /<[^>]+>/g;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  apos: "'",
  nbsp: " ",
  laquo: "«",
  raquo: "»",
  mdash: "—",
  ndash: "–",
  hellip: "…",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+\d*);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const codePoint =
        code[1]?.toLowerCase() === "x"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** HTML лекции → plain text, заголовки/абзацы на отдельных строках. */
export function extractText(html: string | null | undefined): string {
  if (!html) return "";
  let s = html.replace(SCRIPT_STYLE, " ");
  s = s.replace(BR_TO_NEWLINE, "\n");
  s = s.replace(BLOCK_CLOSE_TO_NEWLINE, "\n");
  s = s.replace(ANY_TAG, "");
  s = decodeEntities(s);
  // Схлопнуть пробелы внутри строки, но сохранить переносы между строками.
  s = s
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
  return s.trim();
}

/**
 * Нормализация текста для сравнения/хеширования (spec 6.2):
 * нижний регистр, схлопнутые пробелы, без кавычек-ёлочек.
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[«»"""]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
