/**
 * ============================================
 *  speechMark.ts — Mark временного текста диктовки
 * ============================================
 *
 * Промежуточный (interim) текст распознавания подсвечивается этим mark'ом,
 * чтобы его можно было сразу «подкрасить» в редакторе и заменить следующим
 * результатом без пересоздания абзацев.
 *
 * Mark никогда не должен жить в сохранённом HTML: при остановке диктовки
 * весь interim-текст уже конвертирован в финальный (обычный) текст.
 */

import { Mark } from "@tiptap/core";

export const SpeechInterimMark = Mark.create({
  name: "speechInterim",

  parseHTML() {
    return [{ tag: "span[data-speech-interim]" }];
  },

  renderHTML() {
    return ["span", { "data-speech-interim": "true" }];
  },
});
