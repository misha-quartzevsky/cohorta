import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { GroupCtx, GROUP_KEY } from "./groupCtx";
import { fetchGroupSummaries, type GroupSummary } from "../services/groupApi";
import { useAuth } from "../hooks/useAuth";

function readStored(): string {
  try {
    return localStorage.getItem(GROUP_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Группы человека и выбранная группа (можно состоять в двух сразу; выбор помнится на устройстве). */
export default function GroupProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>(readStored);

  const refresh = useCallback(async () => {
    if (!uid) {
      setGroups([]);
      setLoading(false);
      return;
    }
    try {
      setGroups(await fetchGroupSummaries());
    } catch {
      /* оставляем прежний список: без связи группы не пропадают */
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const select = useCallback((groupId: string) => {
    setSelected(groupId);
    try {
      localStorage.setItem(GROUP_KEY, groupId);
    } catch {
      /* без хранилища выбор живёт до перезагрузки */
    }
  }, []);

  const value = useMemo(() => {
    const current = groups.find((g) => g.group.id === selected) ?? groups[0] ?? null;
    return {
      groups,
      loading,
      current,
      select,
      refresh,
      requestsTotal: groups.reduce((n, g) => n + g.openRequests, 0),
    };
  }, [groups, loading, selected, select, refresh]);

  return <GroupCtx.Provider value={value}>{children}</GroupCtx.Provider>;
}
