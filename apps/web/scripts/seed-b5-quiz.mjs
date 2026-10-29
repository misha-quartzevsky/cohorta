/**
 * Тестовые лекции для проверки панели «Твоё понимание темы» (B5) на ЛОКАЛЬНОЙ базе.
 *
 *   node scripts/seed-b5-quiz.mjs          создать (или пересоздать) лекции
 *   node scripts/seed-b5-quiz.mjs --clean  удалить их
 *
 * Берёт демо-аккаунт и курс «math-analysis» из scripts/seed.ts, ничего больше не трогает.
 * Лекции помечены slug'ом `b5-…` и названием «Тест панели …»; пересоздаются целиком
 * (вопросы и ответы удаляются каскадом вместе с лекцией).
 */
import PocketBase from "pocketbase";

const PB_URL = process.env.PB_URL ?? "http://127.0.0.1:8090";
if (!/127\.0\.0\.1|localhost/.test(PB_URL)) {
  console.error("Скрипт только для локальной базы, PB_URL =", PB_URL);
  process.exit(1);
}
const EMAIL = process.env.DEMO_EMAIL;
const PASSWORD = process.env.DEMO_PASSWORD;
const COURSE_SLUG = "math-analysis";

const LONG_TEXT = `<h2>Понятие договора</h2><p>Договор — это соглашение двух или нескольких лиц об установлении, изменении или прекращении гражданских прав и обязанностей. Стороны свободны в заключении договора и выборе его условий.</p><h2>Заключение договора</h2><p>Договор считается заключённым, когда стороны достигли согласия по всем существенным условиям. Оферта — предложение заключить договор, акцепт — полное и безоговорочное согласие с ним. Договор заключён в момент получения акцепта лицом, направившим оферту.</p><h2>Расторжение договора</h2><p>Расторжение возможно по соглашению сторон или по решению суда при существенном нарушении условий одной из сторон.</p>`;
const SHORT_TEXT = `<p>Договор — соглашение сторон об установлении, изменении или прекращении прав и обязанностей. Конспект пока короткий.</p>`;

const T1 = "Понятие договора";
const T2 = "Заключение договора";
const T3 = "Расторжение договора";

/** 8 вопросов: 6 с вариантами и 2 «вспомни», по трём темам. */
const QUESTIONS = [
  { topic: T1, type: "mcq", prompt: "Что такое договор?", options: ["Односторонний акт", "Соглашение двух или нескольких лиц", "Решение суда", "Приказ"], correct: 1, quote: "Договор — это соглашение двух или нескольких лиц" },
  { topic: T1, type: "recall", prompt: "Что означает свобода договора?", answer: "Стороны свободны в заключении договора и выборе его условий.", quote: "Стороны свободны в заключении договора" },
  { topic: T2, type: "mcq", prompt: "Что такое оферта?", options: ["Согласие с договором", "Предложение заключить договор", "Расторжение договора", "Штраф"], correct: 1, quote: "Оферта — предложение заключить договор" },
  { topic: T2, type: "mcq", prompt: "Что такое акцепт?", options: ["Полное и безоговорочное согласие", "Встречное предложение", "Молчание адресата", "Просьба изменить цену"], correct: 0, quote: "акцепт — полное и безоговорочное согласие с ним" },
  { topic: T2, type: "mcq", prompt: "Когда договор считается заключённым?", options: ["При отправке оферты", "При получении акцепта лицом, направившим оферту", "При подписи свидетеля", "Через месяц"], correct: 1, quote: "Договор заключён в момент получения акцепта" },
  { topic: T2, type: "recall", prompt: "Какие условия называют существенными?", answer: "Те, по которым стороны должны достичь согласия, чтобы договор считался заключённым.", quote: "по всем существенным условиям" },
  { topic: T3, type: "mcq", prompt: "Как можно расторгнуть договор?", options: ["Только по решению суда", "По соглашению сторон или по решению суда", "Никак", "Только письмом"], correct: 1, quote: "Расторжение возможно по соглашению сторон или по решению суда" },
  { topic: T3, type: "mcq", prompt: "Когда суд расторгает договор?", options: ["При существенном нарушении условий одной из сторон", "По желанию соседа", "Каждый год", "Никогда"], correct: 0, quote: "при существенном нарушении условий" },
];

const STATES = [
  { slug: "b5-no-quiz", title: "Тест панели 1: квиза нет", html: LONG_TEXT, quiz: false },
  { slug: "b5-short-text", title: "Тест панели: мало текста", html: SHORT_TEXT, quiz: false },
  { slug: "b5-quiz-created", title: "Тест панели 2: квиз создан", html: LONG_TEXT, quiz: true, answered: 0 },
  { slug: "b5-quiz-started", title: "Тест панели 4: квиз начат (3 из 8)", html: LONG_TEXT, quiz: true, answered: 3 },
  { slug: "b5-quiz-done", title: "Тест панели 3: квиз пройден", html: LONG_TEXT, quiz: true, answered: 8 },
];

/** Какие вопросы отвечены верно в «пройденном» квизе: 2/2, 3/4, 1/2 → 6 из 8. */
const CORRECT = [true, true, true, true, true, false, true, false];

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);
await pb.collection("users").authWithPassword(EMAIL, PASSWORD);
const owner = pb.authStore.record.id;

for (const st of STATES) {
  const old = await pb.collection("lectures").getFullList({ filter: `slug="${st.slug}"`, fields: "id" });
  for (const o of old) await pb.collection("lectures").delete(o.id);
}
if (process.argv.includes("--clean")) {
  console.log("Тестовые лекции удалены.");
  process.exit(0);
}

const course = await pb.collection("courses").getFirstListItem(`slug="${COURSE_SLUG}"`);

for (const st of STATES) {
  const lecture = await pb.collection("lectures").create({
    title: st.title,
    slug: st.slug,
    field: course.id,
    content: st.html,
    owner,
  });
  if (!st.quiz) {
    console.log("создана", st.slug);
    continue;
  }
  const quiz = await pb.collection("quizzes").create({ owner, lecture: lecture.id, source_hash: "seed", size: 8, model: "seed" });
  const qs = [];
  for (let i = 0; i < QUESTIONS.length; i += 1) {
    const q = QUESTIONS[i];
    qs.push(
      await pb.collection("quiz_questions").create({
        owner,
        quiz: quiz.id,
        lecture: lecture.id,
        position: i,
        type: q.type,
        topic: q.topic,
        prompt: q.prompt,
        options: q.type === "mcq" ? q.options : null,
        correct_index: q.type === "mcq" ? q.correct : null,
        answer: q.type === "recall" ? q.answer : "",
        explanation: "Так сказано в конспекте.",
        quote: q.quote,
      })
    );
  }
  const attempt = crypto.randomUUID();
  const base = Date.now() - st.answered * 60000;
  for (let i = 0; i < st.answered; i += 1) {
    await pb.collection("quiz_answers").create({
      owner,
      question: qs[i].id,
      lecture: lecture.id,
      correct: st.answered === 8 ? CORRECT[i] : i % 2 === 0,
      answered_at: new Date(base + i * 60000).toISOString(),
      attempt,
    });
  }
  console.log("создана", st.slug, `(ответов: ${st.answered})`);
}
console.log(`\nГотово. Лекции: http://localhost:5173/s/demo/${COURSE_SLUG}/<slug>`);
