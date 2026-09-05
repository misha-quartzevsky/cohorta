/**
 * Базовые поля, которые PocketBase добавляет к каждой записи
 * (см. `RecordModel` в SDK). Каждый доменный тип наследует их,
 * поэтому доступны `updated`/`collectionId`/`collectionName` без
 * индексной сигнатуры `[key: string]: unknown`.
 */
export interface PbRecord {
  id: string;
  created: string;
  updated: string;
  collectionId: string;
  collectionName: string;
}

export interface Course extends PbRecord {
  name: string;
  color?: string;
  slug?: string;
  /** PocketBase relation → semesters (single). */
  semesters?: string;
  /** PocketBase relation → users. "" у legacy/демо-записей. */
  owner?: string;
}

export interface Lecture extends PbRecord {
  title: string;
  /** Rich-контент (тип "editor" в PB): безлимитный, хранит HTML лекции. */
  content?: string;
  /** Файлы, залитые в лекцию (поле "file" в PB). */
  file?: string | string[];
  /** PocketBase relation → courses. */
  field?: string;
  slug?: string;
  /** PocketBase relation → users (автор). "" у legacy/демо-записей. */
  owner?: string;
  /** PocketBase relation → groups. Заполняется действием «Показать группе». */
  group?: string;
  /** Expanded course data (when using expand:"field"). */
  expand?: {
    field?: Course;
  };
}

/** Thumbnail чужой лекции для участников группы (ведёт серверный хук). */
export interface LecturePreview extends PbRecord {
  /** PocketBase relation → lectures. */
  lecture: string;
  /** PocketBase relation → groups. */
  group: string;
  /** PocketBase relation → users (автор). */
  owner: string;
  title?: string;
  preview_text?: string;
}

/** Точечная выдача полного доступа к лекции конкретному человеку. */
export interface LectureShare extends PbRecord {
  /** PocketBase relation → lectures. */
  lecture: string;
  /** PocketBase relation → users (автор лекции, дублируется для правила). */
  owner: string;
  /** PocketBase relation → users (кому выдан полный доступ). */
  grantee: string;
  expand?: {
    grantee?: User;
  };
}

export interface Semester extends PbRecord {
  slug: string;
}

export interface Tag extends PbRecord {
  name: string;
  color?: string;
  /** Multiple-relation к лекциям (поле живёт на стороне тегов). */
  lectures?: string[];
}

export interface Deck extends PbRecord {
  title: string;
  color?: string;
  slug?: string;
  description?: string;
  is_public?: boolean;
  /** PocketBase relation → users. "" у legacy/демо-записей. */
  owner?: string;
}

export interface DeckCard extends PbRecord {
  /** Rich-контент лицевой стороны (тип "editor" в PB). */
  front: string;
  /** Rich-контент оборотной стороны (тип "editor" в PB). */
  back: string;
  /** PocketBase relation → decks. */
  deck?: string;
  /** Файлы-вложения (картинки) карточки (поле "file" в PB). */
  attachments?: string | string[];
  /** Ручной порядок в колоде (drag-n-drop). Меньше — выше. */
  position?: number;
}

/** Состояние работы над билетом. Хранится, а не выводится из пустоты
 *  ответа: переход draft → ready — осознанное действие человека. */
export type TicketStatus = "empty" | "draft" | "ready";

export interface Exam extends PbRecord {
  /** PocketBase relation → courses. Экзамен — singleton внутри курса. */
  course?: string;
  /** «Экзамен» / «Зачёт» / «Пересдача». Пусто → показываем «Экзамен». */
  title?: string;
  /** ISO-дата экзамена; пусто = даты нет и счётчик дней не показываем. */
  exam_date?: string;
  /** PocketBase relation → users (владелец). */
  owner?: string;
  mode?: "solo" | "group";
  /** Expanded course data (when using expand:"course"). */
  expand?: {
    course?: Course;
  };
}

/** Участник «пати» коллективного экзамена. */
export interface ExamParticipant extends PbRecord {
  /** PocketBase relation → exams. */
  exam: string;
  /** PocketBase relation → users. */
  user: string;
  expand?: {
    user?: User;
  };
}

