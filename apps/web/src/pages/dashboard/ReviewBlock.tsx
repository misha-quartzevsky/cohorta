/**
 * ============================================
 *  ReviewBlock.tsx — колоды карточек
 * ============================================
 *  Служит ключевому сценарию продукта «конспект → карточки → билет»
 *  (DESIGN.md §7.5). Блок называется «Колоды», а не «К повторению»:
 *  расписания повторений в модели пока нет, и заголовок не должен
 *  обещать того, чего продукт не делает.
 */

import { Link } from "react-router-dom";
import { ArrowRight, Layers } from "lucide-react";
import type { Deck } from "../../lib/types";
import { deckTitle, deckSlug } from "../../lib/types";

interface Props {
  decks: Deck[];
}

export default function ReviewBlock({ decks }: Props) {
  return (
    <div className="widget review-widget">
      <div className="widget-head">
        <h3 className="widget-title">Колоды</h3>
        {decks.length > 0 && (
          <Link to="/decks" className="widget-link">
            Все колоды
            <ArrowRight size={14} />
          </Link>
        )}
      </div>
      {decks.length === 0 ? (
        <p className="widget-empty">
          Собери первую колоду — по ней удобно готовиться к зачёту.
        </p>
      ) : (
        <div className="review-list">
          {decks.map((deck) => (
            <Link
              key={deck.id}
              to={"/decks/" + deckSlug(deck)}
              className="review-item"
            >
              <span className="review-item-icon">
                <Layers size={16} />
              </span>
              <span className="review-item-body">
                <span className="review-item-title">{deckTitle(deck)}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
