/**
 * ============================================
 *  CardStudyPage.tsx — study a single deck
 * ============================================
 *
 * Route /decks/:slug. Loads the deck + its cards and runs the adaptive
 * FlashcardPlayer inside a glass card.
 */

import { useNavigate, useParams } from "react-router-dom";

import { useDeck } from "../hooks/useDecks";
import { deckSlug, deckTitle } from "../lib/types";
import { lastSemesterSlug } from "../lib/lastSemester";

import Header from "../components/Header";
import ErrorBanner from "../components/ErrorBanner";
import CardSkeleton from "../components/CardSkeleton";
import FlashcardPlayer from "../components/cards/FlashcardPlayer";

function CardStudyPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { deck, cards, loading, error } = useDeck(slug ?? "");

  const semSlug = lastSemesterSlug();

  if (loading) {
    return (
      <>
        <Header crumbs={[{ label: "Карточки", to: "/decks" }, { label: "…" }]} crumbsLoading />
        <div className="page">
          <div className="content-canvas">
            <CardSkeleton />
          </div>
        </div>
      </>
    );
  }

  if (!deck) {
    return (
      <>
        <Header crumbs={[{ label: "Карточки", to: "/decks" }, { label: "Колода" }]} />
        <div className="page">
          <div className="content-canvas">
            <ErrorBanner message={error || "Колода не найдена."} />
            <div className="empty">Колода не найдена.</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        crumbs={[
          { label: "Рабочий стол", to: `/s/${semSlug}` },
          { label: "Карточки", to: "/decks" },
          { label: deckTitle(deck) },
        ]}
      />
      <div className="page">
        <div className="content-canvas flash-study">
          <div className="flash-study-head">
            <h1 className="page-title">{deckTitle(deck)}</h1>
            <span className="flash-count">
              {cards.length} карточек
            </span>
            <button
              type="button"
              className="flash-exit"
              onClick={() => navigate(`/decks/${deckSlug(deck)}/edit`)}
            >
              Редактировать
            </button>
          </div>
          <ErrorBanner message={error} />
          <FlashcardPlayer
            deck={deck}
            cards={cards}
            onExit={() => navigate("/decks")}
          />
        </div>
      </div>
    </>
  );
}

export default CardStudyPage;
