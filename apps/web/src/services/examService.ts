/**
 * ============================================
 *  examService.ts — Exam / ExamTicket API Service Layer
 * ============================================
 *
 * Все обращения к коллекциям `exams` и `exam_tickets`.
 *
 * Экзамен — singleton внутри курса, поэтому у него нет слага:
 * адрес экрана `/s/:sem/:course/exam`, а запись ищется по паре
 * курс + владелец (в базе на это стоит UNIQUE-индекс).
 *
 * Это первые коллекции проекта с owner-scoped правилами, так что
 * `owner` обязан проставляться на клиенте при создании — сервер
 * без него запись не примет.
 */

import { pb } from "../lib/pocketbase";
import type { Exam, ExamTicket, TicketStatus } from "../lib/types";
import type { UploadedImage } from "./lectureService";
import { FIELDS, ticketAttachmentNames, stripHtml } from "../lib/types";

/** Id текущего пользователя ("" — не залогинен). */
function currentUserId(): string {
  return String(pb.authStore.record?.id ?? "");
}

// ---------------------------------------------------------------------------
// Экзамен
// ---------------------------------------------------------------------------

/**
 * Экзамен курса текущего пользователя.
 *
 * @returns запись или `null`, когда экзамен ещё не заведён.
 *          Отсутствие экзамена — штатное состояние курса, а не
 *          ошибка, поэтому 404 гасится здесь, а не у вызывающего.
 */
export async function fetchExamByCourse(courseId: string): Promise<Exam | null> {
  if (!courseId) return null;
  try {
    return await pb
      .collection("exams")
      .getFirstListItem<Exam>(
        pb.filter(`${FIELDS.examCourse} = {:id}`, { id: courseId })
      );
  } catch {
    return null;
  }
}

/**
 * Ближайший экзамен пользователя с будущей датой — для блока на
 * дашборде. Один фильтрованный запрос вместо N (по экзамену на
 * каждый курс семестра): экран не должен множить обращения к базе
 * ради виджета, который может и не показаться (даты может не быть
 * ни у одного экзамена).
 */
export async function fetchUpcomingExam(now: Date = new Date()): Promise<Exam | null> {
  const userId = currentUserId();
  if (!userId) return null;
  const today = now.toISOString().slice(0, 10);
  try {
    return await pb.collection("exams").getFirstListItem<Exam>(
      pb.filter(
        `${FIELDS.examOwner} = {:owner} && ${FIELDS.examDate} != "" && ${FIELDS.examDate} >= {:today}`,
        { owner: userId, today }
      ),
      { sort: FIELDS.examDate, expand: FIELDS.examCourse }
    );
  } catch {
    return null;
  }
}

/**
 * Экзамены нескольких курсов одним запросом — для сводного экрана
 * «Все экзамены» семестра. OR-фильтр по уже известным id курсов
 * (`useCourses` их и так тянет для страницы), не dot-relation через
 * `course.semesters`: последнее нигде в проекте не проверялось
 * эмпирически, а такой OR-фильтр — да (curl к живой базе перед
 * реализацией). Скобки вокруг OR-группы обязательны: без них
 * `&&` свяжется только с последним условием, и фильтр начнёт
 * отдавать чужие экзамены.
 */
export async function fetchExamsForCourses(courseIds: string[]): Promise<Exam[]> {
  if (courseIds.length === 0) return [];
  const owner = currentUserId();
  if (!owner) return [];
  const courseFilter = courseIds
    .map((id) => `${FIELDS.examCourse}="${id}"`)
    .join(" || ");
  return pb.collection("exams").getFullList<Exam>({
    filter: `(${courseFilter}) && ${FIELDS.examOwner}="${owner}"`,
  });
}

/**
 * Билеты нескольких экзаменов одним запросом (тот же приём, что
 * `fetchExamsForCourses`). Вызывающий код группирует результат по
 * `t.exam` на клиенте — дешевле, чем по запросу на экзамен.
 */
export async function fetchTicketsForExams(examIds: string[]): Promise<ExamTicket[]> {
  if (examIds.length === 0) return [];
  const examFilter = examIds.map((id) => `${FIELDS.ticketExam}="${id}"`).join(" || ");
  return pb.collection("exam_tickets").getFullList<ExamTicket>({
    filter: examFilter,
    sort: FIELDS.ticketNumber,
  });
}

export interface ExamPayload {
  courseId: string;
  title?: string;
  /** ISO-дата или "" — поле необязательное. */
  examDate?: string;
}

/** Создать экзамен для курса. Владелец — текущий пользователь. */
export async function createExam(payload: ExamPayload): Promise<Exam> {
  const owner = currentUserId();
  if (!owner) throw new Error("Нужно войти, чтобы создать экзамен.");
  return pb.collection("exams").create<Exam>({
    [FIELDS.examCourse]: payload.courseId,
    [FIELDS.examTitle]: payload.title ?? "",
    [FIELDS.examDate]: payload.examDate ?? "",
    [FIELDS.examOwner]: owner,
    [FIELDS.examMode]: "solo",
  });
}

