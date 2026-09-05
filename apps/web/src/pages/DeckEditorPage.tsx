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
import { GripVertical, Plus, Save, Trash2 } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  persistDeckCardOrder,
  deleteDeckCard,
  uploadDeckCardImages,
  tokenizeDeckCardUrls,
  type UploadedImage,
} from "../services/deckService";
import { useUndo } from "../lib/undoContext";

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

interface SortableCardProps {
  card: CardDraft;
  index: number;
  onRemove: (card: CardDraft) => void;
  onField: (key: string, field: "front" | "back", value: string) => void;
  uploader: (files: File[]) => Promise<UploadedImage[]>;
}

/**
 * One deck card, draggable by its grip only — the body holds two TipTap
 * editors, so the drag listeners must never sit on the whole card.
 */
function SortableCard({
  card,
  index,
  onRemove,
  onField,
  uploader,
}: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.key });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { position: "relative", zIndex: 2 } : null),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`deck-editor-card${isDragging ? " is-dragging" : ""}`}
    >
      <div className="deck-editor-card-head">
        <button
          type="button"
          className="deck-card-drag"
          title="Перетащить карточку"
          aria-label={`Перетащить карточку ${index + 1}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={15} />
        </button>
        <span className="deck-editor-card-num">Карточка {index + 1}</span>
        <button
          type="button"
          className="icon-btn danger"
          title="Удалить карточку"
          aria-label="Удалить карточку"
          onClick={() => onRemove(card)}
        >
          <Trash2 size={15} />
        </button>
      </div>
      <label className="deck-editor-label">Вопрос</label>
      <Editor
        value={card.front}
        onUpdate={(c) => onField(card.key, "front", c)}
        onUploadImages={uploader}
        className="deck-card-editor"
        placeholder="Вопрос…"
      />
      <label className="deck-editor-label">Ответ</label>
      <Editor
        value={card.back}
        onUpdate={(c) => onField(card.key, "back", c)}
        onUploadImages={uploader}
        className="deck-card-editor"
        placeholder="Ответ…"
      />
    </div>
  );
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
  const { scheduleDelete } = useUndo();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COURSE_COLORS[0]);
  const [cards, setCards] = useState<CardDraft[]>([]);

  // Drag-n-drop порядка карточек. Небольшой порог активации, чтобы клик
  // внутри редакторов карточки не превращался в перетаскивание.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const onCardDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setCards((prev) => {
      const from = prev.findIndex((c) => c.key === active.id);
      const to = prev.findIndex((c) => c.key === over.id);
      if (from < 0 || to < 0) return prev;
      return arrayMove(prev, from, to);
    });
  }, []);

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
      const index = cards.findIndex((c) => c.key === card.key);
      setCards((prev) => prev.filter((c) => c.key !== card.key));

      if (!card.id) return; // черновик без сервер-записи — удалять нечего
      const cardId = card.id;
      scheduleDelete(
        `deckcard:${cardId}`,
        "Карточка удалена",
        () => deleteDeckCard(cardId),
        // «Отменить»: карточка ещё не удалена на сервере — просто
        // возвращаем её в тот же индекс локального черновика.
        () => {
          setCards((prev) => {
            const at = Math.min(index, prev.length);
            return [...prev.slice(0, at), card, ...prev.slice(at)];
          });
        }
      );
    },
    [cards, scheduleDelete]
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
      const orderedIds: string[] = [];
      for (let i = 0; i < cards.length; i += 1) {
        const card = cards[i];
        let target = card.id ? await getDeckCard(card.id) : null;
        if (!target) {
          target = await createDeckCard(deckId, card.front, card.back);
        }
        const front = tokenizeDeckCardUrls(card.front, target);
        const back = tokenizeDeckCardUrls(card.back, target);
        await updateDeckCard(target.id, front, back);
        orderedIds.push(target.id);
      }

      // Индекс карточки в списке = её `position` (ручной порядок drag-n-drop).
      await persistDeckCardOrder(orderedIds);

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
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onCardDragEnd}
            >
              <SortableContext
                items={cards.map((c) => c.key)}
                strategy={verticalListSortingStrategy}
              >
                {cards.map((card, i) => (
                  <SortableCard
                    key={card.key}
                    card={card}
                    index={i}
                    onRemove={removeCard}
                    onField={setCardField}
                    uploader={buildUploader(card)}
                  />
                ))}
              </SortableContext>
            </DndContext>

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
