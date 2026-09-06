/**
 * ============================================
 *  NodeTimestamp.ts — время записи строки при диктовке
 * ============================================
 *
 * Глобальные атрибуты `data-ts` (эпоха мс) и `data-ts-label` (готовая
 * локальная подпись «6 сент., 14:32») на узлах `paragraph` / `heading`.
 * Проставляются в SpeechProvider при вставке финального сегмента распознавания
 * (первая фраза «застолбляет» время блока). Персистятся в `content_rich`
 * штатным `editor.getHTML()`. Hover-тултип — чисто CSS (`[data-ts]:hover::after`).
 */

import { Extension } from "@tiptap/core";

export const NodeTimestamp = Extension.create({
  name: "nodeTimestamp",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          dataTs: {
            default: null,
            parseHTML: (el) => el.getAttribute("data-ts"),
            renderHTML: (attrs) =>
              attrs.dataTs ? { "data-ts": String(attrs.dataTs) } : {},
          },
          dataTsLabel: {
            default: null,
            parseHTML: (el) => el.getAttribute("data-ts-label"),
            renderHTML: (attrs) =>
              attrs.dataTsLabel
                ? { "data-ts-label": String(attrs.dataTsLabel) }
                : {},
          },
        },
      },
    ];
  },
});
