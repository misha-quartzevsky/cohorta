/**
 * ============================================
 *  lib/markdownTable.ts — GFM markdown table paste
 * ============================================
 *
 * Obsidian and other markdown editors put *plain text* tables on the
 * clipboard (text/plain), not a usable <table> in text/html. Tiptap's
 * default paste then inserts them as raw "| a | b |" paragraphs.
 *
 * This module detects a pasted GitHub-Flavored-Markdown table block
 * (a header row + a "| --- |" separator row) and converts it — together
 * with any surrounding prose — into an HTML document the editor can parse
 * into real table nodes.
 */

type Cell = string;

/** Is this line shaped like a markdown table row ("| a | b |")? */
function isTableRow(line: string): boolean {
  const t = line.trim();
  if (!t.startsWith("|")) return false;
  const pipes = t.match(/\|/g)?.length ?? 0;
  return pipes >= 2;
}

/** The "| --- |" separator row: every cell is only dashes (and : alignment). */
function isSeparator(line: string): boolean {
  const t = line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "");
  if (!t.includes("|")) return false;
  const cells = t.split("|");
  return (
    cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c.trim()))
  );
}

/** Split one "| a | b | c |" row into trimmed cells (unescapes \\|). */
function splitRow(line: string): string[] | null {
  const t = line.trim();
  if (!t.startsWith("|")) return null;
  const parts = t.slice(1).split("|");
  if (parts.length && parts[parts.length - 1].trim() === "") parts.pop();
  return parts.map((c) => c.replace(/\\\|/g, "|").trim());
}

/** Escape HTML then apply the tiny inline markdown used in table cells. */
function inlineMd(s: string): string {
  let h = s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  h = h.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  h = h.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  h = h.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  h = h.replace(/`([^`]+)`/g, "<code>$1</code>");
  return h;
}

interface TableBlock {
  header: Cell[];
  body: Cell[][];
}

/**
 * Parse a markdown table starting at `lines[0]` (header) with `lines[1]`
 * as the separator. Returns the block and how many source lines it consumed,
 * or null when the block isn't a table. Missing cells are padded to the widest
 * row so ProseMirror gets a rectangular table.
 */
function parseTableBlock(lines: string[]): { block: TableBlock; consumed: number } | null {
  const header = splitRow(lines[0]);
  if (!header || !isSeparator(lines[1])) return null;

  const body: Cell[][] = [];
  let i = 2;
  for (; i < lines.length; i++) {
    const cells = splitRow(lines[i]);
    if (!cells) break;
    body.push(cells);
  }

  const width = Math.max(header.length, ...body.map((r) => r.length));
  const pad = (arr: Cell[]) => {
    const out = [...arr];
    while (out.length < width) out.push("");
    return out;
  };

  return { block: { header: pad(header), body: body.map(pad) }, consumed: i };
}

function tableToHtml({ header, body }: TableBlock): string {
  const cells = (arr: Cell[], tag: "th" | "td") =>
    arr.map((c) => `<${tag}>${inlineMd(c)}</${tag}>`).join("");
  const head = `<thead><tr>${cells(header, "th")}</tr></thead>`;
  const rows = body.map((r) => `<tr>${cells(r, "td")}</tr>`).join("");
  return `<table>${head}<tbody>${rows}</tbody></table>`;
}

/**
 * Convert pasted plain text that contains at least one markdown table into an
 * HTML fragment: tables become <table>, everything else becomes <p> with light
 * inline markdown. Returns null when no table is present (caller falls back to
 * the default paste behaviour).
 */
export function pastedMarkdownHtml(text: string): string | null {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let changed = false;
  let i = 0;

  while (i < lines.length) {
    if (isTableRow(lines[i]) && isSeparator(lines[i + 1] ?? "")) {
      const parsed = parseTableBlock(lines.slice(i));
      if (parsed) {
        out.push(tableToHtml(parsed.block));
        changed = true;
        i += parsed.consumed;
        continue;
      }
    }
    out.push(lines[i].trim() === "" ? "<p></p>" : `<p>${inlineMd(lines[i])}</p>`);
    i++;
  }

  if (!changed) return null;
  while (out.length && out[out.length - 1] === "<p></p>") out.pop();
  return out.join("\n");
}
