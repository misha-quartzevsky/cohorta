/**
 * Чистка HTML чужой лекции перед показом. Свою лекцию редактор строит сам, а чужой HTML приходит
 * с сервера как есть: убираем всё, что может выполнить код или утащить данные.
 */
const DROP_TAGS = ["script", "style", "iframe", "object", "embed", "link", "meta", "form", "base", "frame", "frameset"];

export function sanitizeHtml(html: string): string {
  if (typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  for (const tag of DROP_TAGS) doc.querySelectorAll(tag).forEach((el) => el.remove());
  doc.body.querySelectorAll("*").forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on") || name === "srcdoc" || name === "formaction") {
        el.removeAttribute(attr.name);
      } else if ((name === "href" || name === "src" || name === "xlink:href" || name === "action") && /^(javascript|vbscript|data:text)/.test(value)) {
        el.removeAttribute(attr.name);
      }
    }
    if (el.tagName === "A") {
      el.setAttribute("rel", "noopener noreferrer");
      el.setAttribute("target", "_blank");
    }
  });
  return doc.body.innerHTML;
}
