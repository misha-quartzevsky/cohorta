/**
 * ============================================
 *  seed-screenshots.ts — richer demo dataset for the design-review
 *  screenshot pass (docs/screenshots/).
 * ============================================
 *
 * One-off / dev tool — NOT wired into package.json. Run manually from
 * apps/web with PocketBase already running on 127.0.0.1:8090:
 *
 *   node scripts/seed-screenshots.ts
 *
 * Seeds the existing demo account (asyaobraz17@gmail.com / 12345678,
 * see tests/helpers.ts) with:
 *  - 4 courses, 12 lectures across them with varying readiness
 *    (some with no notes/empty, some with quiz history so the
 *    readiness badge differs)
 *  - a cached quiz (quiz + quiz_questions) for one lecture, keyed by
 *    the same sha256(normalizeText(extractText(html))) hash the
 *    frontend computes, so QuizPage finds it in cache and never
 *    calls the (unavailable in dev) Cloudflare generation function
 *  - a second exam (course #2) with varied ticket statuses
 *  - schedule_settings + schedule_slots (some linked to a lecture via
 *    slot+lecture_date, most not)
 *  - tasks covering overdue / due today / later / auto-generated
 *
 * Idempotent-ish: re-running will create duplicate rows for the new
 * additions below (it does NOT upsert by slug the way seed.ts does),
 * so only run it once against a fresh PocketBase, or wipe pb_data
 * between runs if you need a clean slate.
 */

import PocketBase from "pocketbase";
import { createHash } from "node:crypto";

const PB_URL = process.env.PB_URL ?? "http://127.0.0.1:8090";
const DEMO_EMAIL = "asyaobraz17@gmail.com";
const DEMO_PASSWORD = "12345678";

function log(msg: string) {
  console.log(`[seed-screenshots] ${msg}`);
}

function para(text: string): string {
  return `<p>${text}</p>`;
}
function h1(text: string): string {
  return `<h1>${text}</h1>`;
}
function h2(text: string): string {
  return `<h2>${text}</h2>`;
}
function math(latex: string): string {
  return `<div data-type="math-block" data-latex="${latex}"></div>`;
}

// --- text-extraction / hashing, mirrors src/lib/extractText.ts + sha256.ts ---
const BLOCK_CLOSE_TO_NEWLINE = /<\/(p|h1|h2|h3|h4|h5|h6|li|div|tr|blockquote|pre)\s*>/gi;
const BR_TO_NEWLINE = /<br\s*\/?>/gi;
const SCRIPT_STYLE = /<(script|style)[^>]*>[\s\S]*?<\/\1>/gi;
const ANY_TAG = /<[^>]+>/g;
const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'",
  nbsp: " ", laquo: "«", raquo: "»", mdash: "—", ndash: "–", hellip: "…",
};
function decodeEntities(s: string): string {
  return s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+\d*);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const codePoint = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}
