/**
 * ============================================
 *  deckService.ts — Deck / DeckCard API Service Layer
 * ============================================
 *
 * Centralizes all PocketBase calls for the `decks` and `deck_cards`
 * collections (the flashcards module).
 */

import { pb } from "../lib/pocketbase";
import type { Deck, DeckCard } from "../lib/types";
import {
  FIELDS,
  deckCardAttachmentNames,
} from "../lib/types";
import { slugify } from "../lib/slugify";
import { uniqueSlugForCollection, fetchBySlug } from "./genericService";

/** Id текущего пользователя ("" — не залогинен). */
function currentUserId(): string {
  return String(pb.authStore.record?.id ?? "");
}

/** Fetch all decks, most-recently-updated first. */
export async function fetchDecks(limit: number = 0): Promise<Deck[]> {
  const items = await pb.collection("decks").getFullList<Deck>({
    sort: "-updated",
  });
  return limit > 0 ? items.slice(0, limit) : items;
}

/** Fetch a single deck by its URL slug (falls back to id for legacy rows). */
export async function fetchDeck(slug: string): Promise<Deck> {
  return fetchBySlug<Deck>("decks", slug, FIELDS.deckSlug);
}

/** Fetch a single card by its PocketBase id. */
export async function getDeckCard(cardId: string): Promise<DeckCard> {
  return pb.collection("deck_cards").getOne<DeckCard>(cardId);
}

/**
 * Fetch the cards of one deck in the user's manual order (`position`), with
 * `created` as the tie-breaker for legacy rows that never got a position.
 *
 * Falls back to plain `created` order if the backend hasn't picked up the
 * `position` column yet (migration applied but the `serve` process not
 * restarted) — the client stays usable through the rollout.
 */
export async function fetchDeckCards(deckId: string): Promise<DeckCard[]> {
  const filter = `${FIELDS.deckCardDeck}="${deckId}"`;
  try {
    return await pb.collection("deck_cards").getFullList<DeckCard>({
      filter,
      sort: `${FIELDS.deckCardPosition},created`,
    });
  } catch {
    return pb
      .collection("deck_cards")
      .getFullList<DeckCard>({ filter, sort: "created" });
  }
}

/** Fetch all cards across decks (used to count cards per deck in the library). */
export async function fetchAllCards(): Promise<DeckCard[]> {
  return pb.collection("deck_cards").getFullList<DeckCard>();
}

export interface DeckPayload {
  title: string;
  description?: string;
  color?: string;
  is_public?: boolean;
}

/** Create a brand-new deck with an auto-generated unique slug. */
export async function createDeck(payload: DeckPayload): Promise<Deck> {
  return pb.collection("decks").create<Deck>({
    [FIELDS.deckTitle]: payload.title,
    [FIELDS.deckDescription]: payload.description ?? "",
    [FIELDS.deckColor]: payload.color ?? "",
    [FIELDS.deckIsPublic]: payload.is_public ?? false,
    [FIELDS.deckOwner]: currentUserId(),
    [FIELDS.deckSlug]: await uniqueSlugForCollection(
      "decks",
      FIELDS.deckSlug,
      slugify(payload.title) || "deck"
    ),
  });
}

/** Update deck metadata. */
export async function updateDeck(
  deck: Deck,
  payload: DeckPayload
): Promise<Deck> {
  const data: Record<string, unknown> = {
    [FIELDS.deckTitle]: payload.title,
    [FIELDS.deckDescription]: payload.description ?? "",
    [FIELDS.deckColor]: payload.color ?? "",
    [FIELDS.deckIsPublic]: payload.is_public ?? false,
  };
  if (!deck.owner && currentUserId()) {
    data[FIELDS.deckOwner] = currentUserId();
  }
  return pb.collection("decks").update<Deck>(deck.id, data);
}

/** Delete a deck (deck_cards cascade via the relation). */
export async function deleteDeck(deckId: string): Promise<void> {
  await pb.collection("decks").delete(deckId);
}

/**
 * Create a single card inside a deck. Order (`position`) is written separately
 * by `persistDeckCardOrder` so this call works on a backend that hasn't picked
 * up the `position` column yet.
 */
export async function createDeckCard(
  deckId: string,
  front: string,
  back: string
): Promise<DeckCard> {
  return pb.collection("deck_cards").create<DeckCard>({
    [FIELDS.deckCardDeck]: deckId,
    [FIELDS.deckCardFront]: front,
    [FIELDS.deckCardBack]: back,
  });
}

