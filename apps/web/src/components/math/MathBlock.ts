/**
 * ============================================
 *  MathBlock.ts — блочная формула (MathLive)
 * ============================================
 *
 * Атомарный leaf-блок с единственным атрибутом `latex`. Редактирование —
 * через единственный overlay-редактор (см. MathEditorOverlay + mathBus).
 *
 * Сериализация: `<div data-type="math-block" data-latex="…">` — чистый и
 * портативный формат, который спокойно переживает save/load и просмотр.
 */

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { MathBlockView } from "./MathBlockView";

export const MathBlock = Node.create({
  name: "mathBlock",

  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      latex: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-type='math-block']",
        getAttrs: (el) => ({
          latex:
            (el as HTMLElement).getAttribute("data-latex") ?? "",
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "math-block",
        "data-latex": node.attrs.latex || "",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathBlockView);
  },
});