/** Обновить заголовок и дату экзамена. */
export async function updateExam(
  examId: string,
  patch: { title?: string; examDate?: string }
): Promise<Exam> {
  const data: Record<string, unknown> = {};
  if (patch.title !== undefined) data[FIELDS.examTitle] = patch.title;
  if (patch.examDate !== undefined) {
    data[FIELDS.examDate] = patch.examDate;
  }
  return pb.collection("exams").update<Exam>(examId, data);
}

/** Удалить экзамен. Билеты уходят каскадом (cascadeDelete на связи). */
export async function deleteExam(examId: string): Promise<void> {
  await pb.collection("exams").delete(examId);
}

// ---------------------------------------------------------------------------
// Билеты
// ---------------------------------------------------------------------------

/** Билеты экзамена по возрастанию номера. */
export async function fetchTickets(examId: string): Promise<ExamTicket[]> {
  if (!examId) return [];
  return pb.collection("exam_tickets").getFullList<ExamTicket>({
    filter: pb.filter(`${FIELDS.ticketExam} = {:id}`, { id: examId }),
    sort: FIELDS.ticketNumber,
  });
}

/** Один билет по id. */
export async function getTicket(ticketId: string): Promise<ExamTicket> {
  return pb.collection("exam_tickets").getOne<ExamTicket>(ticketId);
}

export interface TicketDraft {
  number: number;
  question: string;
}

/** Создать билет (пустой ответ, статус `empty`). */
export async function createTicket(
  examId: string,
  draft: TicketDraft
): Promise<ExamTicket> {
  return pb.collection("exam_tickets").create<ExamTicket>({
    [FIELDS.ticketExam]: examId,
    [FIELDS.ticketNumber]: draft.number,
    [FIELDS.ticketQuestion]: draft.question,
    [FIELDS.ticketAnswer]: "",
    [FIELDS.ticketStatus]: "empty",
  });
}

/**
 * Массовое создание билетов при импорте.
 *
 * Последовательно, а не `Promise.all`: PocketBase — локальный
 * SQLite, и полсотни параллельных вставок дают блокировки чаще,
 * чем выигрыш во времени. Тот же приём в `DeckEditorPage.save()`.
 *
 * @param onProgress — вызывается после каждой записи (для индикатора)
 */
export async function createTicketsBulk(
  examId: string,
  drafts: readonly TicketDraft[],
  onProgress?: (done: number, total: number) => void
): Promise<ExamTicket[]> {
  const created: ExamTicket[] = [];
  for (const draft of drafts) {
    created.push(await createTicket(examId, draft));
    onProgress?.(created.length, drafts.length);
  }
  return created;
}

/**
 * Статус по содержимому ответа.
 *
 * Пустой ответ всегда откатывает билет в `empty` — иначе можно
 * стереть текст и остаться с зелёной отметкой «готово».
 * Повышение до `ready` здесь не происходит: это осознанное
 * действие человека, а не следствие набора текста.
 */
export function statusForAnswer(
  answer: string,
  previous: TicketStatus
): TicketStatus {
  const hasText = stripHtml(answer).trim().length > 0;
  if (!hasText) return "empty";
  return previous === "ready" ? "ready" : "draft";
}

/** Сохранить билет (вопрос, ответ, статус, источники). */
export async function updateTicket(
  ticketId: string,
  patch: {
    question?: string;
    answer?: string;
    status?: TicketStatus;
    sources?: string[];
  }
): Promise<ExamTicket> {
  const data: Record<string, unknown> = {};
  if (patch.question !== undefined) data[FIELDS.ticketQuestion] = patch.question;
  if (patch.answer !== undefined) data[FIELDS.ticketAnswer] = patch.answer;
  if (patch.status !== undefined) data[FIELDS.ticketStatus] = patch.status;
  if (patch.sources !== undefined) data[FIELDS.ticketSources] = patch.sources;
  return pb.collection("exam_tickets").update<ExamTicket>(ticketId, data);
}

/** Удалить билет. */
export async function deleteTicket(ticketId: string): Promise<void> {
  await pb.collection("exam_tickets").delete(ticketId);
}

// ---------------------------------------------------------------------------
// Картинки в ответах — те же портативные токены `[[file:имя]]`
// ---------------------------------------------------------------------------

export type { UploadedImage } from "./lectureService";

/** Залить картинки в поле `attachments` билета. */
export async function uploadTicketImages(
  ticket: ExamTicket,
  files: File[]
): Promise<UploadedImage[]> {
  if (!files.length) return [];
  const fresh = await getTicket(ticket.id);
  const existing = ticketAttachmentNames(fresh);
  const updated = await pb
    .collection("exam_tickets")
    .update<ExamTicket>(fresh.id, {
      [FIELDS.ticketAttachments]: [...existing, ...files],
    });
  const next = ticketAttachmentNames(updated);
  const previous = new Set(existing);
  return next
    .filter((name) => !previous.has(name))
    .map((name) => ({ name, url: pb.files.getURL(updated, name) }));
}
