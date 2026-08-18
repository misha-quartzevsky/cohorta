/**
 * ============================================
 *  AudioBlockView.tsx — view для аудио-блока
 * ============================================
 *
 * Вынесен в отдельный файл по правилу Fast Refresh:
 * файл с non-component экспортом (AudioBlock node) не должен
 * содержать React-компоненты.
 */

import type { NodeViewProps } from "@tiptap/react";

/** Аудио-плеер атомарного блока (источник — атрибут узла `src`). */
export default function AudioBlockView(props: NodeViewProps) {
  return (
    <audio
      controls
      preload="metadata"
      className="lecture-audio"
      src={props.node.attrs.src}
    />
  );
}