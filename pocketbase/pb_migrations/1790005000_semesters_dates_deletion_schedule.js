/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  B6 — даты периодов учёбы и отложенное удаление аккаунта.
//
//  semesters: date_from, date_to (необязательные даты). Нужны экрану
//    «Периоды учёбы» (Screen-settings-periods): образцовые даты при
//    создании, правка в настройках. Автопереключения по датам пока нет.
//
//  deletion_requests: scheduled_for (когда удалить, +14 дней) и значение
//    статуса «cancelled» (человек передумал). Создание и отмена идут через
//    серверные маршруты (pb_hooks/account_deletion.pb.js), поэтому
//    правила коллекции не меняются: клиент по-прежнему читает только свои.
// ============================================================

function hasField(col, name) {
  for (const f of col.fields) if (f.name === name) return true;
  return false;
}

migrate((app) => {
  const semesters = app.findCollectionByNameOrId("semesters");
  if (!hasField(semesters, "date_from")) {
    semesters.fields.addAt(semesters.fields.length, new Field({
      "hidden": false, "id": "date1790005001", "max": "", "min": "",
      "name": "date_from", "presentable": false, "required": false, "system": false, "type": "date"
    }));
  }
  if (!hasField(semesters, "date_to")) {
    semesters.fields.addAt(semesters.fields.length, new Field({
      "hidden": false, "id": "date1790005002", "max": "", "min": "",
      "name": "date_to", "presentable": false, "required": false, "system": false, "type": "date"
    }));
  }
  app.save(semesters);

  const del = app.findCollectionByNameOrId("deletion_requests");
  if (!hasField(del, "scheduled_for")) {
    del.fields.addAt(del.fields.length, new Field({
      "hidden": false, "id": "date1790005003", "max": "", "min": "",
      "name": "scheduled_for", "presentable": false, "required": false, "system": false, "type": "date"
    }));
  }
  const status = del.fields.getByName("status");
  if (status && status.values.indexOf("cancelled") < 0) {
    status.values = ["new", "done", "cancelled"];
  }
  app.save(del);
}, (app) => {
  const semesters = app.findCollectionByNameOrId("semesters");
  semesters.fields.removeByName("date_from");
  semesters.fields.removeByName("date_to");
  app.save(semesters);
  const del = app.findCollectionByNameOrId("deletion_requests");
  del.fields.removeByName("scheduled_for");
  const status = del.fields.getByName("status");
  if (status) status.values = ["new", "done"];
  app.save(del);
});
