import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDeck } from "../hooks/useDecks";
import { fetchAllCards } from "../services/deckService";
import { deckCardBack, deckCardFront, deckTitle, type DeckCard } from "../lib/types";
import { RATINGS, rate, startQueue, type QueueState, type Rating } from "../lib/cardQueue";
import { Button, EmptyState, Icon } from "../ui";
import RichCardFace from "../components/cards/RichCardFace";

/**
 * Повторение карточек (Screen-cards-review). Логика очереди прежняя (lib/cardQueue.ts):
 * четыре кнопки, но без интервалов под ними — расписания повторов нет (решение
 * владелицы, B5). Маршруты: `/decks/:slug/review` — одна колода, `/cards/review` — все.
 * Телефонного макета нет: тот же экран одной колонкой. Экран «колода пройдена» не нарисован.
 */
export default function CardReviewPage() {
  const { slug } = useParams<{ slug?: string }>();
  const single = useDeck(slug ?? "", !!slug);
  const [all, setAll] = useState<DeckCard[] | null>(null);

  useEffect(() => {
    if (slug) return;
    let cancelled = false;
    fetchAllCards()
      .then((c) => !cancelled && setAll(c))
      .catch(() => !cancelled && setAll([]));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const cards = slug ? single.cards : all;
  const loading = slug ? single.loading : all === null;
  if (loading || cards === null) return null;

  return <Review cards={cards} title={slug && single.deck ? deckTitle(single.deck) : ""} />;
}

function Review({ cards, title }: { cards: DeckCard[]; title: string }) {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<QueueState<DeckCard>>(() => startQueue(cards));
  const [shown, setShown] = useState(false);
  const total = cards.length;
  const current = queue.order[queue.pos];

  const finish = useCallback(() => navigate("/decks"), [navigate]);
  const give = useCallback((r: Rating) => {
    setQueue((q) => rate(q, r));
    setShown(false);
  }, []);

  useEffect(() => {
    if (queue.done) return;
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement | null)?.closest("input, textarea")) return;
      if (e.key === " " && !shown) {
        e.preventDefault();
        setShown(true);
      } else if (shown && e.key >= "1" && e.key <= "4") {
        give(RATINGS[Number(e.key) - 1].value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [queue.done, shown, give]);

  const progress = useMemo(() => (total ? Math.min(queue.known, total) / total : 0), [queue.known, total]);

  if (total === 0) {
    return (
      <div className="c-cards">
        <EmptyState
          icon="cards"
          title="Нет карточек для повторения"
          description="Добавь карточки в колоду."
          action={<Button onClick={finish}>К карточкам</Button>}
        />
      </div>
    );
  }

  if (queue.done) {
    return (
      <div className="c-review">
        <div className="c-review-col">
          <div className="c-review-card done">
            <h1>Повторение закончено</h1>
            <p>
              Отмечено «Хорошо» или «Легко»: {queue.known}. «Снова» или «Трудно»: {queue.repeated}.
            </p>
          </div>
          <div className="c-review-end">
            <Button variant="primary" onClick={finish}>
              Закончить
            </Button>
            <Button
              onClick={() => {
                setQueue(startQueue(cards));
                setShown(false);
              }}
            >
              Повторить ещё раз
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="c-review">
      <div className="c-review-col">
        <div className="c-review-bar">
          <button type="button" className="c-review-exit" onClick={finish}>
            <Icon name="x" size={16} />
            Закончить
          </button>
          <div className="c-review-track" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={queue.known}>
            <div style={{ width: `${progress * 100}%` }} />
          </div>
          <span className="c-review-count">
            {queue.known} из {total}
          </span>
        </div>

        <div className="c-review-card">
          <div className="top">{title ? <span className="c-chip">{title}</span> : <span />}</div>
          <div className="q">
            <RichCardFace html={deckCardFront(current)} card={current} />
          </div>
          {shown ? (
            <div className="a">
              <RichCardFace html={deckCardBack(current)} card={current} />
            </div>
          ) : (
            <span className="hint">Подумай, потом нажми «Показать ответ»</span>
          )}
        </div>

        {!shown && (
          <div className="c-review-show">
            <Button variant="primary" size="lg" onClick={() => setShown(true)}>
              Показать ответ
            </Button>
          </div>
        )}

        <div className={`c-review-rate${shown ? "" : " off"}`}>
          {RATINGS.map((r) => (
            <button key={r.value} type="button" className={r.value} disabled={!shown} onClick={() => give(r.value)}>
              {r.label}
            </button>
          ))}
        </div>
        <span className="c-review-hint">Оценки появятся после ответа. Горячие клавиши: пробел, 1–4.</span>
      </div>
    </div>
  );
}