function extractText(html: string | null | undefined): string {
  if (!html) return "";
  let s = html.replace(SCRIPT_STYLE, " ");
  s = s.replace(BR_TO_NEWLINE, "\n");
  s = s.replace(BLOCK_CLOSE_TO_NEWLINE, "\n");
  s = s.replace(ANY_TAG, "");
  s = decodeEntities(s);
  s = s.split("\n").map((line) => line.replace(/[ \t ]+/g, " ").trim()).filter((l) => l.length > 0).join("\n");
  return s.trim();
}
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[«»"""]/g, "").replace(/\s+/g, " ").trim();
}
function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function todayStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}
function mondayOf(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0 Sun..6 Sat
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

// ---------------------------------------------------------------------------
// Data: 4 courses (2 already exist from seed.ts: math-analysis, physics)
// ---------------------------------------------------------------------------

const EXTRA_COURSES = [
  { name: "История России", color: "#F2A65A", slug: "russian-history" },
  { name: "Философия", color: "#6FCF97", slug: "philosophy" },
];

interface SeedLecture {
  title: string;
  slug: string;
  courseSlug: string;
  html: string;
}

const EXTRA_LECTURES: SeedLecture[] = [
  {
    title: "Великое переселение и формирование Руси",
    slug: "rus-formation",
    courseSlug: "russian-history",
    html:
      h1("Великое переселение и формирование Руси") +
      para("Образование Древнерусского государства связывают с объединением северных и южных восточнославянских союзов племён под властью варяжских князей.") +
      h2("Путь «из варяг в греки»") +
      para("Торговый путь по Днепру связал Балтику и Чёрное море, вокруг него выросли ключевые города — Новгород, Смоленск, Киев."),
  },
  {
    title: "Крещение Руси",
    slug: "rus-baptism",
    courseSlug: "russian-history",
    html:
      h1("Крещение Руси") +
      para("В 988 году князь Владимир Святославич принял христианство по византийскому обряду и крестил Киев.") +
      h2("Последствия") +
      para("Принятие единой религии укрепило центральную власть и открыло путь к византийской культуре и письменности."),
  },
  {
    title: "Монгольское завоевание",
    slug: "mongol-conquest",
    courseSlug: "russian-history",
    html: h1("Монгольское завоевание") + para(""),
  },
  {
    title: "Смутное время",
    slug: "time-of-troubles",
    courseSlug: "russian-history",
    html: "",
  },
  {
    title: "Античная философия",
    slug: "ancient-philosophy",
    courseSlug: "philosophy",
    html:
      h1("Античная философия") +
      para("Философия как самостоятельная форма знания зародилась в Древней Греции в VI веке до н.э.") +
      h2("Милетская школа") +
      para("Фалес, Анаксимандр и Анаксимен искали единое первоначало (архэ) всего существующего — воду, апейрон, воздух.") +
      h2("Сократ и майевтика") +
      para("Сократ утверждал, что истина рождается в диалоге через последовательные вопросы — этот метод назвали майевтикой.") +
      math("S = \\{x \\mid x \\text{ истинно}\\}"),
  },
  {
    title: "Немецкая классическая философия",
    slug: "german-classical-philosophy",
    courseSlug: "philosophy",
    html:
      h1("Немецкая классическая философия") +
      para("Кант, Фихте, Шеллинг и Гегель выстроили системы, в центре которых — разум, свобода и диалектическое развитие духа.") +
      h2("Категорический императив Канта") +
      para("Поступай только согласно такой максиме, руководствуясь которой ты в то же время можешь желать, чтобы она стала всеобщим законом."),
  },
  {
    title: "Экзистенциализм",
    slug: "existentialism",
    courseSlug: "philosophy",
    html: h1("Экзистенциализм") + para("Черновик — дописать про Сартра и Камю."),
  },
  {
    title: "Философия всеединства",
    slug: "all-unity-philosophy",
    courseSlug: "philosophy",
    html: "",
  },
];

// Second exam (course #2 = philosophy) — reuse style of seed.ts's exam.
const PHIL_TICKETS: Array<{ number: number; question: string; status: "empty" | "draft" | "ready"; answer?: string }> = [
  { number: 1, status: "ready", question: "Милетская школа: архэ как первоначало сущего.", answer: para("Фалес, Анаксимандр, Анаксимен искали единую материальную первопричину мира.") },
  { number: 2, status: "ready", question: "Майевтика Сократа и сократический диалог.", answer: para("Метод последовательных вопросов, который выводит собеседника к самостоятельно найденной истине.") },
  { number: 3, status: "draft", question: "Категорический императив И. Канта.", answer: para("Черновик: поступай так, чтобы максима твоей воли могла стать всеобщим законом…") },
  { number: 4, status: "empty", question: "Диалектика Г.В.Ф. Гегеля: тезис, антитезис, синтез." },
  { number: 5, status: "empty", question: "Экзистенциализм Ж.-П. Сартра: существование предшествует эссенции." },
];

async function upsertCollectionBySlug(
  pb: PocketBase,
  collection: string,
  slug: string,
  payload: Record<string, unknown>,
  slugField = "slug"
): Promise<{ id: string }> {
  const existing = (
    await pb.collection(collection).getFullList<{ id: string }>({
      filter: `${slugField} = "${slug}"`,
      perPage: 1,
      fields: "id",
    })
  )[0];
  if (existing) {
    await pb.collection(collection).update(existing.id, payload);
    return existing;
  }
  return pb.collection(collection).create<{ id: string }>(payload);
}

async function main() {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  await pb.health.check();
  log("PocketBase reachable.");

  const user = (await pb.collection("users").authWithPassword(DEMO_EMAIL, DEMO_PASSWORD)).record;
  log(`Authenticated as demo user (${user.id}).`);

  const semester = (
    await pb.collection("semesters").getFullList<{ id: string }>({ filter: 'slug = "demo"', perPage: 1 })
  )[0];
  if (!semester) throw new Error('Run `npm run seed` first (semester "demo" missing).');

  // 1. Extra courses
  const courseIds: Record<string, string> = {};
  for (const c of EXTRA_COURSES) {
    const rec = await upsertCollectionBySlug(pb, "courses", c.slug, {
      name: c.name,
      color: c.color,
      slug: c.slug,
      semesters: semester.id,
      owner: user.id,
    });
    courseIds[c.slug] = rec.id;
    log(`Course "${c.name}" ready (/${c.slug}).`);
  }
  // Base courses from seed.ts
  for (const slug of ["math-analysis", "physics"]) {
    const rec = (
      await pb.collection("courses").getFullList<{ id: string }>({ filter: `slug = "${slug}"`, perPage: 1, fields: "id" })
    )[0];
    if (rec) courseIds[slug] = rec.id;
  }

  // 2. Extra lectures
  const lectureIds: Record<string, string> = {};
  for (const l of EXTRA_LECTURES) {
    const rec = await upsertCollectionBySlug(pb, "lectures", l.slug, {
      title: l.title,
      slug: l.slug,
      field: courseIds[l.courseSlug],
      content: l.html,
      owner: user.id,
    });
    lectureIds[l.slug] = rec.id;
    log(`Lecture "${l.title}" ready (/${l.slug}).`);
  }
  // Existing base lectures (for quiz/tasks/schedule linking)
  for (const slug of ["limit-of-sequence", "derivative-geometry", "taylor-series", "newton-laws"]) {
    const rec = (
      await pb.collection("lectures").getFullList<{ id: string }>({ filter: `slug = "${slug}"`, perPage: 1, fields: "id" })
    )[0];
    if (rec) lectureIds[slug] = rec.id;
  }

  // 3. Cached quiz for "limit-of-sequence" so /quiz/:lectureId skips generation.
  {
    const lectureId = lectureIds["limit-of-sequence"];
    const lectureRec = await pb.collection("lectures").getOne<{ content: string }>(lectureId);
    const text = extractText(lectureRec.content ?? "");
    const hash = sha256Hex(normalizeText(text));
    const size = 5;

    const existingQuiz = (
      await pb.collection("quizzes").getFullList<{ id: string }>({
        filter: `lecture = "${lectureId}" && source_hash = "${hash}" && size = ${size}`,
        perPage: 1,
      })
    )[0];
    let quizId = existingQuiz?.id;
    if (!quizId) {
      const quiz = await pb.collection("quizzes").create<{ id: string }>({
        owner: user.id,
        lecture: lectureId,
        source_hash: hash,
        size,
        model: "seed-fixture",
      });
      quizId = quiz.id;
      const questions: Array<Record<string, unknown>> = [
        {
          type: "mcq",
          topic: "Определение предела",
          prompt: "Последовательность xₙ сходится к a, если…",
          options: [
            "для любого ε>0 найдётся N: |xₙ−a|<ε при n>N",
            "xₙ монотонна и ограничена",
            "xₙ периодична",
            "xₙ бесконечна при любом n",
          ],
          correct_index: 0,
          answer: "",
          explanation: "Это стандартное определение предела последовательности (ε–N).",
          quote: "Последовательность {xₙ} сходится к a",
        },
        {
          type: "mcq",
          topic: "Единственность предела",
          prompt: "Сколько пределов может иметь сходящаяся последовательность?",
          options: ["Ровно один", "Два", "Бесконечно много", "Зависит от n"],
          correct_index: 0,
          answer: "",
          explanation: "Сходящаяся последовательность имеет ровно один предел.",
          quote: "Сходящаяся последовательность имеет ровно один предел",
        },
        {
          type: "recall",
          topic: "Пример 1/n",
          prompt: "Чему равен предел 1/n при n → ∞?",
          answer: "0",
          explanation: "Для любого ε>0 достаточно взять N>1/ε.",
          quote: "lim 1/n = 0",
        },
      ];
      for (let i = 0; i < questions.length; i++) {
        await pb.collection("quiz_questions").create({
          owner: user.id,
          quiz: quizId,
          lecture: lectureId,
          position: i,
          ...questions[i],
        });
      }
      log("Cached quiz + questions created for lecture limit-of-sequence.");
    } else {
      log("Cached quiz already exists for lecture limit-of-sequence.");
    }

    // One recorded answer so a readiness % appears for this lecture.
    const qFirst = (
      await pb.collection("quiz_questions").getFullList<{ id: string }>({
        filter: `quiz = "${quizId}"`,
        sort: "position",
        perPage: 1,
      })
    )[0];
    if (qFirst) {
      const already = (
        await pb.collection("quiz_answers").getFullList({ filter: `question = "${qFirst.id}"`, perPage: 1 })
      )[0];
      if (!already) {
        await pb.collection("quiz_answers").create({
          owner: user.id,
          question: qFirst.id,
          lecture: lectureId,
          correct: true,
          answered_at: todayStr(),
          attempt: "seed-1",
        });
        log("Quiz answer recorded (gives lecture a readiness %).");
      }
    }
  }

  // 4. Second exam — philosophy course.
  {
    const courseId = courseIds["philosophy"];
    let exam = (
      await pb.collection("exams").getFullList<{ id: string }>({
        filter: `course = "${courseId}" && owner = "${user.id}"`,
        perPage: 1,
      })
    )[0];
    if (!exam) {
      exam = await pb.collection("exams").create<{ id: string }>({ course: courseId, owner: user.id, mode: "solo" });
      log("Philosophy exam created.");
    }
    for (const t of PHIL_TICKETS) {
      const existing = (
        await pb.collection("exam_tickets").getFullList<{ id: string }>({
          filter: `exam = "${exam.id}" && number = ${t.number}`,
          perPage: 1,
        })
      )[0];
      const payload: Record<string, unknown> = {
        exam: exam.id,
        number: t.number,
        question: t.question,
        answer: t.answer ?? "",
        status: t.status,
      };
      // Ticket #1 ("Милетская школа") cites the "Античная философия"
      // lecture as a source — gives that lecture the "related tickets"
      // badge/chip in the editor (LectureView → fetchTicketsForLecture).
      if (t.number === 1) payload.sources = [lectureIds["ancient-philosophy"]];
      if (existing) await pb.collection("exam_tickets").update(existing.id, payload);
      else await pb.collection("exam_tickets").create(payload);
    }
    log(`Philosophy exam tickets seeded: ${PHIL_TICKETS.length}.`);
  }

  // 5b. Throwaway empty course — for the "course lecture list: empty" shot.
  {
    const rec = await upsertCollectionBySlug(pb, "courses", "empty-course-shots", {
      name: "Пустой курс для скринов",
      color: "#9AA5B1",
      slug: "empty-course-shots",
      semesters: semester.id,
      owner: user.id,
    });
    courseIds["empty-course-shots"] = rec.id;
    log("Throwaway empty course ready (/empty-course-shots).");
  }

  // 5. Schedule — settings + slots, some linked to a lecture occurrence.
  {
    const monday = mondayOf(new Date());
    const anchorStr = todayStr(monday);
    let settings = (
      await pb.collection("schedule_settings").getFullList<{ id: string }>({ filter: `owner = "${user.id}"`, perPage: 1 })
    )[0];
    if (!settings) {
      settings = await pb.collection("schedule_settings").create<{ id: string }>({
        owner: user.id,
        pair_times: [
          { n: 1, start: "09:00", end: "10:30" },
          { n: 2, start: "10:40", end: "12:10" },
          { n: 3, start: "12:40", end: "14:10" },
          { n: 4, start: "14:20", end: "15:50" },
          { n: 5, start: "16:00", end: "17:30" },
        ],
        odd_week_anchor: anchorStr,
        show_saturday: true,
      });
      log("Schedule settings created.");
    }

    const slotDefs: Array<{ weekday: number; pair_number: number; subject: string; kind: string; room?: string; teacher?: string; link?: string }> = [
      { weekday: 1, pair_number: 1, subject: courseIds["math-analysis"], kind: "lecture", room: "412", teacher: "Иванова А.С.", link: "limit-of-sequence" },
      { weekday: 1, pair_number: 2, subject: courseIds["physics"], kind: "lab", room: "Лаб. 3" },
      { weekday: 2, pair_number: 1, subject: courseIds["russian-history"], kind: "lecture", room: "208", teacher: "Петров Д.В." },
      { weekday: 2, pair_number: 3, subject: courseIds["philosophy"], kind: "seminar", room: "301" },
      { weekday: 3, pair_number: 2, subject: courseIds["math-analysis"], kind: "seminar", room: "412" },
      { weekday: 4, pair_number: 1, subject: courseIds["physics"], kind: "lecture", room: "117", teacher: "Сидоров К.Н." },
      { weekday: 5, pair_number: 4, subject: courseIds["philosophy"], kind: "lecture", room: "301", teacher: "Орлова Е.П." },
    ];

    for (const s of slotDefs) {
      const existing = (
        await pb.collection("schedule_slots").getFullList<{ id: string }>({
          filter: `owner = "${user.id}" && weekday = ${s.weekday} && pair_number = ${s.pair_number}`,
          perPage: 1,
        })
      )[0];
      const payload = {
        owner: user.id,
        semester: semester.id,
        subject: s.subject,
        weekday: s.weekday,
        pair_number: s.pair_number,
        week_parity: "any",
        kind: s.kind,
        room: s.room ?? "",
        teacher: s.teacher ?? "",
      };
      const rec = existing
        ? await pb.collection("schedule_slots").update<{ id: string }>(existing.id, payload)
        : await pb.collection("schedule_slots").create<{ id: string }>(payload);

      if (s.link) {
        const occDate = new Date(monday);
        occDate.setDate(occDate.getDate() + (s.weekday - 1));
        await pb.collection("lectures").update(lectureIds[s.link], {
          slot: rec.id,
          lecture_date: todayStr(occDate),
        });
        log(`Linked lecture "${s.link}" to this week's slot (weekday ${s.weekday}).`);
      }
    }
    log(`Schedule slots seeded: ${slotDefs.length}.`);
  }

  // 6. Tasks — overdue / today / later / auto-generated.
  {
    const today = new Date();
    const tasksDefs: Array<Record<string, unknown>> = [
      {
        owner: user.id,
        title: "Доделать конспект по пределу последовательности",
        subject: courseIds["math-analysis"],
        lecture: lectureIds["limit-of-sequence"],
        due: todayStr(addDays(today, -3)),
        source: "manual",
      },
      {
        owner: user.id,
        title: "Прочитать параграф про Крещение Руси к семинару",
        subject: courseIds["russian-history"],
        lecture: lectureIds["rus-baptism"],
        due: todayStr(addDays(today, -1)),
        source: "manual",
      },
      {
        owner: user.id,
        title: "Сдать билеты по философии на проверку",
        subject: courseIds["philosophy"],
        due: todayStr(today),
        source: "manual",
      },
      {
        owner: user.id,
        title: "Пройти квиз по пределу последовательности",
        subject: courseIds["math-analysis"],
        lecture: lectureIds["limit-of-sequence"],
        due: todayStr(today),
        source: "auto_review",
        dedupe_key: "auto-review:limit-of-sequence",
      },
      {
        owner: user.id,
        title: "Повторить производную функции перед семинаром",
        subject: courseIds["math-analysis"],
        lecture: lectureIds["derivative-geometry"],
        due: todayStr(addDays(today, 4)),
        source: "auto_review",
        dedupe_key: "auto-review:derivative-geometry",
      },
      {
        owner: user.id,
        title: "Законспектировать главу про монгольское завоевание",
        subject: courseIds["russian-history"],
        lecture: lectureIds["mongol-conquest"],
        due: todayStr(addDays(today, 7)),
        source: "lecture",
      },
      {
        owner: user.id,
        title: "Подготовить шпаргалку по готовым билетам",
        subject: courseIds["philosophy"],
        due: todayStr(addDays(today, 10)),
        source: "manual",
      },
      {
        owner: user.id,
        title: "Законы Ньютона — доделать конспект",
        subject: courseIds["physics"],
        lecture: lectureIds["newton-laws"],
        due: null,
        source: "manual",
        done_at: todayStr(addDays(today, -5)),
      },
    ];

    for (const t of tasksDefs) {
      const dedupe = t.dedupe_key as string | undefined;
      const existing = dedupe
        ? (
            await pb.collection("tasks").getFullList<{ id: string }>({
              filter: `owner = "${user.id}" && dedupe_key = "${dedupe}"`,
              perPage: 1,
            })
          )[0]
        : (
            await pb.collection("tasks").getFullList<{ id: string }>({
              filter: `owner = "${user.id}" && title = "${(t.title as string).replace(/"/g, '\\"')}"`,
              perPage: 1,
            })
          )[0];
      if (existing) {
        await pb.collection("tasks").update(existing.id, t);
      } else {
        await pb.collection("tasks").create(t);
      }
    }
    log(`Tasks seeded: ${tasksDefs.length}.`);
  }

  pb.authStore.clear();
  log("Done.");
}

main().catch((e) => {
  console.error(`\n[seed-screenshots] FAILED: ${(e as Error).message}\n`);
  process.exitCode = 1;
});
