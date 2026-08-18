/// <reference path="../pb_data/types.d.ts" />
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

  // --- 2. Ensure the demo user exists (the users collection is auto-created by PocketBase) ---
  const demoEmail = "asyaobraz17@gmail.com"
  const demoId    = "77234u87ry5608m"

  const matches = app.findRecordsByFilter("users", `email = "${demoEmail}"`, "", 1, 0)
  if (matches.length > 0) {
    console.log("Demo user already present, skipping")
    return
  }

  const users = app.findCollectionByNameOrId("users")
  const user = new Record(users, {
    id:              demoId,   // stable id — matches the production demo account
    email:           demoEmail,
    password:        "12345678",
    name:            "Анастасия",
    emailVisibility: true,
    verified:        true
  })
  app.save(user)
  console.log(`Seeded demo user ${demoEmail} / 12345678`)
}, (app) => {
  // Optional rollback: undo the seeded records (kept minimal on purpose).
  const matches = app.findRecordsByFilter("users", 'email = "asyaobraz17@gmail.com"', "", 1, 0)
  if (matches.length > 0) {
    app.delete(matches[0])
  }
})