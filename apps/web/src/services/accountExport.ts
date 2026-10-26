/**
 * ============================================
 *  accountExport.ts — выгрузка своих данных архивом (B6)
 * ============================================
 *
 * Собирается в браузере, на сервер ничего не уходит. В архиве: папки по
 * предметам с лекциями в Markdown, а таблицы CSV — задачи, расписание,
 * билеты и карточки. Лекции из корзины не попадают.
 */

import { htmlToMarkdown, toCsv } from "../lib/htmlToMarkdown";
import { pb } from "../lib/pocketbase";
import { pbDateOnly } from "../lib/localDate";
import { buildZip, safeFileName, textBytes, type ZipEntry } from "../lib/zipStore";

const WEEKDAYS = ["", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
const PARITY: Record<string, string> = { any: "каждую неделю", odd: "нечётная", even: "чётная" };
const KIND: Record<string, string> = { lecture: "лекция", seminar: "семинар", lab: "лабораторная", other: "другое" };
const STATUS: Record<string, string> = { empty: "пусто", draft: "черновик", ready: "готов" };

type Row = Record<string, unknown>;

function plain(html: unknown): string {
  const s = String(html ?? "");
  if (!s.trim()) return "";
  const doc = new DOMParser().parseFromString(`<body>${s}</body>`, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+\n/g, "\n").trim();
}

/** Не повторять имя файла в одной папке: «Лекция», «Лекция (2)». */
function uniquePath(taken: Set<string>, folder: string, name: string, ext: string): string {
  let n = 1;
  let path = `${folder}/${name}.${ext}`;
  while (taken.has(path)) {
    n += 1;
    path = `${folder}/${name} (${n}).${ext}`;
  }
  taken.add(path);
  return path;
}

/** Собрать все данные в файлы архива. */
async function collectExport(onProgress?: (done: number, total: number) => void): Promise<ZipEntry[]> {
  const uid = String(pb.authStore.record?.id ?? "");
  if (!uid) throw new Error("Нужно войти.");
  const own = pb.filter("owner = {:u}", { u: uid });
  const steps = 6;
  let done = 0;
  const tick = () => onProgress?.(++done, steps);

  const courses = await pb.collection("courses").getFullList<Row>({ filter: own });
  tick();
  const courseName = new Map(courses.map((c) => [String(c.id), String(c.name ?? "")]));
  const lectures = await pb.collection("lectures").getFullList<Row>({ filter: own, sort: "created" });
  tick();
  const tasks = await pb.collection("tasks").getFullList<Row>({ filter: own, sort: "due" });
  tick();
  const slots = await pb.collection("schedule_slots").getFullList<Row>({ filter: own });
  tick();
  const tickets = await pb
    .collection("exam_tickets")
    .getFullList<Row>({ filter: pb.filter("exam.owner = {:u}", { u: uid }), expand: "exam", sort: "number" })
    .catch(() => [] as Row[]);
  tick();
  const decks = await pb.collection("decks").getFullList<Row>({ filter: own }).catch(() => [] as Row[]);
  const cards: Row[] = decks.length
    ? await pb
        .collection("deck_cards")
        .getFullList<Row>({ filter: decks.map((d) => pb.filter("deck = {:d}", { d: d.id })).join(" || "), sort: "position" })
        .catch(() => [] as Row[])
    : [];
  tick();

  const files: ZipEntry[] = [];
  const taken = new Set<string>();

  for (const l of lectures) {
    const folder = safeFileName(courseName.get(String(l.field ?? "")) ?? "", "Черновики");
    const title = String(l.title ?? "") || "Без названия";
    const date = pbDateOnly(String(l.lecture_date ?? ""));
    const md = `# ${title}\n\n${date ? `Дата: ${date}\n\n` : ""}${htmlToMarkdown(String(l.content ?? ""))}`;
    files.push({ path: uniquePath(taken, folder, safeFileName(title), "md"), data: textBytes(md) });
  }

  files.push({
    path: "Задачи.csv",
    data: textBytes(
      toCsv(
        ["Задача", "Предмет", "Срок", "Выполнено"],
        tasks.map((t) => [t.title, courseName.get(String(t.subject ?? "")) ?? "", pbDateOnly(String(t.due ?? "")), pbDateOnly(String(t.done_at ?? ""))])
      )
    ),
  });

  files.push({
    path: "Расписание.csv",
    data: textBytes(
      toCsv(
        ["День", "Пара", "Неделя", "Тип", "Предмет", "Аудитория", "Преподаватель"],
        slots.map((s) => [
          WEEKDAYS[Number(s.weekday)] ?? s.weekday,
          s.pair_number,
          PARITY[String(s.week_parity ?? "any")] ?? "",
          KIND[String(s.kind ?? "")] ?? "",
          courseName.get(String(s.subject ?? "")) ?? "",
          s.room,
          s.teacher,
        ])
      )
    ),
  });

  files.push({
    path: "Билеты.csv",
    data: textBytes(
      toCsv(
        ["Предмет", "Номер", "Вопрос", "Статус", "Ответ"],
        tickets.map((t) => {
          const ex = (t.expand as { exam?: Row } | undefined)?.exam;
          return [courseName.get(String(ex?.course ?? "")) ?? "", t.number, t.question, STATUS[String(t.status ?? "")] ?? "", plain(t.answer)];
        })
      )
    ),
  });

  const deckTaken = new Set<string>();
  for (const d of decks) {
    const rows = cards.filter((c) => c.deck === d.id).map((c) => [plain(c.front), plain(c.back)]);
    files.push({
      path: uniquePath(deckTaken, "Карточки", safeFileName(String(d.title ?? ""), "Колода"), "csv"),
      data: textBytes(toCsv(["Лицо", "Оборот"], rows)),
    });
  }
  return files;
}

/** Собрать архив и скачать его. */
export async function exportAccountZip(onProgress?: (done: number, total: number) => void): Promise<void> {
  const files = await collectExport(onProgress);
  const zip = buildZip(files);
  const blob = new Blob([zip as BlobPart], { type: "application/zip" });
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = URL.createObjectURL(blob);
  a.download = `cohorta-export-${stamp}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
