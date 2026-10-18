/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  A3 (раздел 2.3 инструкции) — courses.cover_seed: число 0–359,
//  вход генератора обложки предмета (SubjectCover, .c-cover).
//  Заменяет обе старые системы цвета курса (subjectPalette.ts,
//  courseGradient.ts/colors.ts, обе на клиенте) одним полем в базе.
//
//  Backfill по правилу раздела 2.3:
//  - `color` = один из четырёх ключей старой палитры (civil/mkt/
//    stat/phil) → фиксированный сид, чтобы привычный оттенок не
//    изменился: civil→20, mkt→335, stat→135, phil→212.
//  - остальные (green/lilac/sand/sky, любой другой color, пустой
//    color) → по порядку создания (created ASC), шаг 137.5°,
//    по кругу (% 360). В реальных данных на момент миграции ни у
//    одного курса color не совпадает ни с одним из четырёх ключей
//    (цвет хранится как hex из courseGradient.ts) — почти все курсы
//    попадают в эту ветку, что и ожидается.
//
//  `courses.color` после переноса не используется (экраны на A3+
//  читают только cover_seed), поле убрать в уборке волны D.
// ============================================================

const FIXED_SEED = { civil: 20, mkt: 335, stat: 135, phil: 212 };
const STEP = 137.5;

function hasField(col, name) {
  for (const f of col.fields) {
    if (f.name === name) return true;
  }
  return false;
}

migrate((app) => {
  const courses = app.findCollectionByNameOrId("courses");

  if (!hasField(courses, "cover_seed")) {
    courses.fields.addAt(
      courses.fields.length,
      new Field({
        hidden: false,
        id: "number1790002001",
        max: 360,
        min: 0,
        name: "cover_seed",
        onlyInt: false,
        presentable: false,
        required: false,
        system: false,
        type: "number",
      })
    );
    app.save(courses);
  }

  // Поле только что добавлено — backfill берёт ВСЕ записи по порядку
  // создания (без фильтра: ветка "cover_seed = 0" дала бы ложные
  // срабатывания, т.к. 0 — законный сид, а не "не задано").
  const all = app.findRecordsByFilter("courses", "", "created", 0, 0);
  let sequential = 0;
  let fixed = 0;
  for (const course of all) {
    const color = String(course.get("color") || "").trim().toLowerCase();
    if (color in FIXED_SEED) {
      course.set("cover_seed", FIXED_SEED[color]);
      fixed += 1;
    } else {
      course.set("cover_seed", (sequential * STEP) % 360);
      sequential += 1;
    }
    app.save(course);
  }

  console.log(
    `courses.cover_seed: добавлено поле, backfill ${fixed + sequential} курсов (${fixed} фиксированных, ${sequential} по порядку создания)`
  );
}, (app) => {
  const courses = app.findCollectionByNameOrId("courses");
  for (const f of courses.fields) {
    if (f.id === "number1790002001") {
      courses.fields.removeById(f.id);
      break;
    }
  }
  app.save(courses);
})
