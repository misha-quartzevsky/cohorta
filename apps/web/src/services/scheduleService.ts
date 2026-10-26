/**
 * ============================================
 *  scheduleService.ts — расписание (spec раздел 4)
 * ============================================
 * Коллекции schedule_settings и schedule_slots, плюс действие
 * «Начать конспект» (идемпотентное создание лекции для пары).
 */

import { pb, currentUserId } from "../lib/pocketbase";
import type {
  ScheduleSettings,
  ScheduleSlot,
  ScheduleSlotLecture,
  Lecture,
  PairTime,
} from "../lib/types";
import { FIELDS } from "../lib/types";
import { slugify } from "../lib/slugify";
import { uniqueSlugForCollection } from "./genericService";
import { mondayOf, toDateStr, pbDateOnly } from "../lib/localDate";
import { findLectureForOccurrence } from "../lib/weekParity";

/** См. taskService.normalizeTask: PocketBase отдаёт `date` полным ISO. */
function normalizeSettings(s: ScheduleSettings): ScheduleSettings {
  return { ...s, odd_week_anchor: pbDateOnly(s.odd_week_anchor) };
}
function normalizeSlot(s: ScheduleSlot): ScheduleSlot {
  return {
    ...s,
    date_from: s.date_from ? pbDateOnly(s.date_from) : s.date_from,
    date_to: s.date_to ? pbDateOnly(s.date_to) : s.date_to,
  };
}
function normalizeLecture(l: Lecture): Lecture {
  return l.lecture_date ? { ...l, lecture_date: pbDateOnly(l.lecture_date) } : l;
}

/** Значения по умолчанию для времени пар (spec 2.1). */
const DEFAULT_PAIR_TIMES: PairTime[] = [
  { n: 1, start: "09:00", end: "10:30" },
  { n: 2, start: "10:40", end: "12:10" },
  { n: 3, start: "12:40", end: "14:10" },
  { n: 4, start: "14:20", end: "15:50" },
  { n: 5, start: "16:00", end: "17:30" },
];

/** Настройки расписания пользователя или null, если ещё не созданы. */
async function fetchSettings(): Promise<ScheduleSettings | null> {
  try {
    const s = await pb
      .collection("schedule_settings")
      .getFirstListItem<ScheduleSettings>(
        `${FIELDS.scheduleOwner}="${currentUserId()}"`
      );
    return normalizeSettings(s);
  } catch {
    return null;
  }
}

/** Создать настройки со значениями по умолчанию (spec 2.1). */
async function createDefaultSettings(): Promise<ScheduleSettings> {
  const anchor = toDateStr(mondayOf(new Date()));
  const created = await pb.collection("schedule_settings").create<ScheduleSettings>({
    [FIELDS.scheduleOwner]: currentUserId(),
    [FIELDS.schedulePairTimes]: DEFAULT_PAIR_TIMES,
    [FIELDS.scheduleOddAnchor]: anchor,
    [FIELDS.scheduleShowSaturday]: true,
  });
  return normalizeSettings(created);
}

/** Получить настройки, создавая строку по умолчанию при первом заходе. */
export async function ensureSettings(): Promise<ScheduleSettings> {
  const existing = await fetchSettings();
  if (existing) return existing;
  return createDefaultSettings();
}

export async function updateSettings(
  id: string,
  patch: Partial<Pick<ScheduleSettings, "pair_times" | "odd_week_anchor" | "show_saturday">>
): Promise<ScheduleSettings> {
  const payload: Record<string, unknown> = {};
  if (patch.pair_times !== undefined)
    payload[FIELDS.schedulePairTimes] = patch.pair_times;
  if (patch.odd_week_anchor !== undefined)
    payload[FIELDS.scheduleOddAnchor] = patch.odd_week_anchor;
  if (patch.show_saturday !== undefined)
    payload[FIELDS.scheduleShowSaturday] = patch.show_saturday;
  const updated = await pb
    .collection("schedule_settings")
    .update<ScheduleSettings>(id, payload);
  return normalizeSettings(updated);
}

/** Все слоты пользователя (опционально одного семестра). */
export async function fetchSlots(semesterId?: string): Promise<ScheduleSlot[]> {
  const items = await pb.collection("schedule_slots").getFullList<ScheduleSlot>({
    filter: semesterId ? `${FIELDS.slotSemester}="${semesterId}"` : "",
    expand: FIELDS.slotSubject,
    sort: `${FIELDS.slotWeekday},${FIELDS.slotPairNumber}`,
  });
  return items.map(normalizeSlot);
}

export interface SlotInput {
  subject: string;
  weekday: number;
  pair_number: number;
  week_parity?: string;
  kind?: string;
  room?: string;
  teacher?: string;
  semester?: string;
}

export async function createSlot(input: SlotInput): Promise<ScheduleSlot> {
  const payload: Record<string, unknown> = {
    [FIELDS.slotOwner]: currentUserId(),
    [FIELDS.slotSubject]: input.subject,
    [FIELDS.slotWeekday]: input.weekday,
    [FIELDS.slotPairNumber]: input.pair_number,
    [FIELDS.slotWeekParity]: input.week_parity ?? "any",
    [FIELDS.slotKind]: input.kind ?? "lecture",
  };
  if (input.room) payload[FIELDS.slotRoom] = input.room;
  if (input.teacher) payload[FIELDS.slotTeacher] = input.teacher;
  if (input.semester) payload[FIELDS.slotSemester] = input.semester;
  const created = await pb.collection("schedule_slots").create<ScheduleSlot>(payload);
  return normalizeSlot(created);
}

