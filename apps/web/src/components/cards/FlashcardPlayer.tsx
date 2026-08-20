/**
 * ============================================
 *  FlashcardPlayer.tsx — adaptive study player
 * ============================================
 *
 * Games through a deck of cards with the queue model:
 *   «Знаю» → next card, «Повторить» → card goes to the end of the queue.
 * Adaptive interaction:
 *   - desktop  → Space/Enter flip, ← / → review, on-screen buttons
 *   - mobile   → framer-motion swipe (right = «Знаю», left = «Повторить»)
 *                + tap to flip (3D perspective + drag rotation + glow)
 */

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import type { Deck, DeckCard } from "../../lib/types";
import { deckCardBack, deckCardFront, deckTitle } from "../../lib/types";
import RichCardFace from "./RichCardFace";

interface Props {
  deck: Deck;
  cards: DeckCard[];
  onExit: () => void;
}

type Status = "in-progress" | "done";

export default function FlashcardPlayer({ deck, cards, onExit }: Props) {
  const [order, setOrder] = useState<DeckCard[]>(cards);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [knownCount, setKnownCount] = useState(0);
  const [repeatCount, setRepeatCount] = useState(0);
  const [status, setStatus] = useState<Status>("in-progress");

  // Коарс-указатель (тач/мобилка) → включаем свайпы, а не клавиатуру.
  const [coarse, setCoarse] = useState<boolean>(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(pointer: coarse)").matches
      : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const onChange = () => setCoarse(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const current: DeckCard | undefined = order[pos];
  const originalTotal = cards.length;
  const progress = originalTotal
    ? Math.min(knownCount, originalTotal) / originalTotal
    : 0;

  const flip = useCallback(() => {
    if (status !== "in-progress") return;
    setFlipped((f) => !f);
  }, [status]);

  const known = useCallback(() => {
    if (!flipped || status !== "in-progress") return;
    setKnownCount((k) => k + 1);
    const next = pos + 1;
    setFlipped(false);
    if (next >= order.length) setStatus("done");
    else setPos(next);
  }, [flipped, status, pos, order.length]);

  const repeat = useCallback(() => {
    if (!flipped || status !== "in-progress") return;
    setRepeatCount((r) => r + 1);
    // current card goes to the end of the queue.
    setOrder((o) => (o[pos] ? [...o, o[pos]] : o));
    const next = pos + 1;
    setFlipped(false);
    if (next >= order.length) setStatus("done");
    else setPos(next);
  }, [flipped, status, pos, order]);

  const restart = useCallback(() => {
    setOrder(cards);
    setPos(0);
    setFlipped(false);
    setKnownCount(0);
    setRepeatCount(0);
    setStatus("in-progress");
  }, [cards]);

  // Desktop keyboard controls.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (status !== "in-progress") return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        flip();
      } else if (
        (e.key === "ArrowRight" || e.key === "d" || e.key === "D") &&
        flipped
      ) {
        e.preventDefault();
        known();
      } else if (
        (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") &&
        flipped
      ) {
        e.preventDefault();
        repeat();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, flipped, flip, known, repeat]);

  // --- framer-motion drag values (mobile swipe) ---
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-150, 0, 150], [-8, 0, 8]);
  const glowRight = useTransform(x, [40, 130], [0, 1]);
  const glowLeft = useTransform(x, [-130, -40], [1, 0]);

  const handleDragEnd = useCallback(
    (_e: unknown, info: { offset: { x: number } }) => {
      const ox = info.offset.x;
      if (!flipped || status !== "in-progress") {
        x.set(0);
        return;
      }
      if (ox > 90) known();
      else if (ox < -90) repeat();
      x.set(0);
    },
    [flipped, status, known, repeat, x]
  );

  const swiped = coarse;

  return (
    <div className="flash-player">
      {status === "done" ? (
        <div className="flash-done">
          <div className="flash-done-emoji">🧠</div>
          <h3 className="flash-done-title">Колода пройдена!</h3>
          <p className="flash-done-sub">
            Вы повторили «{deckTitle(deck)}». Готово к зачёту.
          </p>
          <div className="flash-done-stats">
            <span className="flash-stat known">Знаю · {knownCount}</span>
            <span className="flash-stat repeat">Повторить · {repeatCount}</span>
          </div>
          <div className="flash-done-actions">
            <button type="button" className="flash-btn known" onClick={restart}>
              Пройти ещё раз
            </button>
            <button type="button" className="flash-btn" onClick={onExit}>
              Выйти
            </button>
          </div>
        </div>
      ) : cards.length === 0 ? (
        <div className="empty">В этой колоде пока нет карточек.</div>
      ) : (
        <>
          <div className="flash-stats">
            <span className="flash-stat known">Знаю · {knownCount}</span>
            <span className="flash-stat repeat">Повторить · {repeatCount}</span>
            <div className="flash-progress">
              <div
                className="flash-progress-fill"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {current && (
              <motion.div
                key={current.id}
                className="flash-card-stage"
                drag={swiped ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.32}
                onDragStart={() => x.set(0)}
                onDragEnd={handleDragEnd}
                onTap={swiped ? () => flip() : undefined}
                style={swiped ? { x, rotate } : undefined}
                initial={{ opacity: 0, x: swiped ? 320 : 0 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: swiped ? -320 : 0 }}
                transition={{ type: "spring", stiffness: 340, damping: 30 }}
              >
                {swiped && (
                  <>
                    <motion.div
                      className="flash-glow right"
                      style={{ opacity: glowRight }}
                    />
                    <motion.div
                      className="flash-glow left"
                      style={{ opacity: glowLeft }}
                    />
                  </>
                )}
                <div className="flash-3d" style={{ perspective: 1400 }}>
                  <motion.div
                    className={`flash-3d-inner${flipped ? " is-flipped" : ""}`}
                    animate={{ rotateY: flipped ? 180 : 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    <div className="flash-face front">
                      <RichCardFace
                        html={deckCardFront(current)}
                        card={current}
                      />
                    </div>
                    <div className="flash-face back">
                      <RichCardFace
                        html={deckCardBack(current)}
                        card={current}
                      />
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flash-controls">
            {!flipped ? (
              <button type="button" className="flash-reveal" onClick={flip}>
                Показать ответ
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="flash-btn repeat"
                  onClick={repeat}
                  disabled={!flipped}
                >
                  Повторить
                </button>
                <button
                  type="button"
                  className="flash-btn known"
                  onClick={known}
                  disabled={!flipped}
                >
                  Знаю
                </button>
              </>
            )}
          </div>

          <p className="flash-hint">
            {coarse
              ? "Свайп вправо — «Знаю», влево — «Повторить» · тап — перевернуть"
              : "Пробел / Enter — перевернуть · → «Знаю» · ← «Повторить»"}
          </p>
        </>
      )}
    </div>
  );
}
