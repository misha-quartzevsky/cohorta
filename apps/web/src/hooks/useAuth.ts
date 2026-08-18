/**
 * ============================================
 *  useAuth.ts — Auth Hook
 * ============================================
 *
 * React hook mirroring the PocketBase auth state:
 * the current user model, the validity flag and
 * `login`/`logout` helpers.  Subscribes to
 * `pb.authStore.onChange` so components re-render
 * automatically on sign-in / sign-out.
 */

import { useCallback, useEffect, useState } from "react";

import { pb } from "../lib/pocketbase";
import type { User } from "../lib/types";

export interface UseAuthResult {
  /** The authenticated user record (null when signed out). */
  user: User | null;
  /** Whether a valid auth token is currently stored. */
  isValid: boolean;
  /** Authenticate with email + password via the `users` collection. */
  login: (email: string, password: string) => Promise<void>;
  /** Sign out and clear the stored token. */
  logout: () => void;
}

/**
 * Keeps the React user state in sync with `pb.authStore`.
 * Returns helpers that never leak the PocketBase client
 * into view components.
 */
export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<User | null>(
    () => (pb.authStore.model as unknown as User | null) ?? null
  );

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange((_token, model) => {
      setUser(model ? (model as unknown as User) : null);
    });
    return unsubscribe;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await pb.collection("users").authWithPassword(email, password);
  }, []);

  const logout = useCallback(() => {
    pb.authStore.clear();
  }, []);

  return { user, isValid: pb.authStore.isValid, login, logout };
}