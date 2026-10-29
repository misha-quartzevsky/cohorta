/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  Демо-данные для локальной разработки.
//
//  1. 12 семестров-заготовок (slug "1".."12") создаются, если таблица семестров пуста.
//  2. Демо-пользователь создаётся ТОЛЬКО при PB_SEED_DEMO=1:
//       PB_DEMO_EMAIL     почта (по умолчанию demo@local.test)
//       PB_DEMO_PASSWORD  пароль; если не задан, генерируется случайный и нигде не выводится
//                         (войти можно после «Забыли пароль» или задав PB_DEMO_PASSWORD)
//     Пароль не пишется в лог. Раньше почта и пароль были зашиты в этот файл (аудит безопасности 2026-10, D-1):
//     на проде версия со старым содержимым уже применена, правка на неё не влияет (миграции выполняются один раз),
//     демо-аккаунт на проде удаляют или меняют вручную.
//  DOWN удаляет демо-пользователя только при PB_SEED_DEMO=1 и только по PB_DEMO_EMAIL.
// ============================================================

const demoEnabled = () => $os.getenv("PB_SEED_DEMO") === "1"
const demoEmail = () => $os.getenv("PB_DEMO_EMAIL") || "demo@local.test"

migrate((app) => {
  // --- 1. Ensure the 12 semesters used by SemesterSwitcher exist ("1".."12") ---
  const semesters = app.findCollectionByNameOrId("semesters")

  if (app.countRecords(semesters) === 0) {
    for (let i = 1; i <= 12; i++) {
      const record = new Record(semesters, {
        slug: String(i)
      })
      app.save(record)
    }
    console.log("Seeded 12 semesters (slugs 1..12)")
  }

  // --- 2. Демо-пользователь: только по явной просьбе (PB_SEED_DEMO=1) ---
  if (!demoEnabled()) {
    console.log("Demo user not seeded (set PB_SEED_DEMO=1 to create it)")
    return
  }

  const email = demoEmail()
  const matches = app.findRecordsByFilter("users", "email = {:e}", "", 1, 0, { e: email })
  if (matches.length > 0) {
    console.log("Demo user already present, skipping")
    return
  }

  const users = app.findCollectionByNameOrId("users")
  const user = new Record(users, {
    email:           email,
    password:        $os.getenv("PB_DEMO_PASSWORD") || $security.randomString(24),
    name:            "Анастасия",
    emailVisibility: true,
    verified:        true
  })
  app.save(user)
  console.log(`Seeded demo user ${email} (password is not logged)`)
}, (app) => {
  // Откат: убрать демо-пользователя, если он создавался (только при PB_SEED_DEMO=1, по PB_DEMO_EMAIL).
  if (!demoEnabled()) return
  const matches = app.findRecordsByFilter("users", "email = {:e}", "", 1, 0, { e: demoEmail() })
  if (matches.length > 0) {
    app.delete(matches[0])
  }
})