export interface ExamTicket extends PbRecord {
  /** PocketBase relation → exams. */
  exam?: string;
  /** Номер билета — поле порядка и адрес в URL. */
  number: number;
  /** Формулировка вопроса (plain text, как lectures.title). */
  question: string;
  /** Rich-контент ответа (тип "editor" в PB). */
  answer?: string;
  /** Файлы-вложения ответа (поле "file" в PB). */
  attachments?: string | string[];
  status?: TicketStatus;
  /** Multiple-relation → lectures: из каких конспектов собран ответ. */
  sources?: string[];
  /** PocketBase relation → users. Задел на Group Mode. */
  author?: string;
}

export interface User extends PbRecord {
  email: string;
  name?: string;
  avatar?: string;
  /** Реферальная механика — все четыре поля пишет серверный хук. */
  invited_by?: string;
  invited_group?: string;
  /** ISO-дата: до неё активен премиум ("" / прошлое = нет премиума). */
  premium_until?: string;
  referral_rewarded?: boolean;
}

/** Строка журнала начислений премиума (пишет хук referral.pb.js). */
export interface PremiumGrant extends PbRecord {
  user: string;
  days?: number;
  source?: "referral_inviter" | "referral_invitee";
  related_user?: string;
  related_group?: string;
  granted_at?: string;
}

/** Учебная группа/поток (режим «Группа»). */
export interface Group extends PbRecord {
  name: string;
  slug: string;
  /** PocketBase relation → users. */
  owner: string;
  invite_code: string;
}

/** Членство «пользователь ↔ группа» (many-to-many). */
export interface GroupMember extends PbRecord {
  /** PocketBase relation → groups. */
  group: string;
  /** PocketBase relation → users. */
  user: string;
  joined_at?: string;
  /** Персональное разрешение показывать свои конспекты участникам группы. */
  preview_enabled?: boolean;
  expand?: {
    group?: Group;
    user?: User;
  };
}

// Поля, используемые при работе с PocketBase. Имена физических полей в БД.
// `as const` — ключи становятся литеральными типами (без `string`-размытия).
export const FIELDS = {
  courseName: "name",
  courseColor: "color",
  courseOwner: "owner",
  lectureTitle: "title",
  lectureContent: "content",
  // Файлы (картинки), залитые в лекцию (тип "file" в PB).
  lectureFile: "file",
  // Поле в lectures, которое ссылается на курс (id из courses)
  lectureCourse: "field",
  lectureOwner: "owner",
  lectureGroup: "group",
  // URL-идентификаторы (slugs)
  courseSlug: "slug",
  lectureSlug: "slug",
  semesterSlug: "slug",
  // Поле в courses, которое ссылается на семестр (id из semesters)
  courseSemester: "semesters",
  // Поля коллекции tags
  tagName: "name",
  tagColor: "color",
  // Поле в tags, которое ссылается на лекции (multiple-relation)
  tagLectures: "lectures",
  // Поля коллекции lecture_previews
  previewLecture: "lecture",
  previewGroup: "group",
  previewOwner: "owner",
  previewTitle: "title",
  previewText: "preview_text",
  // Поля коллекции lecture_shares
  shareLecture: "lecture",
  shareOwner: "owner",
  shareGrantee: "grantee",
  // Поля коллекции decks
  deckTitle: "title",
  deckColor: "color",
  deckOwner: "owner",
  deckSlug: "slug",
  deckDescription: "description",
  deckIsPublic: "is_public",
  // Поля коллекции deck_cards
  deckCardFront: "front",
  deckCardBack: "back",
  // Поле в deck_cards, которое ссылается на deck (id из decks)
  deckCardDeck: "deck",
  // Файлы-вложения карточки (тип "file" в PB)
  deckCardAttachments: "attachments",
  // Ручной порядок карточки в колоде (drag-n-drop)
  deckCardPosition: "position",
  // Поля коллекции exams
  examCourse: "course",
  examTitle: "title",
  examDate: "exam_date",
  examOwner: "owner",
  examMode: "mode",
  // Поля коллекции groups
  groupName: "name",
  groupSlug: "slug",
  groupOwner: "owner",
  groupInviteCode: "invite_code",
  // Поля коллекции group_members
  memberGroup: "group",
  memberUser: "user",
  memberJoinedAt: "joined_at",
  memberPreviewEnabled: "preview_enabled",
  // Поля коллекции exam_participants
  examParticipantExam: "exam",
  examParticipantUser: "user",
  // Поля коллекции exam_tickets
  ticketExam: "exam",
  ticketNumber: "number",
  ticketQuestion: "question",
  ticketAnswer: "answer",
  ticketAttachments: "attachments",
  ticketStatus: "status",
  ticketSources: "sources",
  ticketAuthor: "author",
} as const;

