/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  Волна C, этап 1б (21.10.2026): схема группы. Имена согласованы с владелицей.
//
//  Новое:
//   exam_subgroups                      подгруппы экзамена группы
//   exam_participants.subgroup          человек в подгруппе (уникальность exam+user уже есть:
//                                       один человек — одна подгруппа на экзамен)
//   exams.group                         экзамен группы
//   exam_tickets.subgroup/assignees/locked_by/locked_until
//                                       билеты подгруппы, кто взял, блокировка «Занят»
//   lecture_shares.group/allow_copy/suspended/subgroup
//                                       доступ в рамках группы, «разрешить копировать»,
//                                       приостановка при выходе, доступ подгруппе
//   access_requests                     запросы доступа к лекции
//   groups.invite_enabled               ссылка открыта/закрыта (по умолчанию закрыта;
//                                       у уже существующих групп включена, чтобы
//                                       действующие ссылки не сломались)
//   lecture_previews.course_title/course/cover_seed
//                                       название и обложка предмета в предпросмотре
//   tags.owner                          владелец тега (закрывает полностью открытую коллекцию)
//
//  Правила — «закрыто, пока не доказано обратное». Запись подгрупп, блокировок,
//  запросов и приостановки идёт только серверными маршрутами.
//  DOWN удаляет добавленное и возвращает прежние правила.
// ============================================================

const ME = "@request.auth.id";
const GUARD = `${ME} != ""`;

const SUBM = `(@collection.exam_participants:p.subgroup ?= subgroup && @collection.exam_participants:p.user ?= ${ME})`;
const T_LOCKED_FREE =
  "@request.body.locked_by:isset = false && @request.body.locked_until:isset = false && @request.body.assignees:isset = false";
const COMMON_READ =
  `(subgroup = "" && (exam.owner = ${ME} || (@collection.exam_participants.exam ?= exam && @collection.exam_participants.user ?= ${ME}) || (exam.group != "" && @collection.group_members.group ?= exam.group && @collection.group_members.user ?= ${ME})))`;

const NEW_RULES = {
  exam_subgroups: {
    list: `${GUARD} && (@collection.exam_participants:p.subgroup ?= id && @collection.exam_participants:p.user ?= ${ME})`,
    view: `${GUARD} && (@collection.exam_participants:p.subgroup ?= id && @collection.exam_participants:p.user ?= ${ME})`,
    create: null,
    update: null,
    delete: null,
  },
  exam_participants: {
    list: `${GUARD} && (user = ${ME} || (subgroup = "" && exam.owner = ${ME}) || (subgroup != "" && @collection.exam_participants:p.subgroup ?= subgroup && @collection.exam_participants:p.user ?= ${ME}))`,
    view: `${GUARD} && (user = ${ME} || (subgroup = "" && exam.owner = ${ME}) || (subgroup != "" && @collection.exam_participants:p.subgroup ?= subgroup && @collection.exam_participants:p.user ?= ${ME}))`,
    create: `${GUARD} && exam.owner = ${ME} && exam.group = "" && @request.body.subgroup:isset = false`,
    update: null,
    delete: `${GUARD} && exam.owner = ${ME} && exam.group = "" && subgroup = ""`,
  },
  exams: {
    list: `${GUARD} && (owner = ${ME} || (@collection.exam_participants.exam ?= id && @collection.exam_participants.user ?= ${ME}) || (group != "" && @collection.group_members.group ?= group && @collection.group_members.user ?= ${ME}))`,
    view: `${GUARD} && (owner = ${ME} || (@collection.exam_participants.exam ?= id && @collection.exam_participants.user ?= ${ME}) || (group != "" && @collection.group_members.group ?= group && @collection.group_members.user ?= ${ME}))`,
    create: `${GUARD} && owner = ${ME} && (@request.body.group:isset = false || @request.body.group = "" || (@collection.group_members.group ?= @request.body.group && @collection.group_members.user ?= ${ME}))`,
    update: `${GUARD} && owner = ${ME} && @request.body.group:isset = false`,
  },
  exam_tickets: {
    list: `${GUARD} && (${COMMON_READ} || (subgroup != "" && ${SUBM}))`,
    view: `${GUARD} && (${COMMON_READ} || (subgroup != "" && ${SUBM}))`,
    create: `${GUARD} && exam.owner = ${ME} && @request.body.subgroup:isset = false && ${T_LOCKED_FREE}`,
    update: `${GUARD} && ((subgroup = "" && (exam.owner = ${ME} || author = ${ME})) || (subgroup != "" && ${SUBM} && @request.body.exam:isset = false)) && @request.body.subgroup:isset = false && ${T_LOCKED_FREE}`,
    delete: `${GUARD} && exam.owner = ${ME} && subgroup = ""`,
  },
  lecture_shares: {
    create: `${GUARD} && owner = ${ME} && lecture.owner = ${ME} && grantee != ${ME} && @request.body.group != "" && @request.body.suspended:isset = false && @request.body.subgroup:isset = false`,
    update: `${GUARD} && owner = ${ME} && lecture.owner = ${ME} && @request.body.lecture:isset = false && @request.body.grantee:isset = false && @request.body.owner:isset = false && @request.body.group:isset = false && @request.body.subgroup:isset = false && @request.body.suspended:isset = false`,
  },
  tags: {
    list: `${GUARD} && owner = ${ME}`,
    view: `${GUARD} && owner = ${ME}`,
    create: `${GUARD} && @request.body.owner = ${ME}`,
    update: `${GUARD} && owner = ${ME} && (@request.body.owner:isset = false || @request.body.owner = ${ME})`,
    delete: `${GUARD} && owner = ${ME}`,
  },
};

