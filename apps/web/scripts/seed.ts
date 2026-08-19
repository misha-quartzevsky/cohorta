/**
 * ============================================
 *  seed.ts — demo data seeder for Cohorta
 * ============================================
 *
 * Creates a test user, the "demo" semester, 2 courses and 3 lectures
 * (one containing an inline MathLive formula: x^2 + y^2 = z^2).
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
 * Idempotent: aborts if a semester with slug "demo" already exists.
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
  {
    title: "Предел последовательности",
    slug: "limit-of-sequence",
    courseIndex: 0,
    html:
      para("Последовательность {xₙ} сходится к a, если для любого ε > 0 существует номер N, начиная с которого |xₙ − a| < ε.") +
      math("x^2 + y^2 = z^2") +
      para("Теорема Пифагора — классический пример верного равенства для прямоугольного треугольника."),
  },
  // Вторая лекция курса «Математический анализ» — для переключения в сайдбаре.
  {
    title: "Производная функции",
    slug: "derivative-geometry",
    courseIndex: 0,
    html:
      para("Производная функции равна пределу отношения приращения функции к приращению аргумента.") +
      para("Геометрически она равна тангенсу угла наклона касательной к графику функции."),
  },
  // Единственная лекция курса «Физика».
  {
    title: "Законы Ньютона",
    slug: "newton-laws",
    courseIndex: 1,
    html:
      para("Первый закон: инерциальные системы отсчёта. Второй закон связывает силу и ускорение.") +
      para("Третий закон: силы действия и противодействия равны по модулю и противоположны по направлению."),
  },
];

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

function log(msg: string): void {
  console.log(`[seed] ${msg}`);
}

async function uniqueSlug(
  pb: PocketBase,
  collection: string,
  base: string,
): Promise<string> {
  try {
    const items = await pb
      .collection(collection)
      .getFullList<{ slug?: string }>({ fields: "slug" });
    const taken = new Set(items.map((r) => r.slug ?? ""));
    if (!taken.has(base)) return base;
    let n = 1;
    while (taken.has(`${base}-${n}`)) n += 1;
    return `${base}-${n}`;
  } catch {
    // Collection may not exist yet — the caller handles the real error.
    return base;
  }
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

  // Idempotency guard.
  const existingDemo = await pb.collection("semesters").getFullList<{ id: string }>({
    filter: 'slug = "demo"',
    perPage: 1,
  });
  if (existingDemo.length > 0) {
    throw new Error(
      'Semester "demo" already exists — nothing to do.\n' +
        "Re-runs are intentionally skipped to keep paths unique.",
    );
  }

  // 1. Semester.
  const semester = await pb
    .collection("semesters")
    .create<{ id: string }>({ slug: "demo" });
  log(`Semester "demo" created (${semester.id}).`);

  // 2. Courses.
  const courseSlugs = await Promise.all(
    COURSES.map(async (c) => uniqueSlug(pb, "courses", c.slug)),
  );
  const courses: Array<{ id: string }> = [];
  for (let i = 0; i < COURSES.length; i += 1) {
    courses.push(
      await pb.collection("courses").create<{ id: string }>({
        name: COURSES[i].name,
        color: COURSES[i].color,
        slug: courseSlugs[i],
        semesters: semester.id,
      }),
    );
    log(`Course "${COURSES[i].name}" created (/${courseSlugs[i]}).`);
  }

  // 3. Lectures.
  for (const lecture of LECTURES) {
    const slug = await uniqueSlug(pb, "lectures", lecture.slug);
    const payload: Record<string, unknown> = {
      title: lecture.title,
      slug,
      field: courses[lecture.courseIndex].id,
      content: lecture.html,
    };
    await pb.collection("lectures").create(payload);
    log(`Lecture "${lecture.title}" created (/${slug}).`);
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
