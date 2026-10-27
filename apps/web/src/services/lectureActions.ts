/**
 * Действия меню лекции (Screen-lecture-menu): переименовать, перенести в
 * предмет, дублировать, скачать .md. Удаление — `deleteLecture` (корзина).
 */

import { pb, currentUserId } from "../lib/pocketbase";
import type { Lecture } from "../lib/types";
import { FIELDS, lectureTitle } from "../lib/types";
import { slugify } from "../lib/slugify";
import { htmlToMarkdown } from "../lib/htmlToMarkdown";
import { uniqueSlugForCollection } from "./genericService";
import { notifyLecturesChanged } from "../lib/lecturesChanged";

export async function renameLecture(id: string, title: string): Promise<Lecture> {
  const updated = await pb.collection("lectures").update<Lecture>(id, { [FIELDS.lectureTitle]: title });
  notifyLecturesChanged();
  return updated;
}

/** Перенести в предмет; "" — снять предмет (откат переноса из «Черновиков»). */
export async function moveLecture(id: string, courseId: string): Promise<Lecture> {
  const patch: Record<string, unknown> = { [FIELDS.lectureCourse]: courseId };
  // Черновик получает место в предмете: следующий номер, а «Лекция N» в названии переименовывается вслед.
  if (courseId) {
    const before = await pb.collection("lectures").getOne<Lecture>(id);
    if (!before.field) {
      const inCourse = await pb.collection("lectures").getFullList<Lecture>({
        filter: pb.filter(`${FIELDS.lectureCourse} = {:c}`, { c: courseId }),
        fields: "number",
      });
      const next = inCourse.reduce((m, l) => (typeof l.number === "number" && l.number > m ? l.number : m), 0) + 1;
      patch[FIELDS.lectureNumber] = next;
      if (typeof before.number === "number" && lectureTitle(before) === `Лекция ${before.number}`) {
        patch[FIELDS.lectureTitle] = `Лекция ${next}`;
      }
    }
  }
  const updated = await pb.collection("lectures").update<Lecture>(id, patch);
  notifyLecturesChanged();
  return updated;
}

/** Копия в том же предмете с названием «… (копия)», без доступов и квиза. */
export async function duplicateLecture(source: Lecture): Promise<Lecture> {
  const title = `${lectureTitle(source)} (копия)`;
  const payload: Record<string, unknown> = {
    [FIELDS.lectureTitle]: title,
    [FIELDS.lectureContent]: source.content ?? "",
    [FIELDS.lectureOwner]: currentUserId(),
    [FIELDS.lectureSlug]: await uniqueSlugForCollection("lectures", FIELDS.lectureSlug, slugify(title) || "lecture"),
  };
  if (source.field) payload[FIELDS.lectureCourse] = source.field;
  if (source.lecture_date) payload[FIELDS.lectureDate] = String(source.lecture_date).slice(0, 10);
  const created = await pb.collection("lectures").create<Lecture>(payload);
  notifyLecturesChanged();
  return created;
}

/** Имя файла для скачивания: название без символов, запрещённых в именах файлов. */
export function markdownFileName(title: string): string {
  const base = title.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || "lecture";
  return `${base}.md`;
}

/** Отдать лекцию файлом Markdown. */
export function downloadLectureMarkdown(lecture: Lecture): void {
  const text = `# ${lectureTitle(lecture)}\n\n${htmlToMarkdown(lecture.content ?? "")}`;
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = markdownFileName(lectureTitle(lecture));
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Число слов в HTML лекции (для «240 слов» в черновиках). */
export function wordCount(html: string | undefined): number {
  const text = (html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();
  return text ? text.split(/\s+/).length : 0;
}
