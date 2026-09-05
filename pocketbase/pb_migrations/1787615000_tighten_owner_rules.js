/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  Ужесточение правил: личное пространство становится личным.
//
//  courses / decks — простое owner-правило с legacy-исключением:
//    "owner = '' || owner = @request.auth.id"
//  Записи без владельца (демо-данные, старьё) остаются видны
//  всем — переходный режим. Новые записи получают владельца.
//
//  lectures — то же плюс точечный шеринг через lecture_shares:
//    view/list = owner='' ИЛИ owner=я ИЛИ есть строка доступа мне
//  Превью для группы идёт отдельной коллекцией lecture_previews
//  (её ведёт хук), сам content сюда не попадает.
//
//  users.viewRule ослабляем до "@request.auth.id != ''" — чтобы
//  ростер группы мог показывать имена/почту участников (стоковое
//  правило пускало только к своей записи). listRule НЕ трогаем:
//  перечисление пользователей остаётся закрытым.
//
//  DOWN возвращает всё к открытому состоянию (`""` / стоковый users).
// ============================================================

const OWN = "owner = \"\" || owner = @request.auth.id";
const LECT_READ =
  "owner = \"\" || owner = @request.auth.id || (@collection.lecture_shares.lecture ?= id && @collection.lecture_shares.grantee ?= @request.auth.id)";

migrate((app) => {
  const courses = app.findCollectionByNameOrId("courses");
  unmarshal(
    {
      listRule: OWN,
      viewRule: OWN,
      createRule: "@request.auth.id != \"\"",
      updateRule: OWN,
      deleteRule: OWN,
    },
    courses
  );
  app.save(courses);

  const decks = app.findCollectionByNameOrId("decks");
  unmarshal(
    {
      listRule: OWN,
      viewRule: OWN,
      createRule: "@request.auth.id != \"\"",
      updateRule: OWN,
      deleteRule: OWN,
    },
    decks
  );
  app.save(decks);

  const lectures = app.findCollectionByNameOrId("lectures");
  unmarshal(
    {
      listRule: LECT_READ,
      viewRule: LECT_READ,
      createRule: "@request.auth.id != \"\"",
      updateRule: OWN,
      deleteRule: OWN,
    },
    lectures
  );
  app.save(lectures);

  const users = app.findCollectionByNameOrId("users");
  console.log("users.viewRule before:", JSON.stringify(users.viewRule));
  users.viewRule = "@request.auth.id != \"\"";
  app.save(users);

  console.log("owner rules tightened (courses / decks / lectures); users.viewRule relaxed for rosters");
}, (app) => {
  for (const name of ["courses", "decks", "lectures"]) {
    const col = app.findCollectionByNameOrId(name);
    unmarshal(
      {
        listRule: "",
        viewRule: "",
        createRule: "",
        updateRule: "",
        deleteRule: "",
      },
      col
    );
    app.save(col);
  }
  const users = app.findCollectionByNameOrId("users");
  users.viewRule = "id = @request.auth.id";
  app.save(users);
})
