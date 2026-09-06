/**
 * ============================================
 *  seed.ts — demo data seeder for Cohorta
 * ============================================
 *
 * Creates (or updates) the test user, the "demo" semester, 2 courses and
 * 4 lectures. Lecture HTML contains H1–H3 headings (feeds the TOC E2E tests)
 * and an inline MathLive formula: x^2 + y^2 = z^2.
 *
 * Run from `apps/web`:
 *   npm run seed
 * or from repo root:
 *   npm run seed
 *
 * Requirements:
 *  - PocketBase must be RUNNING on http://127.0.0.1:8090 and migrations
 *    must have created the collections (`semesters`, `courses`, `lectures`;
 *    `users` is created by PocketBase itself on first launch).
 *  - Node.js >= 22.6 (native TypeScript support).
 *
 * Idempotent: re-runs upsert demo courses/lectures by slug (update-or-create);
 * extra rows already present in the demo semester are left untouched.
 * Works without auth — PocketBase list/view rules are "" (open).
 */

import PocketBase from "pocketbase";

const PB_URL = process.env.PB_URL ?? "http://127.0.0.1:8090";

// ---------------------------------------------------------------------------
// Content builders
// ---------------------------------------------------------------------------

/** Inline math block, stored exactly like the editor serializes it. */
function math(latex: string): string {
  return `<div data-type="math-block" data-latex="${latex}"></div>`;
}

function para(text: string): string {
  return `<p>${text}</p>`;
}

/**
 * Абзац с таймстампом строки (как проставляет диктовка через NodeTimestamp).
 * Диктовку в Playwright не воспроизвести — E2E проверяет слой рендера/hover
 * на заранее размеченном абзаце.
 */
function paraTs(text: string, ts: number, label: string): string {
  return `<p data-ts="${ts}" data-ts-label="${label}">${text}</p>`;
}

/** Heading builder — used by E2E tests to assert the TOC is populated. */
function h1(text: string): string {
  return `<h1>${text}</h1>`;
}
function h2(text: string): string {
  return `<h2>${text}</h2>`;
}
function h3(text: string): string {
  return `<h3>${text}</h3>`;
}


// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface SeedCourse {
  name: string;
  color: string;
  slug: string;
}

interface SeedLecture {
  title: string;
  slug: string;
  courseIndex: number;
  html: string;
}

export const COURSES: SeedCourse[] = [
  { name: "Математический анализ", color: "#9C8FE2", slug: "math-analysis" },
  { name: "Физика", color: "#5199FC", slug: "physics" },
];