export async function updateSlot(
  id: string,
  input: Partial<SlotInput>
): Promise<ScheduleSlot> {
  const payload: Record<string, unknown> = {};
  if (input.subject !== undefined) payload[FIELDS.slotSubject] = input.subject;
  if (input.weekday !== undefined) payload[FIELDS.slotWeekday] = input.weekday;
  if (input.pair_number !== undefined)
    payload[FIELDS.slotPairNumber] = input.pair_number;
  if (input.week_parity !== undefined)
    payload[FIELDS.slotWeekParity] = input.week_parity;
  if (input.kind !== undefined) payload[FIELDS.slotKind] = input.kind;
  if (input.room !== undefined) payload[FIELDS.slotRoom] = input.room;
  if (input.teacher !== undefined) payload[FIELDS.slotTeacher] = input.teacher;
  if (input.semester !== undefined) payload[FIELDS.slotSemester] = input.semester;
  const updated = await pb
    .collection("schedule_slots")
    .update<ScheduleSlot>(id, payload);
  return normalizeSlot(updated);
}

export async function deleteSlot(id: string): Promise<void> {
  await pb.collection("schedule_slots").delete(id);
}

/**
 * «Начать конспект» (spec 4.3). Идемпотентно: если лекция для пары уже
 * есть, возвращаем её; иначе создаём «Лекция N» (N = max number + 1).
 */
export async function startNoteForSlot(
  slot: ScheduleSlot,
  dateStr: string,
  lecturesOfSubject: Lecture[]
): Promise<Lecture> {
  const existing = findLectureForOccurrence(slot, dateStr, lecturesOfSubject);
  if (existing) return existing;

  const maxNumber = lecturesOfSubject.reduce(
    (max, l) => (typeof l.number === "number" && l.number > max ? l.number : max),
    0
  );
  const number = maxNumber + 1;
  const title = `Лекция ${number}`;

  const created = await pb.collection("lectures").create<Lecture>({
    [FIELDS.lectureTitle]: title,
    [FIELDS.lectureContent]: "",
    [FIELDS.lectureCourse]: slot.subject,
    [FIELDS.lectureOwner]: currentUserId(),
    [FIELDS.lectureSlot]: slot.id,
    [FIELDS.lectureDate]: dateStr,
    [FIELDS.lectureNumber]: number,
    [FIELDS.lectureSlug]: await uniqueSlugForCollection(
      "lectures",
      FIELDS.lectureSlug,
      slugify(title) || "lecture"
    ),
  });
  return normalizeLecture(created);
}

/**
 * «Новая лекция» со страницы предмета: «Лекция N» (N = max number + 1) с
 * сегодняшней датой, без привязки к паре.
 */
export async function createLectureInSubject(
  subjectId: string,
  lecturesOfSubject: Lecture[],
  dateStr: string
): Promise<Lecture> {
  const maxNumber = lecturesOfSubject.reduce(
    (max, l) => (typeof l.number === "number" && l.number > max ? l.number : max),
    0
  );
  const number = maxNumber + 1;
  const title = `Лекция ${number}`;
  const created = await pb.collection("lectures").create<Lecture>({
    [FIELDS.lectureTitle]: title,
    [FIELDS.lectureContent]: "",
    [FIELDS.lectureCourse]: subjectId,
    [FIELDS.lectureOwner]: currentUserId(),
    [FIELDS.lectureDate]: dateStr,
    [FIELDS.lectureNumber]: number,
    [FIELDS.lectureSlug]: await uniqueSlugForCollection(
      "lectures",
      FIELDS.lectureSlug,
      slugify(title) || "lecture"
    ),
  });
  return normalizeLecture(created);
}

/** Лекции предмета (для привязки к парам). */
export async function fetchLecturesOfSubject(
  subjectId: string
): Promise<Lecture[]> {
  const items = await pb.collection("lectures").getFullList<Lecture>({
    filter: `${FIELDS.lectureCourse}="${subjectId}"`,
    sort: "-created",
  });
  return items.map(normalizeLecture);
}

/** Все лекции пользователя, привязанные к паре (slot задан). */
export async function fetchScheduledLectures(): Promise<Lecture[]> {
  const items = await pb.collection("lectures").getFullList<Lecture>({
    filter: `${FIELDS.lectureSlot}!=""`,
    sort: "-lecture_date",
  });
  return items.map(normalizeLecture);
}

/**
 * Лекции, прикреплённые к парам постфактум («Добавить конспект»,
 * schedule_slot_lectures) — отдельно от lectures.slot/lecture_date
 * (это «родная» пара лекции, создаётся через «Начать конспект»).
 * Одна лекция может быть в нескольких строках (разные слот+дата).
 */
export async function fetchSlotLectureLinks(): Promise<ScheduleSlotLecture[]> {
  const items = await pb.collection("schedule_slot_lectures").getFullList<ScheduleSlotLecture>({
    expand: FIELDS.slotLectureLecture,
    sort: "-created",
  });
  return items.map((l) => ({ ...l, date: pbDateOnly(l.date) }));
}

/** Прикрепить существующую лекцию к паре на конкретную дату. */
export async function createSlotLectureLink(
  slotId: string,
  lectureId: string,
  dateStr: string
): Promise<ScheduleSlotLecture> {
  const created = await pb.collection("schedule_slot_lectures").create<ScheduleSlotLecture>(
    {
      [FIELDS.slotLectureOwner]: currentUserId(),
      [FIELDS.slotLectureSlot]: slotId,
      [FIELDS.slotLectureLecture]: lectureId,
      [FIELDS.slotLectureDate]: dateStr,
    },
    { expand: FIELDS.slotLectureLecture }
  );
  return { ...created, date: pbDateOnly(created.date) };
}

export async function deleteSlotLectureLink(id: string): Promise<void> {
  await pb.collection("schedule_slot_lectures").delete(id);
}
