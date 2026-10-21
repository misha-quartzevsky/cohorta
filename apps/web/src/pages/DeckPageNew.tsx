import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useDeck } from "../hooks/useDecks";
import { deckCardFront, deckSlug, deckTitle } from "../lib/types";
import { extractText } from "../lib/extractText";
import { pluralRu } from "../lib/format";
import { Button, EmptyState, Icon, List } from "../ui";
import CardFormDialog from "../components/forms/CardFormDialog";

/**
 * Страница колоды (Screen-deck, Screen-m-deck). Без плашки «к повторению сегодня /
 * новых / выучено», фильтров и меток у карточек: расписания повторов нет
 * (решение владелицы, B5). «Добавить карточку» открывает окно «Новая карточка»
 * (Screen-forms-create). Правка карточки в макетах не нарисована: строки не открываются.
 */
export default function DeckPageNew() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { deck, cards, loading, error, refetch } = useDeck(slug ?? "");
  const [adding, setAdding] = useState(false);

  if (loading) return null;
  if (!deck) {
    return (
      <div className="c-cards">
        <EmptyState
          icon="cards"
          title="Колода не найдена"
          description={error || "Возможно, её удалили."}
          action={<Button onClick={() => navigate("/decks")}>К карточкам</Button>}
        />
      </div>
    );
  }

  const n = cards.length;
  const word = pluralRu(n, ["карточка", "карточки", "карточек"]);

  return (
    <div className="c-cards">
      <nav className="c-cards-crumb" aria-label="Путь">
        <Link to="/decks">
          <Icon name="chev" size={14} style={{ transform: "rotate(180deg)" }} />
          Карточки
        </Link>
        <Icon name="chev" size={14} className="sep" />
        <span>{deckTitle(deck)}</span>
      </nav>

      <div className="c-cards-head">
        <div className="tx">
          <h1>{deckTitle(deck)}</h1>
          <span>
            Колода · {n} {word}
          </span>
        </div>
        {n > 0 && (
          <Button variant="primary" onClick={() => navigate(`/decks/${deckSlug(deck)}/review`)}>
            Повторить {n} {word}
          </Button>
        )}
      </div>

      <div className="c-cards-bar">
        <Button onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} />
          Добавить карточку
        </Button>
      </div>

      {n === 0 ? (
        <EmptyState icon="cards" title="В колоде нет карточек" description="Добавь первую карточку." />
      ) : (
        <List>
          {cards.map((c) => (
            <div key={c.id} className="c-row c-cards-row static">
              <span className="ic">
                <Icon name="cards" size={20} />
              </span>
              <span className="tx">
                <span className="t">{extractText(deckCardFront(c)).replace(/\s+/g, " ").trim() || "Без текста"}</span>
              </span>
            </div>
          ))}
        </List>
      )}

      <CardFormDialog
        open={adding}
        onClose={() => setAdding(false)}
        deckId={deck.id}
        deckTitle={deckTitle(deck)}
        cardCount={n}
        onSaved={() => void refetch()}
      />
    </div>
  );
}