// Вспомогательные геттеры, защищающие от разной схемы в БД
export function courseName(c: Course): string {
  return String(c.name ?? "Без названия");
}

export function courseColor(c: Course): string {
  return String(c.color ?? "");
}

export function lectureTitle(l: Lecture): string {
  return String(l.title ?? "Без названия");
}

export function lectureContent(l: Lecture): string {
  return String(l.content ?? "");
}

/**
 * Контент лекции — единое richtext-поле `content` (тип "editor" в PB),
 * хранит HTML лекции (безлимитный).
 */
export function lectureBody(l: Lecture): string {
  return lectureContent(l);
}

/** Имена файлов, прикреплённых к лекции (поле `file`). */
export function lectureFiles(l: Lecture): string[] {
  const v = l.file;
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" && v) return [v];
  return [];
}

export function lectureCourseId(l: Lecture): string {
  return String(l.field ?? "");
}

/** PocketBase id автора лекции ("" у legacy/демо-записей). */
export function lectureOwnerId(l: Lecture): string {
  return String(l.owner ?? "");
}

/** PocketBase id группы, которой показана лекция ("" = приватная). */
export function lectureGroupId(l: Lecture): string {
  return String(l.group ?? "");
}

/**
 * URL-friendly identifier of a course.
 * Falls back to the record id for legacy rows without a slug.
 */
export function courseSlug(c: Course): string {
  return c.slug ? String(c.slug) : c.id;
}

/**
 * URL-friendly identifier of a lecture.
 * Falls back to the record id for legacy rows without a slug.
 */
export function lectureSlug(l: Lecture): string {
  return l.slug ? String(l.slug) : l.id;
}

/**
 * Путь навигации к лекции: привязанные к курсу лекции живут под
 * /s/:semester/:course/:lecture, непривязанные — под /note/:lecture.
 * Единая точка для этой развилки — раньше дублировалась в
 * useActivityTimeline и, отдельно, в компонентах календаря дашборда.
 */
export function lectureHref(l: Lecture, semesterSlugValue: string): string {
  const course = lectureCourseId(l) ? l.expand?.field : undefined;
  if (!course) return `/note/${lectureSlug(l)}`;
  return `/s/${semesterSlugValue}/${courseSlug(course)}/${lectureSlug(l)}`;
}

/** URL identifier of a semester (e.g. "5"). */
export function semesterSlug(s: Semester): string {
  return String(s.slug ?? "");
}

/** Активен ли премиум-доступ пользователя (premium_until в будущем). */
export function isPremiumActive(u: User, now: Date = new Date()): boolean {
  const raw = String(u.premium_until ?? "").trim();
  if (!raw) return false;
  const until = new Date(raw.replace(" ", "T"));
  return !Number.isNaN(until.getTime()) && until > now;
}

/** PocketBase id of the semester a course belongs to ("" = none). */
export function courseSemesterId(c: Course): string {
  return String(c.semesters ?? "");
}

/**
 * Превращает HTML-фрагмент лекции в plain-text сниппет:
 * вырезает теги и токены картинок `[[file:…]]`.
 */
