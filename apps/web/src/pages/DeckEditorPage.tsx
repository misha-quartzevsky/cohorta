/**
 * ============================================
 *  DeckEditorPage.tsx — create/edit a deck with cards
 * ============================================
 *
 * Routes:
 *   /decks/new                — create mode
 *   /decks/:slug/edit         — edit mode
 *
 * Each card has two full TipTap editors (front/back) with image attachment
 * support. Images uploaded into a card live in the card's `attachments` file
 * field (portable `[[file:name]]` tokens are stored in the rich HTML). New
 * cards are created lazily on first image upload, so the uploader always has
 * a real record to attach files to.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Save, Trash2 } from "lucide-react";

import { useDeck } from "../hooks/useDecks";
import {
  deckSlug,
  deckTitle,
  type Deck,
} from "../lib/types";
import { lastSemesterSlug } from "../lib/lastSemester";
import { COURSE_COLORS } from "../lib/colors";
import { errorMessage } from "../lib/format";
import {
  getDeckCard,
  createDeck,
  updateDeck,
  createDeckCard,
  updateDeckCard,
  deleteDeckCard,
  uploadDeckCardImages,
  tokenizeDeckCardUrls,
  type UploadedImage,
} from "../services/deckService";

import Header from "../components/Header";
import ErrorBanner from "../components/ErrorBanner";
import CardSkeleton from "../components/CardSkeleton";
import Editor from "../components/Editor";

interface CardDraft {
  key: string;
  id?: string;
  front: string;
  back: string;
}

let cardKeySeq = 0;
function newCardKey(): string {
  cardKeySeq += 1;
  return `card-${Date.now()}-${cardKeySeq}`;
}

function DeckEditorPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const semSlug = lastSemesterSlug();
  const isCreate = !slug;

  const { deck, cards: loadedCards, loading, error, setError } = useDeck(
    isCreate ? "" : (slug ?? ""),
    !isCreate
  );
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COURSE_COLORS[0]);
  const [cards, setCards] = useState<CardDraft[]>([]);

  const existingDeck = useRef<Deck | null>(null);

  // Заполняем форму из загруженной колоды (edit mode).
  useEffect(() => {
    if (!deck) return;
    existingDeck.current = deck;
    setTitle(deckTitle(deck));
    setDescription(String(deck.description ?? ""));
    if (deck.color) setColor(deck.color);
    setCards(
      loadedCards.map((c) => ({
        key: newCardKey(),
        id: c.id,
        front: String(c.front ?? ""),
        back: String(c.back ?? ""),
      }))
    );
  }, [deck, loadedCards]);

  // --- card state helpers ---
  const setCardField = useCallback(
    (key: string, field: "front" | "back", value: string) => {
      setCards((prev) =>
        prev.map((c) => (c.key === key ? { ...c, [field]: value } : c))
      );
    },
    []
  );

  const setCardId = useCallback((key: string, id: string) => {
    setCards((prev) => prev.map((c) => (c.key === key ? { ...c, id } : c)));
  }, []);

  const addCard = useCallback(() => {
    setCards((prev) => [...prev, { key: newCardKey(), front: "", back: "" }]);
  }, []);

  const removeCard = useCallback(
    (card: CardDraft) => {
      if (card.id) void deleteDeckCard(card.id);
      setCards((prev) => prev.filter((c) => c.key !== card.key));
    },
    []
  );

  /**
   * Image-uploader bound to a single card. New (unsaved) cards are created in
   * PocketBase on first upload so the file field has a real record to attach
   * to. Returns UploadedImage[] (name + absolute URL) for the editor.
   */
  const buildUploader = useCallback(
    (card: CardDraft) => {
      return async (files: File[]): Promise<UploadedImage[]> => {
        const deckId = existingDeck.current?.id;
        if (!deckId) throw new Error("Сначала сохраните колоду.");
        if (!card.id) {
          const created = await createDeckCard(deckId, card.front, card.back);
          setCardId(card.key, created.id);
          return uploadDeckCardImages(created, files);
        }
        const fresh = await getDeckCard(card.id);
        return uploadDeckCardImages(fresh, files);
      };
    },
    [setCardId]
  );

  const save = useCallback(async () => {
    if (!title.trim()) {
      setError("Введите название колоды.");
      return;
    }
    setSaving(true);
    try {
      let deckRecord = existingDeck.current;
      const payload = { title: title.trim(), description, color };
      if (deckRecord) {
        deckRecord = await updateDeck(deckRecord, payload);
      } else {
        deckRecord = await createDeck(payload);
      }
      existingDeck.current = deckRecord;
      const deckId = deckRecord.id;

      // Сохраняем каждую карточку (новички создаются, существующие обновляются);
      // картинки токенизируем в портативные [[file:…]] по записи карточки.
      for (const card of cards) {
        let target = card.id ? await getDeckCard(card.id) : null;
        if (!target) {
          target = await createDeckCard(deckId, card.front, card.back);
        }
        const front = tokenizeDeckCardUrls(card.front, target);
        const back = tokenizeDeckCardUrls(card.back, target);
        if (target) {
          await updateDeckCard(target.id, front, back);
        }
      }

      navigate(`/decks/${deckSlug(deckRecord)}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }, [title, description, color, cards, setError, navigate]);

  const crumbTitle = useMemo(() => {
    if (isCreate) return "Новая колода";
    return title.trim() || "Колода";
  }, [isCreate, title]);

  if (!isCreate && loading) {
    return (
      <>
        <Header
          crumbs={[
            { label: "Рабочий стол", to: `/s/${semSlug}` },
            { label: "Карточки", to: "/decks" },
            { label: "…" },
          ]}
          crumbsLoading
        />
        <div className="page">
          <div className="content-canvas">
            <CardSkeleton />
          </div>
        </div>
      </>
    );
  }

  if (!isCreate && !deck) {
    return (
      <>
        <Header
          crumbs={[
            { label: "Рабочий стол", to: `/s/${semSlug}` },
            { label: "Карточки", to: "/decks" },
            { label: "Колода" },
          ]}
        />
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
          { label: crumbTitle },
        ]}
      />
      <div className="page">
        <div className="content-canvas deck-editor-canvas">
          <ErrorBanner message={error} />

          <div className="deck-editor-meta">
            <input
              className="deck-editor-title"
              type="text"
              placeholder="Название колоды"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="deck-editor-desc"
              placeholder="Описание (зачем эта колода)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
            <div className="deck-editor-colors">
              {COURSE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`deck-color-swatch${color === c ? " active" : ""}`}
                  style={{ background: c }}
                  aria-label={`Цвет ${c}`}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="deck-editor-cards">
            {cards.map((card, i) => (
              <div className="deck-editor-card" key={card.key}>
                <div className="deck-editor-card-head">
                  <span className="deck-editor-card-num">Карточка {i + 1}</span>
                  <button
                    type="button"
                    className="icon-btn danger"
                    title="Удалить карточку"
                    onClick={() => removeCard(card)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <label className="deck-editor-label">Вопрос</label>
                <Editor
                  value={card.front}
                  onUpdate={(c) => setCardField(card.key, "front", c)}
                  onUploadImages={buildUploader(card)}
                  className="deck-card-editor"
                  placeholder="Вопрос…"
                />
                <label className="deck-editor-label">Ответ</label>
                <Editor
                  value={card.back}
                  onUpdate={(c) => setCardField(card.key, "back", c)}
                  onUploadImages={buildUploader(card)}
                  className="deck-card-editor"
                  placeholder="Ответ…"
                />
              </div>
            ))}

            <button type="button" className="deck-editor-add" onClick={addCard}>
              <Plus size={16} /> Добавить карточку
            </button>
          </div>

          <div className="deck-editor-actions">
            <button
              type="button"
              className="deck-editor-save"
              onClick={() => void save()}
              disabled={saving}
            >
              <Save size={16} /> {saving ? "Сохраняем…" : "Сохранить колоду"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default DeckEditorPage;
