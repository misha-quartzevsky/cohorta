/**
 * ============================================
 *  SketchBlock.ts — редактируемая схема (Excalidraw)
 * ============================================
 *
 * Атомарный блок: атрибут `src` — изображение (SVG с прозрачным фоном),
 * загруженное в поле `file` лекции; атрибут `scene` — сериализованная
 * сцена Excalidraw (JSON), чтобы схему можно было переоткрыть и править.
 *
 * Сериализация:
 *   <div data-type="sketch-block" data-scene="…"><img src="…"></div>
 * Токены `[[file:…]]` в src обрабатываются общей инфраструктурой.
 */

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { SketchBlockView } from "./SketchBlockView";

export const SketchBlock = Node.create({
  name: "sketchBlock",

  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: "" },
      scene: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-type='sketch-block']",
        getAttrs: (el) => {
          const img = (el as HTMLElement).querySelector("img");
          return {
            src: img?.getAttribute("src") ?? "",
            scene: (el as HTMLElement).getAttribute("data-scene") ?? "",
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "sketch-block",
        "data-scene": node.attrs.scene || "",
      }),
      [
        "img",
        {
          src: node.attrs.src || "",
          alt: "Схема",
          class: "sketch-block-img",
        },
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SketchBlockView);
  },
});