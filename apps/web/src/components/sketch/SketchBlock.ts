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
      caption: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-type='sketch-block']",
        getAttrs: (el) => {
          const node = el as HTMLElement;
          const img = node.querySelector("img");
          return {
            src: img?.getAttribute("src") ?? "",
            scene: node.getAttribute("data-scene") ?? "",
            caption: node.querySelector("figcaption")?.textContent ?? "",
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const cap = String(node.attrs.caption ?? "").trim();
    const attrs = mergeAttributes(HTMLAttributes, {
      "data-type": "sketch-block",
      "data-scene": node.attrs.scene || "",
      class: "media-figure",
    });
    const img = [
      "img",
      { src: node.attrs.src || "", alt: "Схема", class: "media-block-img" },
    ];
    return cap
      ? ["div", attrs, img, ["figcaption", {}, cap]]
      : ["div", attrs, img];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SketchBlockView);
  },
});