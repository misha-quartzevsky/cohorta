import { useCallback, useEffect, useState } from "react";
import { useGroupCtx } from "../lib/groupCtx";
import {
  fetchPreviews,
  fetchRequests,
  fetchRosterPeople,
  fetchShares,
  type PreviewRow,
  type RequestRow,
  type RosterPerson,
  type ShareRow,
} from "../services/groupApi";

export interface GroupData {
  roster: RosterPerson[];
  previews: PreviewRow[];
  shares: ShareRow[];
  requests: RequestRow[];
  loading: boolean;
  error: string;
  refetch: () => Promise<void>;
  /** Имя человека по id (из состава группы). */
  nameOf: (userId: string) => string;
}

/** Состав, предпросмотр, доступы и запросы выбранной группы. */
export function useGroupData(): GroupData {
  const { current } = useGroupCtx();
  const groupId = current?.group.id ?? "";
  const [state, setState] = useState<Omit<GroupData, "refetch" | "nameOf">>({
    roster: [],
    previews: [],
    shares: [],
    requests: [],
    loading: !!groupId,
    error: "",
  });

  const load = useCallback(async () => {
    if (!groupId) return;
    try {
      const [roster, previews, shares, requests] = await Promise.all([
        fetchRosterPeople(groupId),
        fetchPreviews(groupId),
        fetchShares(groupId),
        fetchRequests(groupId),
      ]);
      setState({ roster, previews, shares, requests, loading: false, error: "" });
    } catch {
      setState((s) => ({ ...s, loading: false, error: "Не удалось загрузить группу. Проверь связь и попробуй ещё раз." }));
    }
  }, [groupId]);

  useEffect(() => {
    setState((s) => ({ ...s, loading: !!groupId }));
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [groupId, load]);

  const nameOf = useCallback((userId: string) => state.roster.find((p) => p.id === userId)?.name ?? "Участник", [state.roster]);
  return { ...state, refetch: load, nameOf };
}