const SHARE_OLD = "@collection.lecture_shares.grantee ?= @request.auth.id";
const SHARE_NEW = "@collection.lecture_shares.grantee ?= @request.auth.id && @collection.lecture_shares.suspended ?!= true";
const SHARE_COLLECTIONS = ["lectures", "quizzes", "quiz_questions", "quiz_answers"];
const RULE_KEYS = { list: "listRule", view: "viewRule", create: "createRule", update: "updateRule", delete: "deleteRule" };

function setRules(c, rules) {
  for (const k of Object.keys(rules)) c[RULE_KEYS[k]] = rules[k];
}
function snapshot(c) {
  const o = {};
  for (const k of Object.keys(RULE_KEYS)) o[k] = c[RULE_KEYS[k]];
  return o;
}

// Прежние правила (для down). Берутся из состояния после 1790009000.
const OLD = {
  exam_participants: {
    list: `${GUARD} && (exam.owner = ${ME} || user = ${ME})`,
    view: `${GUARD} && (exam.owner = ${ME} || user = ${ME})`,
    create: `${GUARD} && exam.owner = ${ME}`,
    update: null,
    delete: `${GUARD} && exam.owner = ${ME}`,
  },
  exams: {
    list: `${GUARD} && (owner = ${ME} || (@collection.exam_participants.exam ?= id && @collection.exam_participants.user ?= ${ME}))`,
    view: `${GUARD} && (owner = ${ME} || (@collection.exam_participants.exam ?= id && @collection.exam_participants.user ?= ${ME}))`,
    create: `${GUARD} && owner = ${ME}`,
    update: `${GUARD} && owner = ${ME}`,
  },
  exam_tickets: {
    list: `${GUARD} && (exam.owner = ${ME} || (@collection.exam_participants.exam ?= exam && @collection.exam_participants.user ?= ${ME}))`,
    view: `${GUARD} && (exam.owner = ${ME} || (@collection.exam_participants.exam ?= exam && @collection.exam_participants.user ?= ${ME}))`,
    create: `${GUARD} && exam.owner = ${ME}`,
    update: `${GUARD} && (exam.owner = ${ME} || author = ${ME})`,
    delete: `${GUARD} && exam.owner = ${ME}`,
  },
  lecture_shares: {
    create: `${GUARD} && owner = ${ME} && lecture.owner = ${ME} && grantee != ${ME}`,
    update: `${GUARD} && owner = ${ME} && lecture.owner = ${ME} && @request.body.lecture:isset = false && @request.body.grantee:isset = false && @request.body.owner:isset = false`,
  },
  tags: { list: "", view: "", create: "", update: "", delete: "" },
};

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const exams = app.findCollectionByNameOrId("exams");
  const groups = app.findCollectionByNameOrId("groups");
  const lectures = app.findCollectionByNameOrId("lectures");

  // --- exam_subgroups (создаётся первой: на неё ссылаются поля других коллекций)
  const subgroups = new Collection({
    type: "base",
    name: "exam_subgroups",
    fields: [
      { type: "relation", name: "exam", required: true, collectionId: exams.id, cascadeDelete: true, maxSelect: 1 },
      { type: "text", name: "name", required: true, max: 80 },
      { type: "relation", name: "created_by", collectionId: users.id, cascadeDelete: false, maxSelect: 1 },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE INDEX `idx_exam_subgroups_exam` ON `exam_subgroups` (`exam`)"],
  });
  app.save(subgroups); // правила — после появления exam_participants.subgroup

  // --- exams.group
  exams.fields.add(new RelationField({ name: "group", collectionId: groups.id, cascadeDelete: true, maxSelect: 1 }));
  setRules(exams, NEW_RULES.exams);
  app.save(exams);

  // --- exam_participants.subgroup
  const parts = app.findCollectionByNameOrId("exam_participants");
  parts.fields.add(new RelationField({ name: "subgroup", collectionId: subgroups.id, cascadeDelete: true, maxSelect: 1 }));
  setRules(parts, NEW_RULES.exam_participants);
  app.save(parts);
  const sg = app.findCollectionByNameOrId("exam_subgroups");
  setRules(sg, NEW_RULES.exam_subgroups);
  app.save(sg);

  // --- exam_tickets
  const tickets = app.findCollectionByNameOrId("exam_tickets");
  tickets.fields.add(new RelationField({ name: "subgroup", collectionId: subgroups.id, cascadeDelete: true, maxSelect: 1 }));
  tickets.fields.add(new RelationField({ name: "assignees", collectionId: users.id, cascadeDelete: false, maxSelect: 20 }));
  tickets.fields.add(new RelationField({ name: "locked_by", collectionId: users.id, cascadeDelete: false, maxSelect: 1 }));
  tickets.fields.add(new DateField({ name: "locked_until" }));
  tickets.indexes = [
    "CREATE UNIQUE INDEX `idx_exam_tickets_exam_subgroup_number` ON `exam_tickets` (`exam`, `subgroup`, `number`)",
  ];
  setRules(tickets, NEW_RULES.exam_tickets);
  app.save(tickets);

  // --- lecture_shares
  const shares = app.findCollectionByNameOrId("lecture_shares");
  shares.fields.add(new RelationField({ name: "group", collectionId: groups.id, cascadeDelete: true, maxSelect: 1 }));
  shares.fields.add(new BoolField({ name: "allow_copy" }));
  shares.fields.add(new BoolField({ name: "suspended" }));
  shares.fields.add(new RelationField({ name: "subgroup", collectionId: subgroups.id, cascadeDelete: true, maxSelect: 1 }));
  setRules(shares, { ...snapshot(shares), ...NEW_RULES.lecture_shares });
  // Один доступ на (лекция, получатель, группа, подгруппа): у каждой группы свои.
  shares.indexes = [
    "CREATE UNIQUE INDEX `idx_lecture_shares_lecture_grantee_group` ON `lecture_shares` (`lecture`, `grantee`, `group`, `subgroup`)",
  ];
  app.save(shares);
  // Уже выданные доступы привязываем к первой общей группе автора и получателя.
  try {
    app.db().newQuery(
      "UPDATE lecture_shares SET `group` = COALESCE((" +
        "SELECT a.`group` FROM group_members a JOIN group_members b ON a.`group` = b.`group` " +
        "WHERE a.user = lecture_shares.owner AND b.user = lecture_shares.grantee LIMIT 1), '') " +
        "WHERE `group` = '' OR `group` IS NULL"
    ).execute();
  } catch (err) {
    console.log("lecture_shares group backfill skipped:", err);
  }

  // --- access_requests
  const requests = new Collection({
    type: "base",
    name: "access_requests",
    fields: [
      { type: "relation", name: "lecture", required: true, collectionId: lectures.id, cascadeDelete: true, maxSelect: 1 },
      { type: "relation", name: "requester", required: true, collectionId: users.id, cascadeDelete: true, maxSelect: 1 },
      { type: "relation", name: "owner", required: true, collectionId: users.id, cascadeDelete: true, maxSelect: 1 },
      { type: "relation", name: "group", required: true, collectionId: groups.id, cascadeDelete: true, maxSelect: 1 },
      { type: "select", name: "status", required: true, maxSelect: 1, values: ["open", "granted", "declined"] },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_access_requests_open` ON `access_requests` (`lecture`, `requester`) WHERE `status` = 'open'",
      "CREATE INDEX `idx_access_requests_owner` ON `access_requests` (`owner`)",
    ],
  });
  setRules(requests, {
    list: `${GUARD} && (requester = ${ME} || owner = ${ME})`,
    view: `${GUARD} && (requester = ${ME} || owner = ${ME})`,
    create: null,
    update: null,
    delete: null,
  });
  app.save(requests);

  // --- groups.invite_enabled (у существующих групп — включена)
  groups.fields.add(new BoolField({ name: "invite_enabled" }));
  app.save(groups);
  app.db().newQuery("UPDATE groups SET invite_enabled = 1").execute();

  // --- lecture_previews: предмет
  const previews = app.findCollectionByNameOrId("lecture_previews");
  previews.fields.add(new TextField({ name: "course_title" }));
  previews.fields.add(new TextField({ name: "course" }));
  previews.fields.add(new NumberField({ name: "cover_seed", min: 0, max: 359 }));
  app.save(previews);

  // --- приостановка доступов: условие во всех правилах, где читают lecture_shares
  for (const name of SHARE_COLLECTIONS) {
    const c = app.findCollectionByNameOrId(name);
    for (const k of Object.values(RULE_KEYS)) {
      const cur = c[k] === null || c[k] === undefined ? "" : String(c[k]);
      if (cur.indexOf(SHARE_OLD) >= 0 && cur.indexOf("suspended") < 0) {
        c[k] = cur.split(SHARE_OLD).join(SHARE_NEW);
      }
    }
    app.save(c);
  }

  // --- tags.owner: по владельцам лекций, где тег используется
  const tags = app.findCollectionByNameOrId("tags");
  tags.fields.add(new RelationField({ name: "owner", collectionId: users.id, cascadeDelete: true, maxSelect: 1 }));
  app.save(tags);
  const rows = app.findRecordsByFilter("tags", "1 = 1", "", 100000, 0, {});
  for (const t of rows) {
    const lectureIds = t.get("lectures") || [];
    for (const lid of lectureIds) {
      try {
        const l = app.findRecordById("lectures", lid);
        const o = String(l.get("owner") || "");
        if (o) {
          t.set("owner", o);
          app.save(t);
          break;
        }
      } catch (err) {
        /* лекции уже нет */
      }
    }
  }
  setRules(tags, NEW_RULES.tags);
  app.save(tags);
}, (app) => {
  // tags
  const tags = app.findCollectionByNameOrId("tags");
  setRules(tags, OLD.tags);
  tags.fields.removeByName("owner");
  app.save(tags);

  for (const name of SHARE_COLLECTIONS) {
    const c = app.findCollectionByNameOrId(name);
    for (const k of Object.values(RULE_KEYS)) {
      const cur = c[k] === null || c[k] === undefined ? "" : String(c[k]);
      if (cur.indexOf(SHARE_NEW) >= 0) c[k] = cur.split(SHARE_NEW).join(SHARE_OLD);
    }
    app.save(c);
  }

  const previews = app.findCollectionByNameOrId("lecture_previews");
  for (const f of ["course_title", "course", "cover_seed"]) previews.fields.removeByName(f);
  app.save(previews);

  const groups = app.findCollectionByNameOrId("groups");
  groups.fields.removeByName("invite_enabled");
  app.save(groups);

  app.delete(app.findCollectionByNameOrId("access_requests"));

  const shares = app.findCollectionByNameOrId("lecture_shares");
  setRules(shares, { ...snapshot(shares), ...OLD.lecture_shares });
  for (const f of ["group", "allow_copy", "suspended", "subgroup"]) shares.fields.removeByName(f);
  shares.indexes = ["CREATE UNIQUE INDEX `idx_lecture_shares_lecture_grantee` ON `lecture_shares` (`lecture`, `grantee`)"];
  app.save(shares);

  const tickets = app.findCollectionByNameOrId("exam_tickets");
  setRules(tickets, OLD.exam_tickets);
  tickets.indexes = ["CREATE UNIQUE INDEX `idx_exam_tickets_exam_number` ON `exam_tickets` (`exam`, `number`)"];
  for (const f of ["subgroup", "assignees", "locked_by", "locked_until"]) tickets.fields.removeByName(f);
  app.save(tickets);

  const parts = app.findCollectionByNameOrId("exam_participants");
  setRules(parts, OLD.exam_participants);
  parts.fields.removeByName("subgroup");
  app.save(parts);

  const exams = app.findCollectionByNameOrId("exams");
  setRules(exams, { ...snapshot(exams), ...OLD.exams });
  exams.fields.removeByName("group");
  app.save(exams);

  app.delete(app.findCollectionByNameOrId("exam_subgroups"));
})