export const LECTURES: SeedLecture[] = [
  // Лекция с inline-формулой MathLive — именно её проверяют E2E-тесты
  // на «видимость» формулы при SPA-навигации (без ручного reload).
  // Заголовки H1–H3 здесь же питают TOC-тесты (sidebar + aside).
  {
    title: "Предел последовательности",
    slug: "limit-of-sequence",
    courseIndex: 0,
    html:
      h1("Предел последовательности") +
      para("Последовательность {xₙ} сходится к a, если для любого ε > 0 существует номер N, начиная с которого |xₙ − a| < ε.") +
      h2("Определение") +
      para("Последовательность называется сходящейся, если существует конечный предел. Число a называют пределом последовательности и пишут xₙ → a при n → ∞.") +
      h3("Пример: 1/n") +
      math("\\lim_{n\\to\\infty}\\frac{1}{n}=0") +
      para("Действительно, для любого ε > 0 достаточно взять N > 1/ε, и тогда при всех n > N будет выполняться |1/n − 0| < ε.") +
      h2("Свойства пределов") +
      para("Предел суммы последовательностей равен сумме пределов: lim (aₙ + bₙ) = lim aₙ + lim bₙ.") +
      math("\\lim_{n\\to\\infty}(a_n+b_n)=\\lim a_n + \\lim b_n") +
      para("Аналогичные свойства справедливы для произведения и частного (при ненулевом пределе знаменателя).") +
      h2("Единственность предела") +
      para("Сходящаяся последовательность имеет ровно один предел: если xₙ → a и xₙ → b, то a = b. Это следует из того, что расстояние |a − b| можно сделать меньше произвольного ε, взяв достаточно большой номер.") +
      para("Теорема Пифагора — классический пример верного равенства: x² + y² = z²."),
  },
  // Вторая лекция курса «Математический анализ» — для переключения в сайдбаре.
  {
    title: "Производная функции",
    slug: "derivative-geometry",
    courseIndex: 0,
    html:
      h1("Производная функции") +
      paraTs(
        "Производная функции равна пределу отношения приращения функции к приращению аргумента.",
        1725623520000,
        "6 сент., 14:32"
      ) +
      h2("Геометрический смысл") +
      para("Геометрически она равна тангенсу угла наклона касательной к графику функции.") +
      h3("Формула") +
      math("f'(x)=\\lim_{h\\to 0}\\frac{f(x+h)-f(x)}{h}") +
      para("Эта формула позволяет вычислять производную любой дифференцируемой функции."),
  },
  // Третья лекция курса — третья карточка в сайдбаре и третий H1→H3-набор.
  {
    title: "Ряд Тейлора",
    slug: "taylor-series",
    courseIndex: 0,
    html:
      h1("Ряд Тейлора") +
      para("Ряд Тейлора позволяет представить функцию в виде бесконечного многочлена.") +
      h2("Общая формула") +
      math("f(x)=f(a)+f'(a)(x-a)+\\frac{f''(a)}{2!}(x-a)^2+\\dots") +
      h3("Применение") +
      para("Используется для приближённого вычисления функций и решения дифференциальных уравнений."),
  },
  // Единственная лекция курса «Физика».
  {
    title: "Законы Ньютона",
    slug: "newton-laws",
    courseIndex: 1,
    html:
      h1("Законы Ньютона") +
      para("Первый закон: инерциальные системы отсчёта. Второй закон связывает силу и ускорение.") +
      h2("Третий закон") +
      para("Силы действия и противодействия равны по модулю и противоположны по направлению.") +
      h3("Пример") +
      para("Если вы толкаете стену, стена толкает вас с той же силой."),
  },
];

// --- Demo deck (flashcards) ---
export const SEED_DECK = {
  title: "Сетчатка глаза",
  slug: "retina-vision",
  description: "Анатомия сетчатки для зачёта по офтальмологии.",
  color: "#9C8FE2",
  cards: [
    {
      front: "Как называется светочувствительный слой глазного яблока?",
      back: "Сетчатка (лат. retina).",
    },
    {
      front:
        "Какие фоторецепторы отвечают за сумеречное (чёрно-белое) зрение?",
      back: "Палочки.",
    },
    {
      front: "В какой области сетчатки больше всего колбочек?",
      back: "В центральной ямке (fovea) жёлтого пятна.",
    },
    {
      front: "Чему равна энергия фотона?",
      back:
        math("E=h\\\\nu") +
        para("где h — постоянная Планка, ν — частота света."),
    },
    {
      front: "Что такое слепое пятно?",
      back:
        para("Место выхода зрительного нерва — здесь нет фоторецепторов.") +
        para("Рисунок:") +
        para("[[file:retina.svg]]"),
    },
  ],
};

/** SVG-картинка-вложение (встраивается в `attachments` карточки). */
function retinaSvg(): File {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200">` +
    `<rect width="100%" height="100%" fill="#5843f6"/>` +
    `<circle cx="160" cy="100" r="46" fill="#fff" opacity="0.9"/>` +
    `<text x="160" y="112" font-size="22" fill="#5843f6" text-anchor="middle" font-family="sans-serif">Сетчатка</text>` +
    `</svg>`;
  // File (а не голый Blob) несёт имя — PocketBase сохранит имя «retina.svg»,
  // и токен [[file:retina.svg]] в карточке совпадёт с фактическим файлом.
  return new File([svg], "retina.svg", { type: "image/svg+xml" });
}

