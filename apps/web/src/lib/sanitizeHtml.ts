/**
 * ============================================
 *  sanitizeHtml.ts — единственная очистка пользовательского HTML перед показом
 * ============================================
 *
 * Лекции, ответы на билеты и карточки хранятся как HTML, который строит Tiptap, но по REST его можно записать
 * любым (и «Добавить в мои конспекты» копирует чужой HTML без изменений), поэтому всё, что идёт в
 * `dangerouslySetInnerHTML`, проходит через `sanitizeHtml` (см. компонент `RichHtml`). Аудит безопасности 2026-10:
 * C-1 (хранимый XSS через копию лекции), C-2 (обходы самописного чёрного списка).
 *
 * Политика (DOMPurify, белый список):
 *  - теги и атрибуты: только то, что реально выдаёт Tiptap (`getHTML`) плюс таблицы, чек-листы, картинки, аудио;
 *    svg, math, form, iframe, object, embed, script, style, link, meta, base — нет; `on*`, `id`, `name` — нет;
 *  - ссылки и адреса картинок: http, https, mailto, tel и относительные; `data:` только у `img` (картинки из буфера);
 *  - `data-*` разрешены (формулы `data-latex`, схемы `data-scene`, метки времени `data-ts`);
 *  - `class` режется до классов Tiptap (`language-*`, `media-*`): иначе чужой HTML мог бы навесить служебные
 *    классы интерфейса (всплывающие окна, оверлеи);
 *  - `style` режется до безопасных свойств (цвет, фон, выравнивание, ширины: то, что дают таблицы и выделение);
 *    position, inset, z-index, transform, url(), expression, переменные вне нашей палитры отбрасываются;
 *  - ссылки на внешние сайты открываются в новой вкладке с `rel="noopener noreferrer"`.
 * Серверной очистки в `/copy` нет (в JSVM нет DOMPurify), см. отчёт, «Волна 1: варианты».
 */
import DOMPurify from "dompurify";

const TAGS = [
  "p", "br", "hr", "span", "div",
  "strong", "b", "em", "i", "u", "s", "del", "ins", "code", "pre", "kbd", "mark", "sub", "sup", "blockquote",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "a", "img", "figure", "figcaption",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "colgroup", "col", "caption",
  "audio", "label", "input",
];
const ATTRS = [
  "href", "src", "alt", "title", "class", "style", "target", "rel", "width", "height",
  "colspan", "rowspan", "colwidth", "start", "controls", "preload", "checked", "disabled", "type", "lang", "dir",
];

/** Адреса: http, https, mailto, tel и относительные (как у DOMPurify по умолчанию, но без ftp, sms и т. п.). */
const ALLOWED_URI = /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i;

const SAFE_STYLE = new Set([
  "color", "background", "background-color", "text-align", "vertical-align", "width", "min-width", "max-width", "height",
  "min-height", "max-height", "font-weight", "font-style", "text-decoration", "text-decoration-line", "text-indent",
]);
/** Значение: цвета, числа с единицами, ключевые слова, var(--палитра). Всё остальное (url(), expression, \, @, ;) нельзя. */
const SAFE_VALUE = /^[#a-z0-9%.,\s+()-]*$/i;
const BAD_VALUE = /url\s*\(|expression|javascript|vbscript|image-set|\\|\/\*|@|!important|attr\s*\(/i;

const SAFE_CLASS = /^(?:language-[\w+#.-]+|media-figure|media-block-img)$/;

/** Оставляет только безопасные объявления style; пустая строка = атрибут не нужен. */
export function cleanStyle(style: string): string {
  const kept: string[] = [];
  for (const decl of style.split(";")) {
    const i = decl.indexOf(":");
    if (i < 1) continue;
    const prop = decl.slice(0, i).trim().toLowerCase();
    const value = decl.slice(i + 1).trim();
    if (!SAFE_STYLE.has(prop) || !value || BAD_VALUE.test(value) || !SAFE_VALUE.test(value)) continue;
    kept.push(`${prop}: ${value}`);
  }
  return kept.join("; ");
}

let purifier: ReturnType<typeof DOMPurify> | null = null;

function getPurifier() {
  if (purifier) return purifier;
  if (typeof window === "undefined") return null;
  const p = DOMPurify(window);
  if (!p.isSupported) return null;
  p.addHook("uponSanitizeAttribute", (_node, data) => {
    if (data.attrName === "style") {
      const cleaned = cleanStyle(data.attrValue);
      if (cleaned) data.attrValue = cleaned;
      else data.keepAttr = false;
    } else if (data.attrName === "class") {
      const cleaned = data.attrValue.split(/\s+/).filter((c) => SAFE_CLASS.test(c)).join(" ");
      if (cleaned) data.attrValue = cleaned;
      else data.keepAttr = false;
    }
  });
  p.addHook("afterSanitizeAttributes", (node) => {
    if (node.nodeName === "A" && node.hasAttribute("href")) {
      node.setAttribute("rel", "noopener noreferrer");
      if (/^https?:/i.test(node.getAttribute("href") ?? "")) node.setAttribute("target", "_blank");
      else node.removeAttribute("target");
    } else if (node.nodeName === "INPUT" && (node.getAttribute("type") ?? "").toLowerCase() !== "checkbox") {
      node.remove();
    }
  });
  purifier = p;
  return p;
}

/** Безопасный HTML для вставки в страницу; без DOM (серверный запуск) возвращает пустую строку. */
export function sanitizeHtml(html: string): string {
  const p = getPurifier();
  if (!p) return "";
  return p.sanitize(html, {
    ALLOWED_TAGS: TAGS,
    ALLOWED_ATTR: ATTRS,
    ALLOW_DATA_ATTR: true,
    ALLOW_ARIA_ATTR: false,
    ALLOWED_URI_REGEXP: ALLOWED_URI,
  }) as string;
}
