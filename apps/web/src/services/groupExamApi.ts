/**
 * ============================================
 *  groupExamApi.ts — экзамены группы, подгруппы, билеты подгруппы (волна C, этап 2)
 * ============================================
 *
 * Права держит сервер (`pb_hooks/exam_subgroups.pb.js, exam_tickets.pb.js`, правила коллекций): подгруппу и её
 * билеты видят только участники, блокировку «Занят» проверяет сервер. Чужие подгруппы
 * клиенту не отдаются вовсе, поэтому здесь нет ни их числа, ни названий.
 */

import { pb, currentUserId } from "../lib/pocketbase";
import type { ExamTicket, Lecture } from "../lib/types";
import { ticketAnswer } from "../lib/types";


export interface GroupExamRow {
  id: string;
  group: string;
  owner: string;
  /** Название предмета автора (предмет автора участникам не виден, его отдаёт сервер). */
  title: string;
  coverSeed: number;
  examDate: string;
  mySubgroup: { id: string; name: string } | null;
}

export interface GroupExamInfo {
  exam: GroupExamRow;
  /** Кто из участников группы уже состоит в какой-то подгруппе этого экзамена (без названий подгрупп). */
  taken: string[];
}

function toExam(r: Record<string, unknown>): GroupExamRow {
  const sg = r.my_subgroup as { id: string; name: string } | null;
  return {
    id: String(r.id),
    group: String(r.group),
    owner: String(r.owner),
    title: String(r.title ?? ""),
    coverSeed: Number(r.cover_seed ?? 0),
    examDate: String(r.exam_date ?? ""),
    mySubgroup: sg ? { id: sg.id, name: sg.name } : null,
  };
}

export async function fetchGroupExams(groupId: string): Promise<GroupExamRow[]> {
  const rows = await pb.send<Record<string, unknown>[]>(`/api/groups/${groupId}/exams`, { method: "GET" });
  return rows.map(toExam).sort((a, b) => (a.examDate || "9999").localeCompare(b.examDate || "9999"));
}

export async function fetchGroupExamInfo(examId: string): Promise<GroupExamInfo> {
  const r = await pb.send<{ exam: Record<string, unknown>; taken: string[] }>(`/api/exams/${examId}/group-info`, { method: "GET" });
  return { exam: toExam(r.exam), taken: r.taken };
}

/** Общий список билетов экзамена группы (без ответов: их другим не отдают). */
export async function fetchCommonTickets(examId: string): Promise<ExamTicket[]> {
  return pb.collection("exam_tickets").getFullList<ExamTicket>({
    filter: pb.filter("exam = {:x} && subgroup = ''", { x: examId }),
    sort: "number",
  });
}

export async function fetchSubgroupTickets(subgroupId: string): Promise<ExamTicket[]> {
  return pb.collection("exam_tickets").getFullList<ExamTicket>({
    filter: pb.filter("subgroup = {:s}", { s: subgroupId }),
    sort: "number",
  });
}

export interface SubgroupInfo {
  id: string;
  name: string;
  createdBy: string;
  members: string[];
}

export async function fetchMySubgroup(subgroupId: string): Promise<SubgroupInfo | null> {
  try {
    const sg = await pb.collection("exam_subgroups").getOne(subgroupId);
    const parts = await pb.collection("exam_participants").getFullList({
      filter: pb.filter("subgroup = {:s}", { s: subgroupId }),
      sort: "created",
    });
    return {
      id: sg.id,
      name: String(sg.name ?? ""),
      createdBy: String(sg.created_by ?? ""),
      members: parts.map((p) => String(p.user)),
    };
  } catch {
    return null;
  }
}

export async function createSubgroup(examId: string, name: string, members: string[]): Promise<{ id: string }> {
  return pb.send(`/api/exams/${examId}/subgroups`, { method: "POST", body: { name: name.trim(), members } });
}
export async function inviteToSubgroup(subgroupId: string, userId: string): Promise<void> {
  await pb.send(`/api/subgroups/${subgroupId}/members`, { method: "POST", body: { user: userId } });
}
export async function leaveSubgroup(subgroupId: string): Promise<void> {
  await pb.send(`/api/subgroups/${subgroupId}/leave`, { method: "POST" });
}
export async function addSubgroupTicket(subgroupId: string, question: string, answer = ""): Promise<{ id: string; number: number }> {
  return pb.send(`/api/subgroups/${subgroupId}/tickets`, { method: "POST", body: { question: question.trim(), answer: answer.trim() } });
}

