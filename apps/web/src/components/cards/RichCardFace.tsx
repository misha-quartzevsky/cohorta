/**
 * ============================================
 *  RichCardFace.tsx — renders a rich card side
 * ============================================
 *
 * Takes the stored rich HTML of a card's front/back, resolves the portable
 * `[[file:name]]` attachment tokens to absolute PocketBase URLs, and
 * post-processes MathLive `[data-type='math-block']` nodes (same approach as
 * LectureView). Plain-text (legacy) values render as-is.
 */

import { useEffect, useMemo, useRef } from "react";
import type { DeckCard } from "../../lib/types";
import {
  embedCardBareFileUrls,
  resolveDeckCardTokens,
} from "../../services/deckService";
import { renderLatexInto } from "../math/renderLatex";

interface Props {
  html: string;
  card: DeckCard;
  className?: string;
}

export default function RichCardFace({ html, card, className }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const resolved = useMemo(() => {
    const tokens = resolveDeckCardTokens(html || "", card);
    // «Голые» PB-URL файлов, вставленные как текст, тоже превращаем в картинку.
    return embedCardBareFileUrls(tokens);
  }, [html, card]);

  // Виртуальные формулы: отрисовываем после вставки HTML (данные в атрибуте).
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root
      .querySelectorAll<HTMLElement>("[data-type='math-block']")
      .forEach((block) => {
        void renderLatexInto(block, block.dataset.latex || "");
      });
  }, [resolved]);

  const isHtml = /<[a-z][\s\S]*>/i.test(resolved);

  return (
    <div
      ref={ref}
      className={`card-face-content${isHtml ? " is-html" : " is-plain"}${
        className ? ` ${className}` : ""
      }`}
      dangerouslySetInnerHTML={{ __html: resolved }}
    />
  );
}
