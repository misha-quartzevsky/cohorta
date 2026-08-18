/**
 * ============================================
 *  AudioBlock.tsx — аудио-блок в тексте лекции
 * ============================================
 *
 * Атомарный блок-плеер для аудиозаписей диктовки (и любых будущих
 * вложений). В БД сериализуется как `<audio controls src="…">`; токены
 * `[[file:…]]` внутри src обрабатываются общей инфраструктурой
 * (resolveFileTokens / tokenizePbFileUrls), как у картинок.
 */

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";

function AudioBlockView(props: NodeViewProps) {
  return (
    <audio
      controls
      preload="metadata"
      className="lecture-audio"
      src={props.node.attrs.src}
    />
  );
}

export const AudioBlock = Node.create({
  name: "audioBlock",

  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "audio[src]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "audio",
      mergeAttributes(HTMLAttributes, {
        controls: "true",
        preload: "metadata",
        src: node.attrs.src || "",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AudioBlockView);
  },
});