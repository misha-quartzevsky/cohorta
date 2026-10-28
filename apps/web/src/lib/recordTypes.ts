/**
 * Типы записей PocketBase (интерфейсы коллекций). Реэкспортируются из `lib/types.ts`.
 */

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
  /** Легаси-поле старой системы цвета (courseGradient.ts). Не использовать
   * в новых экранах — обложка строится из `cover_seed` (раздел 2.3). */
  color?: string;
  /** Вход генератора обложки предмета (SubjectCover), 0–359. */
  cover_seed?: number | null;
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
  /** PocketBase relation → schedule_slots. Пара, к которой привязан конспект. */
  slot?: string;
  /** Дата конкретной пары (YYYY-MM-DD). */
  lecture_date?: string;
  /** Порядковый номер лекции в предмете («Лекция 6»). */
  number?: number;
  /** Expanded course data (when using expand:"field"). */
  expand?: {
    field?: Course;
  };
}

/** Настройки расписания пользователя (одна строка). spec 2.1 */
export interface ScheduleSettings extends PbRecord {
  owner: string;
  /** Массив { n, start:"HH:MM", end:"HH:MM" }. */
  pair_times?: PairTime[];
  /** Понедельник нечётной недели (YYYY-MM-DD) — якорь чётности. */
  odd_week_anchor?: string;
  show_saturday?: boolean;
}

export interface PairTime {
  n: number;
  start: string;
  end: string;
}

export type WeekParity = "any" | "odd" | "even";
export type SlotKind = "lecture" | "seminar" | "lab" | "other";

/** Слот расписания — повторяющаяся пара. spec 2.2 */
export interface ScheduleSlot extends PbRecord {
  owner: string;
  /** relation → semesters */
  semester?: string;
  /** relation → courses (предмет) */
  subject: string;
  /** 1..6, 1 = понедельник */
  weekday: number;
  /** 1..8 */
  pair_number: number;
  week_parity?: WeekParity;
  kind?: SlotKind;
  room?: string;
  teacher?: string;
  date_from?: string;
  date_to?: string;
  expand?: {
    subject?: Course;
  };
}

/**
 * Лекция, прикреплённая к паре постфактум («Добавить конспект» в меню
 * пустой пары на /schedule), на одну конкретную дату — не на все
 * повторения слота (решение владелицы, 2026-10-19). Одна и та же лекция
 * может быть прикреплена к разным парам/датам одновременно.
 */
export interface ScheduleSlotLecture extends PbRecord {
  owner: string;
  /** relation → schedule_slots */
  slot: string;
  /** relation → lectures */
  lecture: string;
  /** YYYY-MM-DD, дата конкретного проведения пары */
  date: string;
  expand?: {
    lecture?: Lecture;
  };
}

export type TaskSource = "manual" | "lecture" | "auto_review";

/** Задача студента. spec 2.4 */
export interface Task extends PbRecord {
  owner: string;
  title: string;
  /** relation → courses */
  subject?: string;
  /** relation → lectures */
  lecture?: string;
  /** YYYY-MM-DD */
  due?: string;
  /** YYYY-MM-DD; пусто = открыта */
  done_at?: string;
  source?: TaskSource;
  dedupe_key?: string;
  dismissed?: boolean;
  expand?: {
    subject?: Course;
    lecture?: Lecture;
  };
}

/** Одна генерация квиза по лекции. spec 2.5 */
export interface Quiz extends PbRecord {
  owner: string;
  /** relation → lectures */
  lecture: string;
  /** sha256 нормализованного текста лекции на момент генерации */
  source_hash?: string;
  size?: number;
  model?: string;
}

export type QuizQuestionType = "mcq" | "recall";

/** Один вопрос квиза. spec 2.5 */
export interface QuizQuestion extends PbRecord {
  owner: string;
  /** relation → quizzes */
  quiz: string;
  /** relation → lectures */
  lecture: string;
  position?: number;
  type: QuizQuestionType;
  topic?: string;
  prompt?: string;
  /** только type=mcq, ровно 4 строки */
  options?: string[];
  /** только type=mcq, 0..3 */
  correct_index?: number;
  /** только type=recall */
  answer?: string;
  explanation?: string;
  quote?: string | null;
  /** «плохой вопрос» — не показывать в будущих прохождениях */
  flagged?: boolean;
  hidden?: boolean;
}

