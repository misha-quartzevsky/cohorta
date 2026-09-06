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
import { withTimeout } from "../lib/withTimeout";

export interface UseAuthResult {
  /** The authenticated user record (null when signed out). */
  user: User | null;
  /** Whether a valid auth token is currently stored. */
  isValid: boolean;
  /** Authenticate with email + password via the `users` collection. */
  login: (email: string, password: string) => Promise<void>;
  /**
   * Create a new `users` record and immediately sign in with it.
   * Mirrors `login` — `pb.authStore.onChange` propagates the new session.
   */
  register: (
    email: string,
    password: string,
    passwordConfirm: string
  ) => Promise<void>;
  /** Sign out and clear the stored token. */
  logout: () => void;
}

/**
 * Guards against ending up authenticated as somebody else
 * (e.g. a browser autofill filled a saved account, or a
 * cached response resolved to a stale record). If the freshly
 * stored session isn't the email we asked for, wipe it and fail.
 */
function assertSignedInAs(email: string): void {
  const actual = pb.authStore.record?.email;
  if (!actual || actual.toLowerCase() !== email.trim().toLowerCase()) {
    pb.authStore.clear();
    throw new Error("Сессия не совпадает с указанным email.");
  }
}

/**
 * Keeps the React user state in sync with `pb.authStore`.
 * Returns helpers that never leak the PocketBase client
 * into view components.
 */
export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<User | null>(() => {
    // An expired token can leave `record` populated — don't surface a ghost user.
    if (!pb.authStore.isValid) {
      if (pb.authStore.record) pb.authStore.clear();
      return null;
    }
    return (pb.authStore.record as User | null) ?? null;
  });

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange((_token, record) => {
      setUser(record ? (record as User) : null);
    });
    return unsubscribe;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // Drop any stale / foreign token before authenticating so a failed
    // request can never leave the app showing a previous user.
    pb.authStore.clear();
    await withTimeout(
      pb.collection("users").authWithPassword(email, password),
      "вход"
    );
    assertSignedInAs(email);
  }, []);

  const register = useCallback(
    async (email: string, password: string, passwordConfirm: string) => {
      pb.authStore.clear();
      await withTimeout(
        pb
          .collection("users")
          .create({ email, password, passwordConfirm, emailVisibility: true }),
        "регистрация"
      );
      await withTimeout(
        pb.collection("users").authWithPassword(email, password),
        "вход"
      );
      assertSignedInAs(email);
    },
    []
  );

  const logout = useCallback(() => {
    pb.authStore.clear();
  }, []);

  return { user, isValid: pb.authStore.isValid, login, register, logout };
}