/** Импорт списка: одна строка — один билет, номера идут после существующих билетов подгруппы (считает сервер). */
export async function importSubgroupTickets(subgroupId: string, questions: string[]): Promise<{ added: number; first: number }> {
  return pb.send(`/api/subgroups/${subgroupId}/tickets/bulk`, { method: "POST", body: { questions } });
}
export async function distributeTickets(subgroupId: string): Promise<number> {
  const r = await pb.send<{ assigned: number }>(`/api/subgroups/${subgroupId}/distribute`, { method: "POST" });
  return r.assigned;
}
export async function lockTicket(ticketId: string): Promise<{ ok: true; lockedUntil: string } | { ok: false; lockedBy: string }> {
  try {
    const r = await pb.send<{ locked_until: string }>(`/api/tickets/${ticketId}/lock`, { method: "POST" });
    return { ok: true, lockedUntil: r.locked_until };
  } catch (e) {
    const err = e as { status?: number; response?: { code?: string; locked_by?: string } };
    if (err.status === 409) return { ok: false, lockedBy: String(err.response?.locked_by ?? "") };
    throw e;
  }
}
export async function unlockTicket(ticketId: string): Promise<void> {
  await pb.send(`/api/tickets/${ticketId}/unlock`, { method: "POST" });
}
export async function takeMyAnswer(ticketId: string, sourceTicketId: string): Promise<{ ok: boolean; busy?: boolean }> {
  try {
    await pb.send(`/api/tickets/${ticketId}/take-my-answer`, { method: "POST", body: { source: sourceTicketId } });
    return { ok: true };
  } catch (e) {
    if ((e as { status?: number }).status === 409) return { ok: false, busy: true };
    throw e;
  }
}

/** Личный экзамен того же предмета (по названию без регистра) и его билет с тем же номером — источник для «Взять мой ответ». */
export async function findMyAnswerSource(subjectTitle: string, ticketNumber: number): Promise<{ id: string; answer: string } | null> {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const exams = await pb.collection("exams").getFullList({
    filter: pb.filter("owner = {:u} && group = ''", { u: currentUserId() }),
    expand: "course",
  });
  const mine = exams.find((x) => norm(String((x.expand as { course?: { name?: string } } | undefined)?.course?.name ?? "")) === norm(subjectTitle));
  if (!mine) return null;
  const rows = await pb.collection("exam_tickets").getFullList<ExamTicket>({
    filter: pb.filter("exam = {:x} && subgroup = '' && number = {:n}", { x: mine.id, n: ticketNumber }),
  });
  const t = rows[0];
  if (!t) return null;
  const answer = ticketAnswer(t);
  return answer.replace(/<[^>]*>/g, "").trim() ? { id: t.id, answer } : null;
}

/** Групповой экзамен с тем же названием предмета, где состоит человек (для подсказки в форме «Новый экзамен»). */
export async function fetchGroupMatches(courseId: string): Promise<{ exam: string; group: string; title: string }[]> {
  return pb.send(`/api/exams/group-match`, { method: "GET", query: { course: courseId } });
}

export async function joinGroupExam(myExamId: string, groupExamId: string): Promise<number> {
  const r = await pb.send<{ added: number }>(`/api/exams/${myExamId}/join-group`, { method: "POST", body: { exam: groupExamId } });
  return r.added;
}

/** Мои лекции для окна привязки к билету («Мои»), с предметом. */
export async function fetchMyLecturesForPicker(): Promise<Lecture[]> {
  return pb.collection("lectures").getFullList<Lecture>({
    filter: pb.filter("owner = {:u} && deleted_at = ''", { u: currentUserId() }),
    expand: "field",
    sort: "-updated",
  });
}

/** Лекции по id, которые я вижу (мои и открытые мне); закрытые в ответ не попадают. */
export async function fetchVisibleLectures(ids: string[]): Promise<Lecture[]> {
  if (ids.length === 0) return [];
  return pb.collection("lectures").getFullList<Lecture>({
    filter: ids.map((id) => pb.filter("id = {:i}", { i: id })).join(" || "),
    expand: "field",
  });
}
