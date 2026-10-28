/**
 * ============================================
 *  groupService.ts — Group / GroupMember API Service Layer
 * ============================================
 *
 * Все обращения к коллекциям `groups` и `group_members`.
 *
 * Группы и членство создаются и меняются только серверными маршрутами
 * (`pb_hooks/groups_manage.pb.js`, волна C): правила коллекций закрывают
 * прямое создание и удаление.
 *
 * `groups.listRule`/`viewRule` ограничены участникам и владельцу
 * (A0.5, 2026-10-18) — найти ЧУЖУЮ группу по названию или коду
 * напрямую через API больше нельзя. Поиск похожих групп (защита
 * от фрагментации потока), вступление по коду и ростер идут через
 * серверные маршруты `pb_hooks/groups_join.pb.js`, которые
 * отдают только name/id/slug и не раскрывают invite_code или
 * профиль участника целиком.
 *
 * Этап A: создание, вступление по коду, ростер. Без превью
 * конспектов и точечного шеринга (это этап B+).
 */

import { pb, currentUserId } from "../lib/pocketbase";
import type { Group, GroupMember, User } from "../lib/types";
import { FIELDS } from "../lib/types";

/** Группы, которыми пользователь владеет или в которых состоит. */
export async function fetchMyGroups(): Promise<Group[]> {
  const uid = currentUserId();
  if (!uid) return [];

  const memberships = await pb
    .collection("group_members")
    .getFullList<GroupMember>({
      filter: pb.filter(`${FIELDS.memberUser} = {:uid}`, { uid }),
      expand: FIELDS.memberGroup,
      sort: "-created",
    });

  const byId = new Map<string, Group>();
  for (const m of memberships) {
    const g = m.expand?.group;
    if (g) byId.set(g.id, g);
  }

  // Группы во владении без строки членства (крайний случай — вступление
  // должно её создавать, но подстрахуемся).
  const owned = await pb.collection("groups").getFullList<Group>({
    filter: pb.filter(`${FIELDS.groupOwner} = {:uid}`, { uid }),
  });
  for (const g of owned) byId.set(g.id, g);

  return [...byId.values()];
}

/** Сбросить код: старый перестаёт работать, участники остаются. Только владелец. */
export async function resetInviteCode(groupId: string): Promise<string> {
  const r = await pb.send<{ code: string }>(`/api/groups/${groupId}/invite/reset`, { method: "POST" });
  return r.code;
}

/** Передать группу участнику. Только владелец. */
export async function transferGroup(groupId: string, userId: string): Promise<void> {
  await pb.send(`/api/groups/${groupId}/transfer`, { method: "POST", body: { user: userId } });
}

/**
 * Вступить в группу по invite-коду. Идемпотентно: если уже
 * участник — просто возвращает группу. Идёт через серверный
 * маршрут `/api/groups/join` (A0.5, 2026-10-18) — найти группу по
 * коду через коллекцию напрямую больше нельзя (это раскрывало бы
 * invite_code всех групп любому вошедшему), поиск и создание
 * строки членства делает хук `pb_hooks/groups_join.pb.js`.
 *
 * @throws если код не найден
 */
export async function joinByInviteCode(code: string): Promise<void> {
  const uid = currentUserId();
  if (!uid) throw new Error("Нужно войти, чтобы вступить в группу.");

  const trimmed = code.trim().toLowerCase();
  if (!trimmed) throw new Error("Введите код приглашения.");

  try {
    await pb.send("/api/groups/join", {
      method: "POST",
      body: { code: trimmed },
    });
  } catch {
    throw new Error("Группа с таким кодом не найдена.");
  }
}

/** Участник группы в ростере: строка членства с id, именем и аватаром человека (остальных полей сервер не отдаёт). */
export interface RosterMember {
  id: string;
  user: string;
  joined_at?: string;
  preview_enabled?: boolean;
  expand?: { user?: Pick<User, "id" | "name" | "avatar"> };
}

interface RosterEntry {
  id: string;
  user: { id: string; name?: string; avatar?: string } | null;
  joined_at?: string;
  preview_enabled: boolean;
}

/**
 * Ростер группы: строки членства с раскрытым пользователем, по дате
 * вступления. Идёт через `/api/groups/:id/roster` (A0.5, 2026-10-18):
 * `users.viewRule` теперь "только свой профиль", поэтому `expand`
 * на `group_members.user` для чужих строк больше ничего не отдаёт —
 * хук берёт только name/email, которые нужны экрану «Группа».
 */
export async function fetchRoster(groupId: string): Promise<RosterMember[]> {
  if (!groupId) return [];
  const entries = await pb.send<RosterEntry[]>(`/api/groups/${groupId}/roster`, {
    method: "GET",
  });
  return (entries ?? []).map((entry) => ({
    id: entry.id,
    user: entry.user?.id ?? "",
    joined_at: entry.joined_at,
    preview_enabled: entry.preview_enabled,
    expand: entry.user ? { user: { id: entry.user.id, name: entry.user.name, avatar: entry.user.avatar } } : undefined,
  }));
}

export interface GroupPreview {
  id: string;
  name: string;
  members: number;
  owner_name: string;
  is_member: boolean;
}

/**
 * Предпросмотр группы по коду приглашения (экран «Вступить в группу»).
 * Серверный маршрут `/api/groups/preview` отдаёт только название, число
 * участников и имя создателя.
 *
 * @throws если код не найден
 */
export async function fetchGroupPreview(code: string): Promise<GroupPreview> {
  const trimmed = code.trim().toLowerCase();
  if (!trimmed) throw new Error("Введите код приглашения.");
  try {
    return await pb.send<GroupPreview>("/api/groups/preview", {
      method: "GET",
      query: { code: trimmed },
    });
  } catch {
    throw new Error("Группа с таким кодом не найдена.");
  }
}
