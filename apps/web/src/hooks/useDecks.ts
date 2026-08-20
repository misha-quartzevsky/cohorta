/**
 * ============================================
 *  useDecks.ts — Deck / DeckCard Hooks
 * ============================================
 */

import { useCallback } from "react";
import type { Deck, DeckCard } from "../lib/types";
import {
  fetchDecks,
  fetchDeck,
  fetchDeckCards,
} from "../services/deckService";
import { useAsyncData } from "./useAsyncData";

export interface UseDecksResult {
  decks: Deck[];
  loading: boolean;
  error: string;
  refetch: () => Promise<void>;
}

/** Fetch the N most-recent decks (N=0 → all). */
export function useDecks(limit: number = 0): UseDecksResult {
  const fetcher = useCallback(() => fetchDecks(limit), [limit]);
  const { data, loading, error, refetch } = useAsyncData<Deck[]>(fetcher);
  return { decks: data ?? [], loading, error, refetch };
}

export interface UseDeckResult {
  deck: Deck | null;
  cards: DeckCard[];
  loading: boolean;
  error: string;
  setError: (message: string) => void;
  refetch: () => Promise<void>;
}

/** Fetch a single deck (by slug) plus its cards. */
export function useDeck(slug: string, enabled: boolean = true): UseDeckResult {
  const fetcher = useCallback(async (): Promise<{
    deck: Deck;
    cards: DeckCard[];
  }> => {
    const deck = await fetchDeck(slug);
    const cards = await fetchDeckCards(deck.id);
    return { deck, cards };
  }, [slug]);

  const { data, loading, error, setError, refetch } = useAsyncData(
    fetcher,
    enabled
  );

  return {
    deck: data?.deck ?? null,
    cards: data?.cards ?? [],
    loading,
    error,
    setError,
    refetch,
  };
}
