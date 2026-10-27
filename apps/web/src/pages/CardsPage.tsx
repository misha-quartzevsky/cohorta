import { useEffect, useMemo, useState } from "react";
import { useForms } from "../lib/formsContext";
import { useNavigate } from "react-router-dom";
import { useDecks } from "../hooks/useDecks";
import { fetchAllCards } from "../services/deckService";
import { deckCardDeckId, deckSlug, deckTitle } from "../lib/types";
import { pluralRu } from "../lib/format";
import { Button, EmptyState, Icon, List } from "../ui";

/**
 * «Карточки» — список колод (Screen-cards, Screen-m-cards). Только оболочка:
 * расписания повторов в базе нет, поэтому нет счётчиков «к повторению сегодня»,
 * меток «Сегодня 6», «Новые 8» и вкладки «Расписание повторов» (решение владелицы, B5).
 * «Новая колода» ведёт в существующий редактор колоды (формы в макетах нет).
 */
export default function CardsPage() {
  const navigate = useNavigate();
  const forms = useForms();
  const { decks, loading, error } = useDecks();
  const [counts, setCounts] = useState<Map<string, number> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAllCards()
      .then((cards) => {
        if (cancelled) return;
        const m = new Map<string, number>();
        for (const c of cards) m.set(deckCardDeckId(c), (m.get(deckCardDeckId(c)) ?? 0) + 1);
        setCounts(m);
      })
      .catch(() => !cancelled && setCounts(new Map()));
    return () => {
      cancelled = true;
    };
  }, []);

  const total = useMemo(() => Array.from(counts?.values() ?? []).reduce((a, b) => a + b, 0), [counts]);

  if (loading || counts === null) return null;

  const cardsWord = (n: number) => pluralRu(n, ["карточка", "карточки", "карточек"]);

  return (
    <div className="c-cards">
      <div className="c-cards-head">
        <div className="tx">
          <h1>Карточки</h1>
          <span>
            {decks.length} {pluralRu(decks.length, ["колода", "колоды", "колод"])} · {total} {cardsWord(total)}
          </span>
        </div>
        {total > 0 && (
          <Button variant="primary" onClick={() => navigate("/cards/review")}>
            Повторить {total} {cardsWord(total)}
          </Button>
        )}
      </div>

      <div className="c-cards-bar">
        <Button onClick={() => (forms ? forms.openDeckForm() : navigate("/decks/new"))}>
          <Icon name="plus" size={16} />
          Новая колода
        </Button>
      </div>

      {error && <p className="c-cards-error">Не удалось загрузить колоды. Обнови страницу.</p>}

      {decks.length === 0 ? (
        <EmptyState
          icon="cards"
          title="Колод пока нет"
          description="Создай колоду, и карточки появятся здесь."
        />
      ) : (
        <List>
          {decks.map((d) => {
            const n = counts.get(d.id) ?? 0;
            return (
              <button
                key={d.id}
                type="button"
                className="c-row c-cards-row"
                onClick={() => navigate(`/decks/${deckSlug(d)}`)}
              >
                <span className="ic">
                  <Icon name="cards" size={20} />
                </span>
                <span className="tx">
                  <span className="t">{deckTitle(d)}</span>
                  <span className="m">
                    {n} {cardsWord(n)}
                  </span>
                </span>
                <Icon name="chev" size={18} className="chev" />
              </button>
            );
          })}
        </List>
      )}
    </div>
  );
}
