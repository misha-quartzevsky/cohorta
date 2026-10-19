/**
 * HTML конспекта → Markdown для выгрузки (B6). Покрывает то, что пишет
 * редактор: заголовки, абзацы, списки, жирный, курсив, код, ссылки,
 * цитаты, таблицы, чек-листы. Формулы и схемы выгружаются подписью
 * (содержимое — в самой лекции), чтобы не терять место в тексте.
 */

function esc(text: string): string {
  return text.replace(/ /g, " ");
}

function inline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return esc(node.textContent ?? "");
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const inner = Array.from(el.childNodes).map(inline).join("");
  switch (el.tagName.toLowerCase()) {
    case "strong":
    case "b":
      return inner.trim() ? `**${inner}**` : inner;
    case "em":
    case "i":
      return inner.trim() ? `*${inner}*` : inner;
    case "s":
    case "del":
      return `~~${inner}~~`;
    case "code":
      return `\`${inner}\``;
    case "a": {
      const href = el.getAttribute("href") ?? "";
      return href ? `[${inner}](${href})` : inner;
    }
    case "br":
      return "  \n";
    case "img":
      return el.getAttribute("alt") ? `[Изображение: ${el.getAttribute("alt")}]` : "[Изображение]";
    case "math-field":
    case "math-span":
    case "math-div":
      return `$${(el.getAttribute("data-latex") ?? el.textContent ?? "").trim()}$`;
    default:
      return inner;
  }
}

function listItems(list: HTMLElement, ordered: boolean, depth: number): string {
  const pad = "  ".repeat(depth);
  let n = 1;
  const lines: string[] = [];
  for (const li of Array.from(list.children)) {
    if (li.tagName.toLowerCase() !== "li") continue;
    const own: string[] = [];
    const nested: string[] = [];
    const check = li.getAttribute("data-checked");
    for (const c of Array.from(li.childNodes)) {
      const tag = (c as HTMLElement).tagName?.toLowerCase();
      if (tag === "ul" || tag === "ol") nested.push(listItems(c as HTMLElement, tag === "ol", depth + 1));
      else if (tag === "p") own.push(Array.from(c.childNodes).map(inline).join(""));
      else if (tag === "div" && (c as HTMLElement).querySelector("p")) own.push(Array.from(c.childNodes).map(inline).join(""));
      else own.push(inline(c));
    }
    const mark = check === "true" ? "[x] " : check === "false" ? "[ ] " : "";
    lines.push(`${pad}${ordered ? `${n}.` : "-"} ${mark}${own.join(" ").trim()}`);
    n += 1;
    for (const s of nested) lines.push(s);
  }
  return lines.join("\n");
}

function table(el: HTMLElement): string {
  const rows = Array.from(el.querySelectorAll("tr")).map((tr) =>
    Array.from(tr.children).map((c) => Array.from(c.childNodes).map(inline).join("").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim())
  );
  if (!rows.length) return "";
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => [...r, ...Array(width - r.length).fill("")];
  const line = (r: string[]) => `| ${pad(r).join(" | ")} |`;
  return [line(rows[0]), `| ${Array(width).fill("---").join(" | ")} |`, ...rows.slice(1).map(line)].join("\n");
}

function block(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return esc(node.textContent ?? "").trim();
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const text = () => Array.from(el.childNodes).map(inline).join("").trim();
  if (/^h[1-6]$/.test(tag)) return `${"#".repeat(Number(tag[1]))} ${text()}`;
  if (tag === "p") return text();
  if (tag === "ul") return listItems(el, false, 0);
  if (tag === "ol") return listItems(el, true, 0);
  if (tag === "blockquote") {
    return Array.from(el.childNodes)
      .map(block)
      .filter(Boolean)
      .join("\n\n")
      .split("\n")
      .map((l) => `> ${l}`)
      .join("\n");
  }
  if (tag === "pre") return "```\n" + (el.textContent ?? "").replace(/\n$/, "") + "\n```";
  if (tag === "hr") return "---";
  if (tag === "table") return table(el);
  if (tag === "img") return inline(el);
  if (tag === "math-div" || tag === "math-field") return `$$${(el.getAttribute("data-latex") ?? el.textContent ?? "").trim()}$$`;
  const kids = Array.from(el.childNodes).map(block).filter(Boolean);
  return kids.length > 0 ? kids.join("\n\n") : text();
}

/** HTML → Markdown. Нужен DOM (в браузере есть всегда). */
export function htmlToMarkdown(html: string): string {
  if (!html.trim()) return "";
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const out = Array.from(doc.body.childNodes).map(block).filter(Boolean).join("\n\n");
  return out.replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/** Одна ячейка CSV: кавычки, запятые и переводы строк экранируются. */
export function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Таблица → CSV (с BOM, чтобы Excel открыл кириллицу). */
export function toCsv(header: string[], rows: unknown[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
