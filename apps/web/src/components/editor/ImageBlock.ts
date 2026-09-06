/**
 * ============================================
 *  ImageBlock.ts — картинка как единый медиа-блок
 * ============================================
 *
 * Расширяет сток `@tiptap/extension-image`: тот же узел `image` (все пути
 * вставки — drag / paste / slash / setImage — продолжают работать), но с
 * node view (общая обёртка MediaBlockShell), атрибутом `caption` и
 * сериализацией в `<figure class="media-figure">`.
 *
 * parseHTML принимает и `<figure class="media-figure"><img></figure>`, и
 * голый `<img>` (легаси-контент в `content_rich`).
 * Токены `[[file:…]]` в `src` обрабатывает общая инфраструктура
 * (resolveFileTokens / tokenizePbFileUrls) — работает по строке, `<figure>`
 * ей не мешает.
 */

import ImageExtension from "@tiptap/extension-image";
import { mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { ImageBlockView } from "./ImageBlockView";

export const ImageBlock = ImageExtension.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      caption: {
        default: "",
        // Подпись живёт в <figcaption>, не в атрибуте <img>.
        parseHTML: (el) => {
          const fig = el.closest("figure");
          const cap = fig?.querySelector("figcaption")?.textContent;
          return cap ?? el.getAttribute("data-caption") ?? "";
        },
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [
      { tag: "figure.media-figure img" },
      { tag: "img[src]" },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { caption, ...rest } = HTMLAttributes as Record<string, unknown>;
    void caption;
    const img = [
      "img",
      mergeAttributes(this.options.HTMLAttributes, rest),
    ];
    const cap = String(node.attrs.caption ?? "").trim();
    return cap
      ? ["figure", { class: "media-figure" }, img, ["figcaption", {}, cap]]
      : ["figure", { class: "media-figure" }, img];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageBlockView);
  },
});
