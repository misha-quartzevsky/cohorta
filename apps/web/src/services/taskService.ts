/**
 * ============================================
 *  taskService.ts — задачи (spec раздел 5)
 * ============================================
 */

import { pb, currentUserId } from "../lib/pocketbase";
import type { Task, TaskSource } from "../lib/types";
import { FIELDS } from "../lib/types";
import { todayStr, pbDateOnly } from "../lib/localDate";

/**
 * PocketBase отдаёт `due`/`done_at` полным ISO-datetime, хотя хранится
 * дата без времени (см. pbDateOnly). Нормализуем сразу при чтении, чтобы
 * строковые сравнения (`due === today`) и группировка работали.
 */
function normalizeTask(t: Task): Task {
  return { ...t, due: pbDateOnly(t.due), done_at: pbDateOnly(t.done_at) };
}

/** Все задачи пользователя (открытые и выполненные), с раскрытыми связями. */
export async function fetchTasks(): Promise<Task[]> {
  const items = await pb.collection("tasks").getFullList<Task>({
    expand: `${FIELDS.taskSubject},${FIELDS.taskLecture}`,
    sort: "-created",
  });
  return items.map(normalizeTask);
}

export interface TaskInput {
  title: string;
  subject?: string | null;
  lecture?: string | null;
  due?: string | null;
  source?: TaskSource;
  dedupe_key?: string;
  done_at?: string | null;
  dismissed?: boolean;
}

export async function createTask(input: TaskInput): Promise<Task> {
  const payload: Record<string, unknown> = {
    [FIELDS.taskOwner]: currentUserId(),
    [FIELDS.taskTitle]: input.title,
    [FIELDS.taskSource]: input.source ?? "manual",
  };
  if (input.subject) payload[FIELDS.taskSubject] = input.subject;
  if (input.lecture) payload[FIELDS.taskLecture] = input.lecture;
  if (input.due) payload[FIELDS.taskDue] = input.due;
  if (input.done_at) payload[FIELDS.taskDoneAt] = input.done_at;
  if (input.dedupe_key) payload[FIELDS.taskDedupeKey] = input.dedupe_key;
  if (input.dismissed) payload[FIELDS.taskDismissed] = true;
  const created = await pb.collection("tasks").create<Task>(payload, {
    expand: `${FIELDS.taskSubject},${FIELDS.taskLecture}`,
  });
  return normalizeTask(created);
}

export async function updateTask(
  id: string,
  patch: Partial<TaskInput>
): Promise<Task> {
  const payload: Record<string, unknown> = {};
  if (patch.title !== undefined) payload[FIELDS.taskTitle] = patch.title;
  // Пустая строка в relation очищает связь в PocketBase.
  if (patch.subject !== undefined) payload[FIELDS.taskSubject] = patch.subject ?? "";
  if (patch.lecture !== undefined) payload[FIELDS.taskLecture] = patch.lecture ?? "";
  if (patch.due !== undefined) payload[FIELDS.taskDue] = patch.due ?? "";
  if (patch.done_at !== undefined) payload[FIELDS.taskDoneAt] = patch.done_at ?? "";
  const updated = await pb.collection("tasks").update<Task>(id, payload, {
    expand: `${FIELDS.taskSubject},${FIELDS.taskLecture}`,
  });
  return normalizeTask(updated);
}

/** Отметить выполненной/открытой: done_at = today или пусто. */
export async function setTaskDone(id: string, done: boolean): Promise<Task> {
  return updateTask(id, { done_at: done ? todayStr() : null });
}

export async function deleteTask(id: string): Promise<void> {
  await pb.collection("tasks").delete(id);
}

/** Создать задачу из лекции (spec 5.4): title обрезан, связана с лекцией. */
export async function createTaskFromLecture(
  text: string,
  lectureId: string,
  subjectId: string | null
): Promise<Task> {
  const title = truncateAtWord(text, 120);
  return createTask({
    title,
    lecture: lectureId,
    subject: subjectId,
    source: "lecture",
  });
}

/** Обрезать по границе слова до max символов, без переносов строк. */
function truncateAtWord(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const slice = flat.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).trim();
}