/** Update a card's rich front/back. */
export async function updateDeckCard(
  cardId: string,
  front: string,
  back: string
): Promise<DeckCard> {
  return pb.collection("deck_cards").update<DeckCard>(cardId, {
    [FIELDS.deckCardFront]: front,
    [FIELDS.deckCardBack]: back,
  });
}

/**
 * Persist the manual card order (drag-n-drop): writes each id's array index
 * into `position`. Best-effort — if the backend hasn't got the column yet the
 * whole call is a no-op so it never blocks a content save.
 */
export async function persistDeckCardOrder(orderedIds: string[]): Promise<void> {
  try {
    await Promise.all(
      orderedIds.map((id, i) =>
        pb
          .collection("deck_cards")
          .update(id, { [FIELDS.deckCardPosition]: i })
      )
    );
  } catch (e) {
    console.warn("Не удалось сохранить порядок карточек:", e);
  }
}

/** Delete a single card (e.g. removed while editing a deck). */
export async function deleteDeckCard(cardId: string): Promise<void> {
  await pb.collection("deck_cards").delete(cardId);
}

// ---------------------------------------------------------------------------
// Attachments (images) — portable `[[file:name]]` tokens, mirroring the
// lecture image pipeline. Files live in the card's `attachments` field.
// ---------------------------------------------------------------------------

const IMG_TOKEN_RE = /\[\[file:([^\]]+)\]\]/g;

/**
 * Resolve `[[file:name]]` tokens in rich front/back HTML to absolute URLs.
 */
export function resolveDeckCardTokens(html: string, card: DeckCard): string {
  return html.replace(IMG_TOKEN_RE, (_m, name: string) =>
    pb.files.getURL(card, name)
  );
}

/**
 * Embed "bare" PocketBase file URLs written as plain text (e.g. a user pasted
 * `Рисунок:\nhttp://127.0.0.1:8090/api/files/<col>/<id>/<name>` as a text
 * paragraph) into real `<img>` elements so the picture actually shows.
 * URLs that already live inside `src`/`href` attributes are left untouched
 * (they're preceded by a quote/`=` and the negative lookbehind skips them).
 */
export function embedCardBareFileUrls(html: string): string {
  const fileUrl = String.raw`(?:https?:\/\/[^\s'"<>]*)?\/api\/files\/[A-Za-z0-9_]+\/[A-Za-z0-9]+\/[^\s'"<>]+`;
  const re = new RegExp(`(?<![A-Za-z0-9_'"=])(${fileUrl})`, "g");
  return html.replace(re, (_m, url: string) => {
    const escaped = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    return `<img src="${escaped}" alt="" class="card-inline-img" />`;
  });
}

/**
 * Reverse: replace `src` attributes pointing to the card's own PB files back
 * into portable `[[file:name]]` tokens (so the DB stores names, not hosts).
 */
export function tokenizeDeckCardUrls(html: string, card: DeckCard): string {
  const collectionId = String(card.collectionId ?? "deck_cards");
  const escapedId = card.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `(src=["'][^"']*/api/files/(?:${collectionId}|deck_cards)/${escapedId}/)([^/?"']+)([^"']*)(["'])`,
    "g"
  );
  return html.replace(
    re,
    (_m, _prefix: string, name: string, _rest: string, quote: string) => {
      let decoded = name;
      try {
        decoded = decodeURIComponent(name);
      } catch {
        /* keep as is */
      }
      return `src=${quote}[[file:${decoded}]]${quote}`;
    }
  );
}

/** Result of an image upload: a stable file name + absolute URL. */
export interface UploadedImage {
  name: string;
  url: string;
}

/** Upload images into a card's `attachments` field. */
export async function uploadDeckCardImages(
  card: DeckCard,
  files: File[]
): Promise<UploadedImage[]> {
  if (!files.length) return [];
  const fresh = await pb
    .collection("deck_cards")
    .getOne<DeckCard>(card.id);
  const existing = deckCardAttachmentNames(fresh);
  const updated = await pb.collection("deck_cards").update<DeckCard>(
    fresh.id,
    { [FIELDS.deckCardAttachments]: [...existing, ...files] }
  );
  const next = deckCardAttachmentNames(updated);
  const previous = new Set(existing);
  return next
    .filter((name) => !previous.has(name))
    .map((name) => ({
      name,
      url: pb.files.getURL(updated, name),
    }));
}
