/**
 * ============================================
 *  groupService.ts — Group / GroupMember API Service Layer
 * ============================================
 *
 * Все обращения к коллекциям `groups` и `group_members`.
 *
 * Owner-scoped: создать группу может любой авторизованный
 * пользователь, `owner` проставляется на клиенте.
 *
 * `groups.listRule`/`viewRule` ограничены участникам и владельцу
 * (A0.5, 2026-10-18) — найти ЧУЖУЮ группу по названию или коду
 * напрямую через API больше нельзя. Поиск похожих групп (защита
 * от фрагментации потока), вступление по коду и ростер идут через
 * серверные маршруты `pb_hooks/groups_access.pb.js`, которые
 * отдают только name/id/slug и не раскрывают invite_code или
 * профиль участника целиком.
 *
 * Этап A: создание, вступление по коду, ростер. Без превью
 * конспектов и точечного шеринга (это этап B+).
 */

import { pb } from "../lib/pocketbase";
import type { Group, GroupMember, LecturePreview } from "../lib/types";
import { FIELDS } from "../lib/types";
import { slugify } from "../lib/slugify";

/** Id текущего пользователя ("" — не залогинен). */
function currentUserId(): string {
  return String(pb.authStore.record?.id ?? "");
}

/** Случайный invite-код: 8 символов a-z0-9. */
function makeInviteCode(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 8; i += 1) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}

export interface GroupCandidate {
  id: string;
  name: string;
}

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

/**
 * Нечёткий поиск СУЩЕСТВУЮЩИХ групп по названию — обязательный шаг
 * перед созданием новой (защита от фрагментации потока). Идёт через
 * серверный маршрут `/api/groups/search` (A0.5, 2026-10-18):
 * `groups.listRule` теперь ограничен участникам и владельцу, прямой
 * запрос к коллекции чужие группы не находит.
 */
export async function searchSimilarGroups(
  name: string,
  limit = 6
): Promise<GroupCandidate[]> {
  const query = name.trim();
  if (query.length < 2) return [];

  try {
    const results = await pb.send<GroupCandidate[]>("/api/groups/search", {
      method: "GET",
      query: { q: query },
    });
    return (results ?? []).slice(0, limit);
  } catch {
    return [];
  }
}

/** Строку членства текущего пользователя в группе, либо null. */
async function myMembership(groupId: string): Promise<GroupMember | null> {
  const uid = currentUserId();
  if (!uid || !groupId) return null;
  try {
    return await pb
      .collection("group_members")
      .getFirstListItem<GroupMember>(
        pb.filter(`${FIELDS.memberGroup} = {:g} && ${FIELDS.memberUser} = {:u}`, {
          g: groupId,
          u: uid,
        })
      );
  } catch {
    return null;
  }
}

/**
 * Создать группу. `owner` — текущий пользователь; сразу же
 * создаётся его строка членства.
 */
export async function createGroup(name: string): Promise<Group> {
  const uid = currentUserId();
  if (!uid) throw new Error("Нужно войти, чтобы создать группу.");

  const base = slugify(name) || "group";
  const rand = Math.random().toString(36).slice(2, 6);

  const group = await pb.collection("groups").create<Group>({
    [FIELDS.groupName]: name.trim(),
    [FIELDS.groupSlug]: `${base}-${rand}`,
    [FIELDS.groupOwner]: uid,
    [FIELDS.groupInviteCode]: makeInviteCode(),
  });

  await pb.collection("group_members").create<GroupMember>({
    [FIELDS.memberGroup]: group.id,
    [FIELDS.memberUser]: uid,
  });

  return group;
}

/**
 * Вступить в группу по invite-коду. Идемпотентно: если уже
 * участник — просто возвращает группу. Идёт через серверный
 * маршрут `/api/groups/join` (A0.5, 2026-10-18) — найти группу по
 * коду через коллекцию напрямую больше нельзя (это раскрывало бы
 * invite_code всех групп любому вошедшему), поиск и создание
 * строки членства делает хук `pb_hooks/groups_access.pb.js`.
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

/**
 * Вступить в группу по её id (из результатов fuzzy-поиска). Идемпотентно.
 * Членство создаётся за текущего пользователя — правило это разрешает
 * любому авторизованному.
 */
export async function joinGroupById(groupId: string): Promise<void> {
  const uid = currentUserId();
  if (!uid || !groupId) throw new Error("Нужно войти, чтобы вступить в группу.");
  const existing = await myMembership(groupId);
  if (existing) return;
  await pb.collection("group_members").create<GroupMember>({
    [FIELDS.memberGroup]: groupId,
    [FIELDS.memberUser]: uid,
  });
}

interface RosterEntry {
  id: string;
  user: { id: string; name?: string; email?: string } | null;
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
export async function fetchRoster(groupId: string): Promise<GroupMember[]> {
  if (!groupId) return [];
  const entries = await pb.send<RosterEntry[]>(`/api/groups/${groupId}/roster`, {
    method: "GET",
  });
  return (entries ?? []).map((entry) => ({
    id: entry.id,
    created: "",
    updated: "",
    collectionId: "",
    collectionName: "group_members",
    [FIELDS.memberGroup]: groupId,
    [FIELDS.memberUser]: entry.user?.id ?? "",
    joined_at: entry.joined_at,
    preview_enabled: entry.preview_enabled,
    expand: entry.user
      ? { user: { id: entry.user.id, name: entry.user.name, email: entry.user.email } }
      : undefined,
  })) as unknown as GroupMember[];
}

/** Покинуть группу (удалить свою строку членства). */
export async function leaveGroup(groupId: string): Promise<void> {
  const mine = await myMembership(groupId);
  if (mine) await pb.collection("group_members").delete(mine.id);
}

/**
 * Переключить `preview_enabled` для текущего пользователя в группе —
 * персональное разрешение показывать свои конспекты участникам. Хук
 * `lecture_previews.pb.js` пересоберёт thumbnail-строки.
 */
export async function setPreviewEnabled(
  groupId: string,
  enabled: boolean
): Promise<void> {
  const mine = await myMembership(groupId);
  if (!mine) return;
  await pb.collection("group_members").update(mine.id, {
    [FIELDS.memberPreviewEnabled]: enabled,
  });
}

/**
 * Thumbnail-превью лекций конкретного автора, видимые текущему
 * пользователю (правило `lecture_previews` = участник той же группы).
 * `content` лекции сюда не входит — только заголовок + короткий фрагмент.
 */
export async function fetchOwnerPreviews(
  ownerUserId: string
): Promise<LecturePreview[]> {
  if (!ownerUserId) return [];
  return pb.collection("lecture_previews").getFullList<LecturePreview>({
    filter: pb.filter(`${FIELDS.previewOwner} = {:o}`, { o: ownerUserId }),
    sort: "-updated",
  });
}
