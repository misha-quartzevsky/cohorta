/**
 * ============================================
 *  CardLibraryPage.tsx — all decks (flashcards)
 * ============================================
 *
 * Route /decks. Lists every deck as a Light-Craft tile with its card count,
 * plus an «Новая колода» tile that creates a deck.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layers, Pencil, Trash2 } from "lucide-react";

import { useDecks } from "../hooks/useDecks";
import { useConfirmDialog } from "../hooks/useConfirmDialog";
import { useUndo } from "../lib/undoContext";
import {
  deckColor,
  deckDescription,
  deckSlug,
  deckTitle,
  type Deck,
} from "../lib/types";
import { lastSemesterSlug } from "../lib/lastSemester";
import { pluralRu } from "../lib/format";
import { fetchAllCards, deleteDeck } from "../services/deckService";

import Header from "../components/Header";
import ErrorBanner from "../components/ErrorBanner";
import LoadingState from "../components/LoadingState";
import ConfirmDialog from "../components/ConfirmDialog";

/** Лёгкая плитка колоды в стиле Light Craft. */
function DeckTile({
  deck,
  count,
  index,
  onOpen,
  onEdit,
  onDelete,
}: {
  deck: Deck;
  count: number;
  index: number;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const color = deckColor(deck) || "#9C8FE2";
  const accents = ["lilac", "ginger", "black"] as const;
  const accent = accents[index % 3];

  return (
    <div className={`tile deck-tile ${accent}`}>
      <button className="tile-click" onClick={onOpen} type="button">
        <div className="deck-tile-icon" style={{ background: color + "22", color }}>
          <Layers size={22} />
        </div>
        <div className="deck-tile-body">
          <div className="deck-tile-title">{deckTitle(deck)}</div>
          {deckDescription(deck) && (
            <div className="deck-tile-desc">{deckDescription(deck)}</div>
          )}
          <span className="deck-tile-count">
            {count} {pluralRu(count, ["карточка", "карточки", "карточек"])}
          </span>
        </div>
      </button>
      <div className="deck-tile-actions">
        <button
          type="button"
          className="icon-btn"
          title="Редактировать"
          aria-label="Редактировать"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <Pencil size={15} />
        </button>
        <button
          type="button"
          className="icon-btn danger"
          title="Удалить"
          aria-label="Удалить"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

function CardLibraryPage() {
  const navigate = useNavigate();
  const { decks, loading, error, refetch } = useDecks();
  const semSlug = lastSemesterSlug();

  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    void fetchAllCards().then((cards) => {
      const map: Record<string, number> = {};
      for (const c of cards) {
        const d = c.deck;
        if (d) map[d] = (map[d] ?? 0) + 1;
      }
      setCounts(map);
    });
  }, [decks]);

  const confirm = useConfirmDialog();
  const { scheduleDelete, isPending } = useUndo();
  const visibleDecks = decks.filter((d) => !isPending(`deck:${d.id}`));

  const actions = useMemo(() => {
    return {
      open: (d: Deck) => navigate(`/decks/${deckSlug(d)}`),
      edit: (d: Deck) => navigate(`/decks/${deckSlug(d)}/edit`),
      del: (d: Deck) =>
        confirm.ask(
          "Удалить колоду?",
          `Колода «${deckTitle(d)}» и все её карточки будут удалены.`,
          () => {
            scheduleDelete(
              `deck:${d.id}`,
              `Колода «${deckTitle(d)}» удалена`,
              () => deleteDeck(d.id).then(() => refetch())
            );
          }
        ),
    };
  }, [navigate, confirm, refetch, scheduleDelete]);

  if (loading && decks.length === 0) {
    return (
      <>
        <Header crumbs={[{ label: "Рабочий стол", to: `/s/${semSlug}` }, { label: "Карточки" }]} />
        <div className="page">
          <LoadingState />
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        crumbs={[
          { label: "Рабочий стол", to: `/s/${semSlug}` },
          { label: "Карточки" },
        ]}
      />
      <div className="page">
        <div className="content-canvas">
          <ErrorBanner message={error} />

          <h1 className="page-title">Карточки</h1>
          <p className="page-subtitle">
            Колоды для повторения перед зачётом — 20 минут в метро, и всё
            свежо.
          </p>

          {visibleDecks.length === 0 ? (
            <div className="empty">Пока нет колод — создайте первую!</div>
          ) : null}

          <div className="bento">
            <button
              type="button"
              className="add-tile"
              onClick={() => navigate("/decks/new")}
            >
              + Новая колода
            </button>

            {visibleDecks.map((deck, i) => (
              <DeckTile
                key={deck.id}
                deck={deck}
                count={counts[deck.id] ?? 0}
                index={i}
                onOpen={() => actions.open(deck)}
                onEdit={() => actions.edit(deck)}
                onDelete={() => actions.del(deck)}
              />
            ))}
          </div>

          <ConfirmDialog
            open={confirm.open}
            title={confirm.title}
            message={confirm.message}
            onConfirm={confirm.confirm}
            onCancel={confirm.cancel}
          />
        </div>
      </div>
    </>
  );
}

export default CardLibraryPage;