/** Идемпотентный upsert демо-колоды (по slug) с детерминированным набором карточек. */
async function upsertDeck(pb: PocketBase, ownerId: string): Promise<void> {
  let deck = (
    await pb.collection("decks").getFullList<{ id: string }>({
      filter: `slug = "${SEED_DECK.slug}"`,
      perPage: 1,
      fields: "id",
    })
  )[0];
  if (deck) {
    await pb.collection("decks").update(deck.id, {
      title: SEED_DECK.title,
      description: SEED_DECK.description,
      color: SEED_DECK.color,
      owner: ownerId,
    });
    log(`Deck "${SEED_DECK.title}" updated (/${SEED_DECK.slug}).`);
  } else {
    deck = await pb.collection("decks").create<{ id: string }>({
      title: SEED_DECK.title,
      description: SEED_DECK.description,
      color: SEED_DECK.color,
      slug: SEED_DECK.slug,
      is_public: false,
      owner: ownerId,
    });
    log(`Deck "${SEED_DECK.title}" created (/${SEED_DECK.slug}).`);
  }

  // Детерминированный набор: сбрасываем карточки колоды и пересоздаём.
  const existing = await pb.collection("deck_cards").getFullList<{ id: string }>({
    filter: `deck = "${deck.id}"`,
    perPage: 100,
    fields: "id",
  });
  for (const c of existing) {
    await pb.collection("deck_cards").delete(c.id);
  }
  for (let i = 0; i < SEED_DECK.cards.length; i++) {
    const card = SEED_DECK.cards[i];
    const payload: Record<string, unknown> = {
      deck: deck.id,
      front: card.front,
      back: card.back,
      position: i,
    };
    if (i === SEED_DECK.cards.length - 1) {
      payload.attachments = [retinaSvg()];
    }
    const created = await pb.collection("deck_cards").create<{
      id: string;
      back: string;
      attachments?: string[];
    }>(payload);
    // PocketBase может переименовать файл (добавляет случайный суффикс),
    // поэтому берём фактическое имя из ответа и подставляем в токен карточки.
    if (i === SEED_DECK.cards.length - 1 && created.attachments?.[0]) {
      const actual = created.attachments[0];
      const back = String(created.back).replaceAll(
        "[[file:retina.svg]]",
        `[[file:${actual}]]`
      );
      if (back !== created.back) {
        await pb.collection("deck_cards").update(created.id, { back });
      }
    }
  }
  log(`Deck cards seeded: ${SEED_DECK.cards.length}.`);
}

// ---------------------------------------------------------------------------
// Demo exam — реальные формулировки (философия, 6 семестр, предоставлены
// заказчиком), а не выдуманные короткие строки: длина 41-227 символов на
// настоящем списке — карта билетов и тултипы должны держать её, а не
// только «Билет №1» из 10 символов.
// ---------------------------------------------------------------------------

const EXAM_TICKETS: Array<{
  number: number;
  question: string;
  status: "empty" | "draft" | "ready";
  answer?: string;
}> = [
  {
    number: 1,
    status: "ready",
    question:
      "Идеология революционного народничества. Основные подходы лидеров народничества к политической борьбе.",
    answer:
      para(
        "Народничество — общественное движение разночинной интеллигенции второй половины XIX века, искавшее для России некапиталистический путь развития через крестьянскую общину."
      ) + math("x^2 + y^2 = z^2"), // синтетическая формула — для проверки рендера MathLive на шпаргалке
  },
  {
    number: 2,
    status: "ready",
    question:
      "Почвенничество и толстовство: социально-политические идеи Ф.М. Достоевского и Л.Н. Толстого.",
    answer: para(
      "Почвенничество — течение, искавшее синтез между западничеством и славянофильством через возвращение к «почве», то есть к народным началам."
    ),
  },
  {
    number: 3,
    status: "draft",
    question:
      "Понятие анархии. Разновидности анархизма. Анархо-коммунизм П.А. Кропоткина.",
    answer: para("Черновик: анархизм отрицает государство как форму принуждения…"),
  },
  {
    number: 4,
    status: "empty",
    question:
      "Русский политический консерватизм. Основные идеи, направления (византизм и монархизм) и представители (Н.М. Карамзин, Н.Я. Данилевский, К.Н. Леонтьев, М.Н. Катков, К.П. Победоносцев, Л.А. Тихомиров и др.) русского консерватизм.",
  },
  {
    number: 5,
    status: "empty",
    question:
      "Философия всеединства В.С. Соловьева: метафизика, историософия, этика.",
  },
  {
    number: 6,
    status: "empty",
    question:
      "Персонализм Н. А. Бердяева: русская идея, антроподицея, философия свободы.",
  },
  {
    number: 7,
    status: "empty",
    question:
      "Интуитивизм Н.О. Лосского и экзистенциальный иррационализм Л. И. Шестова.",
  },
  {
    number: 8,
    status: "empty",
    question:
      "Русский космизм: основные представители и идеи (Н.Ф. Федоров, К.Э. Циолковский, В.И. Вернадский и др.)",
  },
];

