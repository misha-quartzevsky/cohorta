/**
 * Геттеры и чистая логика над записями (названия, ссылки, сроки). Реэкспортируется из `lib/types.ts`.
 */

import { parsePbDate } from "./format";
import { calendarDaysUntil } from "./localDate";
import type {
  Course,
  Deck,
  DeckCard,
  Exam,
  ExamTicket,
  Group,
  GroupMember,
  Lecture,
  Semester,
  Tag,
  TicketStatus,
  User,
} from "./recordTypes";

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

export function lectureCourseId(l: Pick<Lecture, "field">): string {
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

/** Порядковый номер периода (fallback — числовой slug, иначе 0). */
export function semesterOrder(s: Semester): number {
  const raw = s.order;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const n = Number.parseInt(semesterSlug(s), 10);
  return Number.isNaN(n) ? 0 : n;
}

/** Подпись периода для UI: `label`, иначе «{slug} семестр». */
export function semesterLabel(s: Semester): string {
  const label = String(s.label ?? "").trim();
  return label || `${semesterSlug(s)} семестр`;
}

/** Активен ли премиум-доступ пользователя (premium_until в будущем). */
export function isPremiumActive(u: User, now: Date = new Date()): boolean {
  const raw = String(u.premium_until ?? "").trim();
  if (!raw) return false;
  const until = parsePbDate(raw);
  return !!until && until > now;
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
  return calendarDaysUntil(examDate(e), now);
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
  // Fallback covers null/undefined AND empty/whitespace name (legacy rows created
  // before `name` became required) — never render a blank heading.
  const name = g.name == null ? "" : String(g.name).trim();
  return name || "Группа";
}

/** PocketBase id владельца группы. */
export function groupOwnerId(g: Group): string {
  return String(g.owner ?? "");
}

/** Id пользователя в записи членства. */
export function memberUserId(m: GroupMember): string {
  return String(m.user ?? "");
}
