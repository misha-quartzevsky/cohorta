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
      para("Производная функции равна пределу отношения приращения функции к приращению аргумента.") +
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
    };
    if (existing) {
      await pb.collection("lectures").update(existing.id, payload);
      log(`Lecture "${lecture.title}" updated (/${lecture.slug}).`);
    } else {
      await pb.collection("lectures").create(payload);
      log(`Lecture "${lecture.title}" created (/${lecture.slug}).`);
    }
  }

  log(
    "Done. Open http://127.0.0.1:5173, switch the semester to «demo» and check the dashboard.",
  );
  log(
    `Seeded: 1 semester, ${COURSES.length} courses, ${LECTURES.length} lectures (test user: ${DEMO_EMAIL}).`,
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
