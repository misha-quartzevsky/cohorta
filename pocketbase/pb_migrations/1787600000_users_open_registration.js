/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  users — открыть самостоятельную регистрацию.
//
//  До этой миграции `createRule` коллекции `users` = null
//  (создавать запись мог только суперюзер из админки), поэтому
//  пилотных пользователей физически нечем было заводить.
//
//  Ставим `createRule = ""` — любой аноним может создать
//  учётку (email + пароль). `listRule` НЕ трогаем: он остаётся
//  закрытым («свои»), на это опирается `scripts/seed.ts`
//  (анонимный LIST коллекции `users` должен быть пустым).
//
//  Минимальную длину пароля поднимаем до 8 через `min` поля
//  `password` (в PocketBase 0.25.x опции `minPasswordLength`
//  на уровне passwordAuth ещё нет). Если поле почему-то не
//  найдено — тихо пропускаем, клиентская валидация в
//  Login.tsx всё равно требует 8 символов.
//
//  DOWN: возвращаем `createRule` к прежнему значению (null).
// ============================================================

migrate((app) => {
  const users = app.findCollectionByNameOrId("users")

  console.log("users.createRule before:", JSON.stringify(users.createRule))

  unmarshal({ "createRule": "" }, users)

  // Поднять минимальную длину пароля до 8 (best-effort).
  for (const f of users.fields) {
    if (f.name === "password" && typeof f.min !== "undefined") {
      f.min = 8
      break
    }
  }

  app.save(users)
  console.log("users: self-registration opened (createRule = \"\")")
}, (app) => {
  const users = app.findCollectionByNameOrId("users")

  unmarshal({ "createRule": null }, users)

  for (const f of users.fields) {
    if (f.name === "password" && typeof f.min !== "undefined") {
      f.min = 0
      break
    }
  }

  app.save(users)
  console.log("users: self-registration closed (createRule = null)")
})
