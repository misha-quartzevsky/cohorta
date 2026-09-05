/**
 * ============================================
 *  useGroups.ts — Group / GroupMember Hooks
 * ============================================
 */

import { useCallback } from "react";
import type { Group, GroupMember } from "../lib/types";
import { fetchMyGroups, fetchRoster } from "../services/groupService";
import { useAsyncData } from "./useAsyncData";

export interface UseMyGroupsResult {
  groups: Group[];
  loading: boolean;
  error: string;
  setError: (message: string) => void;
  refetch: () => Promise<void>;
}

/** Группы, которыми пользователь владеет или в которых состоит. */
export function useMyGroups(enabled: boolean = true): UseMyGroupsResult {
  const fetcher = useCallback(() => fetchMyGroups(), []);
  const { data, loading, error, setError, refetch } = useAsyncData<Group[]>(
    fetcher,
    enabled
  );
  return { groups: data ?? [], loading, error, setError, refetch };
}

export interface UseRosterResult {
  roster: GroupMember[];
  loading: boolean;
  error: string;
  refetch: () => Promise<void>;
}

/** Ростер группы (строки членства с раскрытым пользователем). */
export function useRoster(groupId: string): UseRosterResult {
  const fetcher = useCallback(() => fetchRoster(groupId), [groupId]);
  const { data, loading, error, refetch } = useAsyncData<GroupMember[]>(
    fetcher,
    !!groupId
  );
  return { roster: data ?? [], loading, error, refetch };
}