export function stripHtml(html: string): string {
  return String(html ?? "")
    .replace(/\[\[file:[^\]]+\]\]/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Плейн-текстовая выдержка лекции для плиток и результатов поиска.
 * Обрезает до `maxLen` символов по границе последнего целого слова —
 * никогда не рвёт слово посередине (было: "...вторая по...").
 */
export function lectureExcerpt(l: Lecture, maxLen = 150): string {
  const text = stripHtml(lectureBody(l));
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return trimmed.trimEnd() + "…";
}

export function tagName(t: Tag): string {
  return String(t.name ?? "Без названия");
}

export function tagColor(t: Tag): string {
  return String(t.color ?? "");
}

/** Lecture ids that carry this tag (from the tags side of the relation). */
export function tagLectureIds(t: Tag): string[] {
  const v = t.lectures;
  return Array.isArray(v) ? v.map(String) : [];
}

export function deckTitle(d: Deck): string {
  return String(d.title ?? "Без названия");
}

export function deckColor(d: Deck): string {
  return String(d.color ?? "");
}

export function deckDescription(d: Deck): string {
  return String(d.description ?? "");
}

/** URL-friendly identifier of a deck (falls back to id for legacy rows). */
export function deckSlug(d: Deck): string {
  return d.slug ? String(d.slug) : d.id;
}

/** PocketBase id of the deck a card belongs to ("" = none). */
export function deckCardDeckId(c: DeckCard): string {
  return String(c.deck ?? "");
}

export function deckCardFront(c: DeckCard): string {
  return String(c.front ?? "");
}

export function deckCardBack(c: DeckCard): string {
  return String(c.back ?? "");
}

/** Имена файлов-вложений карточки (поле `attachments`). */
export function deckCardAttachmentNames(c: DeckCard): string[] {
  const v = c.attachments;
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" && v) return [v];
  return [];
}


/** Заголовок экзамена; по умолчанию — нейтральное «Экзамен». */
export function examTitle(e: Exam): string {
  const t = String(e.title ?? "").trim();
  return t || "Экзамен";
}

/** PocketBase id курса, к которому привязан экзамен ("" = нет). */
export function examCourseId(e: Exam): string {
  return String(e.course ?? "");
}

/** ISO-дата экзамена ("" = не задана). */
export function examDate(e: Exam): string {
  return String(e.exam_date ?? "");
}

/**
 * Сколько полных дней осталось до экзамена.
 *
 * Считаем по календарным суткам, а не по «24 часа»: экзамен завтра
 * утром — это «завтра», даже если до него 15 часов.
 *
 * @returns число дней (0 = сегодня, отрицательное = прошёл),
 *          либо null, когда дата не задана или не разбирается
 */
export function examDaysLeft(e: Exam, now: Date = new Date()): number | null {
  const raw = examDate(e);
  if (!raw) return null;
  const target = new Date(raw);
  if (Number.isNaN(target.getTime())) return null;
  const startOfDay = (d: Date) =>
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((startOfDay(target) - startOfDay(now)) / 86400000);
}

/** Статус билета с безопасным значением по умолчанию. */
export function ticketStatus(t: ExamTicket): TicketStatus {
  const v = String(t.status ?? "");
  return v === "draft" || v === "ready" ? v : "empty";
}

export function ticketNumber(t: ExamTicket): number {
  const n = Number(t.number);
  return Number.isFinite(n) ? n : 0;
}

export function ticketQuestion(t: ExamTicket): string {
  return String(t.question ?? "");
}

export function ticketAnswer(t: ExamTicket): string {
  return String(t.answer ?? "");
}

/** PocketBase id экзамена, которому принадлежит билет ("" = нет). */
export function ticketExamId(t: ExamTicket): string {
  return String(t.exam ?? "");
}

/** Имена файлов-вложений билета (поле `attachments`). */
export function ticketAttachmentNames(t: ExamTicket): string[] {
  const v = t.attachments;
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" && v) return [v];
  return [];
}

/** Id лекций-источников ответа. */
export function ticketSourceIds(t: ExamTicket): string[] {
  const v = t.sources;
  return Array.isArray(v) ? v.map(String) : [];
}

export function groupName(g: Group): string {
  return String(g.name ?? "Группа");
}

/** PocketBase id владельца группы. */
export function groupOwnerId(g: Group): string {
  return String(g.owner ?? "");
}

/** Id группы, к которой относится членство. */
export function memberGroupId(m: GroupMember): string {
  return String(m.group ?? "");
}

/** Id пользователя в записи членства. */
export function memberUserId(m: GroupMember): string {
  return String(m.user ?? "");
}
