/**
 * ============================================
 *  groupService.ts — Group / GroupMember API Service Layer
 * ============================================
 *
 * Все обращения к коллекциям `groups` и `group_members`.
 *
 * Owner-scoped: создать группу может любой авторизованный
 * пользователь, `owner` проставляется на клиенте. Правила
 * чтения `groups` намеренно широкие — экран «Группа» обязан
 * находить УЖЕ существующие группы по названию (fuzzy-поиск
 * против фрагментации потока).
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

/**
 * Нормализованная форма названия для нечёткого сравнения:
 * транслит + lower-case + без пробелов/дефисов/цифровых разделителей.
 * «Медиаком МК-31» ~ «медиаком мк 31» ~ «mediakom mk31».
 */
export function normalizeGroupName(name: string): string {
  return slugify(name).replace(/-/g, "");
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
 * перед созданием новой (защита от фрагментации потока). Серверный
 * `~`-матч плюс клиентское сравнение нормализованных форм (ловит
 * «МК 31» ↔ «МК-31» ↔ «мк31», которые сырой `~` пропускает).
 */
export async function searchSimilarGroups(
  name: string,
  limit = 6
): Promise<GroupCandidate[]> {
  const query = name.trim();
  if (query.length < 2) return [];
  const norm = normalizeGroupName(query);

  const found = new Map<string, Group>();

  try {
    const contains = await pb.collection("groups").getFullList<Group>({
      filter: `${FIELDS.groupName} ~ "${query.replace(/["\\]/g, "")}"`,
      sort: FIELDS.groupName,
    });
    for (const g of contains) found.set(g.id, g);
  } catch {
    /* ignore — fall through to the normalised pass */
  }

  if (found.size < limit && norm.length >= 2) {
    try {
      const all = await pb
        .collection("groups")
        .getFullList<Group>({ sort: FIELDS.groupName });
      for (const g of all) {
        const gn = normalizeGroupName(g.name);
        if (gn.includes(norm) || norm.includes(gn)) found.set(g.id, g);
      }
    } catch {
      /* keep what the contains-pass found */
    }
  }

  return [...found.values()]
    .slice(0, limit)
    .map((g) => ({ id: g.id, name: g.name }));
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
 * участник — просто возвращает группу.
 *
 * @throws если код не найден
 */
export async function joinByInviteCode(code: string): Promise<Group> {
  const uid = currentUserId();
  if (!uid) throw new Error("Нужно войти, чтобы вступить в группу.");

  const trimmed = code.trim().toLowerCase();
  if (!trimmed) throw new Error("Введите код приглашения.");

  let group: Group;
  try {
    group = await pb
      .collection("groups")
      .getFirstListItem<Group>(
        pb.filter(`${FIELDS.groupInviteCode} = {:code}`, { code: trimmed })
      );
  } catch {
    throw new Error("Группа с таким кодом не найдена.");
  }

  const existing = await myMembership(group.id);
  if (!existing) {
    await pb.collection("group_members").create<GroupMember>({
      [FIELDS.memberGroup]: group.id,
      [FIELDS.memberUser]: uid,
    });
  }

  return group;
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

/** Ростер группы: строки членства с раскрытым пользователем, по дате вступления. */
export async function fetchRoster(groupId: string): Promise<GroupMember[]> {
  if (!groupId) return [];
  return pb.collection("group_members").getFullList<GroupMember>({
    filter: pb.filter(`${FIELDS.memberGroup} = {:g}`, { g: groupId }),
    expand: FIELDS.memberUser,
    sort: "joined_at",
  });
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