/** Один ответ на вопрос квиза. spec 2.5 */
export interface QuizAnswer extends PbRecord {
  owner: string;
  /** relation → quiz_questions */
  question: string;
  /** relation → lectures */
  lecture: string;
  correct?: boolean;
  /** дата ответа (YYYY-MM-DD после нормализации) */
  answered_at?: string;
  /** uuid одного прохождения — общий для всех ответов внутри запуска */
  attempt?: string;
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

/** Тип периода обучения (см. `Semester.type`). */
export type PeriodType =
  | "semester"
  | "trimester"
  | "quarter"
  | "module"
  | "custom";

export interface Semester extends PbRecord {
  slug: string;
  /** PocketBase relation → users (владелец). Заполняется онбордингом. */
  user?: string;
  /** PocketBase relation → groups. Задел на будущее, сейчас всегда пусто. */
  group?: string;
  /** Человекочитаемая подпись: «1 семестр», «Осенний триместр». */
  label?: string;
  /** Порядковый номер периода (сортировка). slug = String(order). */
  order?: number;
  type?: PeriodType;
  /** Текущий период (максимум один). */
  is_current?: boolean;
  /** Даты периода (B6): YYYY-MM-DD после pbDateOnly; необязательные. */
  date_from?: string;
  date_to?: string;
}

/** Справочник вузов для онбординга (коллекция `universities`). */
export interface University extends PbRecord {
  name: string;
  city: string;
  region?: string;
}

/** Ступень образования (см. `User.degree_level`). */
export type DegreeLevel = "bachelor" | "specialist" | "master" | "other";

export interface Tag extends PbRecord {
  name: string;
  color?: string;
  /** Multiple-relation к лекциям (поле живёт на стороне тегов). */
  lectures?: string[];
  /** Владелец тега: видит и меняет только он. */
  owner?: string;
}

export interface Deck extends PbRecord {
  title: string;
  color?: string;
  slug?: string;
  description?: string;
  is_public?: boolean;
  /** PocketBase relation → users. "" у legacy/демо-записей. */
  owner?: string;
  /** PocketBase relation → courses; поля в базе пока нет (см. DECK_SUBJECT_SUPPORTED). */
  subject?: string;
}

export interface DeckCard extends PbRecord {
  /** Rich-контент лицевой стороны (тип "editor" в PB). */
  front: string;
  /** Rich-контент оборотной стороны (тип "editor" в PB). */
  back: string;
  /** PocketBase relation → decks. */
  deck?: string;
  /** PocketBase relation → lectures (необязательная, только своя лекция). "" — не привязана. */
  lecture?: string;
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
  /** Билет подгруппы экзамена группы ("" — личный или общий список). */
  subgroup?: string;
  /** Кто готовит билет (участники подгруппы). */
  assignees?: string[];
  /** Блокировка «Занят»: кто правит и до какого момента (30 секунд без действий). */
  locked_by?: string;
  locked_until?: string;
  expand?: {
    exam?: Exam & { expand?: { course?: Course } };
  };
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
  // --- Онбординг: профиль студента ---
  /** Обращение внутри Cohorta. Уникально (partial index). */
  username?: string;
  /** Город обучения (для фильтра вузов). */
  city?: string;
  /** PocketBase relation → universities (если вуз нашёлся в справочнике). */
  university?: string;
  /** Свободный текст, если вуз не найден в справочнике. */
  university_custom?: string;
  degree_level?: DegreeLevel;
  /** Текст при `degree_level === "other"`. */
  degree_level_custom?: string;
  /** Курс обучения. */
  course?: number;
  /** Пока false — показываем мастер онбординга вместо приложения. */
  onboarding_completed?: boolean;
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
  /** Код приглашения API не отдаёт (скрытое поле): владелец читает его через /api/groups/:id/invite. */
  invite_code?: string;
  /** Ссылка-приглашение открыта (по умолчанию закрыта). */
  invite_enabled?: boolean;
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