/**
 * Экзамен курса «Математический анализ» — upsert по паре (course, owner),
 * та же уникальность, что задаёт индекс `idx_exams_course_owner`.
 *
 * ВАЖНО: `exams`/`exam_tickets` — первые owner-scoped коллекции проекта
 * (см. миграции 1787400000/1787400100). Анонимно их не создать — сид
 * логинится демо-пользователем на время этого шага и разлогинивается
 * сразу после, чтобы не менять поведение остального скрипта (курсы/
 * лекции/колоды по-прежнему сидируются анонимно, как раньше).
 */
async function upsertExam(pb: PocketBase, courseId: string): Promise<void> {
  let authed: { id: string };
  try {
    authed = (
      await pb.collection("users").authWithPassword(DEMO_EMAIL, DEMO_PASSWORD)
    ).record;
  } catch (e) {
    log(`WARN: could not auth demo user for exam seeding, skipping: ${(e as Error).message}`);
    return;
  }

  try {
    let exam = (
      await pb.collection("exams").getFullList<{ id: string }>({
        filter: `course = "${courseId}" && owner = "${authed.id}"`,
        perPage: 1,
        fields: "id",
      })
    )[0];
    if (!exam) {
      exam = await pb.collection("exams").create<{ id: string }>({
        course: courseId,
        owner: authed.id,
        mode: "solo",
      });
      log(`Exam created for course ${courseId}.`);
    } else {
      log(`Exam already exists for course ${courseId} — upserting tickets.`);
    }

    for (const t of EXAM_TICKETS) {
      const existing = (
        await pb.collection("exam_tickets").getFullList<{ id: string }>({
          filter: `exam = "${exam.id}" && number = ${t.number}`,
          perPage: 1,
          fields: "id",
        })
      )[0];
      const payload = {
        exam: exam.id,
        number: t.number,
        question: t.question,
        answer: t.answer ?? "",
        status: t.status,
      };
      if (existing) {
        await pb.collection("exam_tickets").update(existing.id, payload);
      } else {
        await pb.collection("exam_tickets").create(payload);
      }
    }
    log(`Exam tickets seeded: ${EXAM_TICKETS.length}.`);
  } finally {
    pb.authStore.clear();
  }
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

function log(msg: string): void {
  console.log(`[seed] ${msg}`);
}

/** Тест-пользователь — та же запись, что кладёт сид-миграция 1787043973. */
const DEMO_EMAIL = "asyaobraz17@gmail.com";
const DEMO_PASSWORD = "12345678";

async function ensureDemoUser(pb: PocketBase): Promise<void> {
  // Анонимный LIST коллекции `users` пуст (listRule = «свои»), поэтому
  // «есть ли уже пользователь» проверяем попыткой логина: если он существует —
  // authWithPassword успешен, если нет — вызовем create.
  try {
    await pb.collection("users").authWithPassword(DEMO_EMAIL, DEMO_PASSWORD);
    log(`Demo user ${DEMO_EMAIL} already exists.`);
    pb.authStore.clear();
    return;
  } catch {
    /* пользователя ещё нет — создаём ниже */
  }
  try {
    await pb.collection("users").create({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      passwordConfirm: DEMO_PASSWORD,
      emailVisibility: true,
      verified: true,
      name: "Демо",
    });
    log(`Demo user ${DEMO_EMAIL} created.`);
  } catch (e) {
    // Тест-пользователь — мягкая зависимость (его обычно кладёт сид-миграция);
    // падение создания не должно прерывать сид семестра/курсов/лекций.
    log(`WARN: could not ensure demo user, continue: ${(e as Error).message}`);
  }
}

export async function seed(pb: PocketBase): Promise<void> {
  log(`Connecting to ${PB_URL} ...`);
  pb.autoCancellation(false);

  // Health check: touches the API, throws a readable error when PB is down.
  await pb.health.check();
  log("PocketBase is reachable.");

  await ensureDemoUser(pb);

  // После ужесточения правил (миграция 1787615000) courses/lectures/decks
  // требуют авторизации на создание и владельца. Логинимся демо-юзером на
  // всё время сида данных; чистим сессию в конце.
  const demoUser = (
    await pb.collection("users").authWithPassword(DEMO_EMAIL, DEMO_PASSWORD)
  ).record;
  log(`Authenticated as demo user (${demoUser.id}) for owner-scoped seeding.`);

  // 0. Бэкфилл владельца на ВСЕ записи без owner (legacy / прежние сессии
  // разработки). На чистом клоне таких нет; на dev-БД они «свои» и по
  // переходному правилу owner="" видны всем — забираем их демо-юзеру,
  // чтобы новый зарегистрированный пользователь их не видел.
  for (const col of ["courses", "lectures", "decks"] as const) {
    const orphans = await pb.collection(col).getFullList<{ id: string }>({
      filter: 'owner = ""',
      fields: "id",
    });
    for (const rec of orphans) {
      await pb.collection(col).update(rec.id, { owner: demoUser.id });
    }
    if (orphans.length) log(`Backfilled owner on ${orphans.length} ${col}.`);
  }

  // 1. Semester — find or create (idempotent: re-runs update, don't throw).
  let semester = (
    await pb.collection("semesters").getFullList<{ id: string }>({
      filter: 'slug = "demo"',
      perPage: 1,
    })
  )[0];
  if (semester) {
    log(`Semester "demo" already exists (${semester.id}) — upserting data.`);
  } else {
    semester = await pb.collection("semesters").create<{ id: string }>({
      slug: "demo",
    });
    log(`Semester "demo" created (${semester.id}).`);
  }

  // 2. Courses — find by slug → update, otherwise create.
  const courses: Array<{ id: string }> = [];
  for (const c of COURSES) {
    const existing = (
      await pb.collection("courses").getFullList<{ id: string }>({
        filter: `slug = "${c.slug}"`,
        perPage: 1,
        fields: "id",
      })
    )[0];
    const payload = {
      name: c.name,
      color: c.color,
      slug: c.slug,
      semesters: semester.id,
      owner: demoUser.id,
    };
    if (existing) {
      await pb.collection("courses").update(existing.id, payload);
      courses.push(existing);
      log(`Course "${c.name}" updated (/${c.slug}).`);
    } else {
      const rec = await pb.collection("courses").create<{ id: string }>(payload);
      courses.push(rec);
      log(`Course "${c.name}" created (/${c.slug}).`);
    }
  }

  // 3. Lectures — find by slug → update (fresh content incl. H1–H3), else create.
  for (const lecture of LECTURES) {
    const existing = (
      await pb.collection("lectures").getFullList<{ id: string }>({
        filter: `slug = "${lecture.slug}"`,
        perPage: 1,
        fields: "id",
      })
    )[0];
    const payload = {
      title: lecture.title,
      slug: lecture.slug,
      field: courses[lecture.courseIndex].id,
      content: lecture.html,
      owner: demoUser.id,
    };
    if (existing) {
      await pb.collection("lectures").update(existing.id, payload);
      log(`Lecture "${lecture.title}" updated (/${lecture.slug}).`);
    } else {
      await pb.collection("lectures").create(payload);
      log(`Lecture "${lecture.title}" created (/${lecture.slug}).`);
    }
  }

  // 4. Demo deck (flashcards) — upsert by slug.
  await upsertDeck(pb, demoUser.id);

  // Дальше exam-шаг сам логинится/чистит сессию; освобождаем её здесь.
  pb.authStore.clear();

  // 5. Demo exam — на первом курсе (math-analysis).
  await upsertExam(pb, courses[0].id);

  log(
    "Done. Open http://127.0.0.1:5173, switch the semester to «demo» and check the dashboard.",
  );
  log(
    `Seeded: 1 semester, ${COURSES.length} courses, ${LECTURES.length} lectures, 1 deck (test user: ${DEMO_EMAIL}).`,
  );
}

async function main(): Promise<void> {
  const pb = new PocketBase(PB_URL);
  try {
    await seed(pb);
  } catch (e) {
    console.error(`\n[seed] FAILED: ${(e as Error).message}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await main();
}
