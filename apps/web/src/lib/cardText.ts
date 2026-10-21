/** Обычный текст из формы карточки → HTML для полей front/back (абзац на строку, без разметки). */
export function plainToHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p>${esc(l)}</p>`)
    .join("");
}

/** Подпись лекции в списке формы карточки: «Лекция 5 · Заключение и расторжение договора». */
export function lectureOptionLabel(l: { number?: number; title: string }): string {
  return l.number ? `Лекция ${l.number} · ${l.title}` : l.title;
}
