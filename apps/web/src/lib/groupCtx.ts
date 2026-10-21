import { createContext, useContext } from "react";
import type { GroupSummary } from "../services/groupApi";

export interface GroupCtxValue {
  /** Группы, где состоит человек. */
  groups: GroupSummary[];
  loading: boolean;
  /** Выбранная группа (null — человек пока ни в одной). */
  current: GroupSummary | null;
  select: (groupId: string) => void;
  refresh: () => Promise<void>;
  /** Число открытых запросов доступа ко мне во всех группах (точка и бейджи). */
  requestsTotal: number;
}

export const GroupCtx = createContext<GroupCtxValue | null>(null);

export function useGroupCtx(): GroupCtxValue {
  const v = useContext(GroupCtx);
  if (!v) throw new Error("useGroupCtx вне GroupProvider");
  return v;
}

export const GROUP_KEY = "cohorta:group";

/** Без провайдера возвращает null (меню лекции живёт и вне каркаса группы). */
export function useGroupCtxOptional(): GroupCtxValue | null {
  return useContext(GroupCtx);
}
