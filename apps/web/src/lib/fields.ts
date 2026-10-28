/**
 * Имена физических полей БД (`FIELDS`). Реэкспортируется из `lib/types.ts`.
 */

// Поля, используемые при работе с PocketBase. Имена физических полей в БД.
// `as const` — ключи становятся литеральными типами (без `string`-размытия).
export const FIELDS = {
  courseName: "name",
  courseCoverSeed: "cover_seed",
  courseColor: "color",
  courseOwner: "owner",
  lectureTitle: "title",
  lectureContent: "content",
  // Файлы (картинки), залитые в лекцию (тип "file" в PB).
  lectureFile: "file",
  // Поле в lectures, которое ссылается на курс (id из courses)
  lectureCourse: "field",
  lectureOwner: "owner",
  lectureGroup: "group",
  lectureSlot: "slot",
  lectureDate: "lecture_date",
  lectureNumber: "number",
  // schedule_settings
  scheduleOwner: "owner",
  schedulePairTimes: "pair_times",
  scheduleOddAnchor: "odd_week_anchor",
  scheduleShowSaturday: "show_saturday",
  // schedule_slots
  slotOwner: "owner",
  slotSemester: "semester",
  slotSubject: "subject",
  slotWeekday: "weekday",
  slotPairNumber: "pair_number",
  slotWeekParity: "week_parity",
  slotKind: "kind",
  slotRoom: "room",
  slotTeacher: "teacher",
  slotDateFrom: "date_from",
  slotDateTo: "date_to",
  // schedule_slot_lectures
  slotLectureOwner: "owner",
  slotLectureSlot: "slot",
  slotLectureLecture: "lecture",
  slotLectureDate: "date",
  // tasks
  taskOwner: "owner",
  taskTitle: "title",
  taskSubject: "subject",
  taskLecture: "lecture",
  taskDue: "due",
  taskDoneAt: "done_at",
  taskSource: "source",
  taskDedupeKey: "dedupe_key",
  taskDismissed: "dismissed",
  // quizzes
  quizOwner: "owner",
  quizLecture: "lecture",
  quizSourceHash: "source_hash",
  quizSize: "size",
  quizModel: "model",
  // quiz_questions
  qqOwner: "owner",
  qqQuiz: "quiz",
  qqLecture: "lecture",
  qqPosition: "position",
  qqType: "type",
  qqTopic: "topic",
  qqPrompt: "prompt",
  qqOptions: "options",
  qqCorrectIndex: "correct_index",
  qqAnswer: "answer",
  qqExplanation: "explanation",
  qqQuote: "quote",
  qqFlagged: "flagged",
  qqHidden: "hidden",
  // quiz_answers
  qaOwner: "owner",
  qaQuestion: "question",
  qaLecture: "lecture",
  qaCorrect: "correct",
  qaAnsweredAt: "answered_at",
  qaAttempt: "attempt",
  // URL-идентификаторы (slugs)
  courseSlug: "slug",
  lectureSlug: "slug",
  semesterSlug: "slug",
  // Поля периода обучения (коллекция semesters, per-user)
  periodUser: "user",
  periodGroup: "group",
  periodLabel: "label",
  periodOrder: "order",
  periodType: "type",
  periodIsCurrent: "is_current",
  // Поля справочника universities
  universityName: "name",
  universityCity: "city",
  universityRegion: "region",
  // Поля профиля пользователя (онбординг)
  userDisplayName: "name",
  userUsername: "username",
  userCity: "city",
  userUniversity: "university",
  userUniversityCustom: "university_custom",
  userDegreeLevel: "degree_level",
  userDegreeLevelCustom: "degree_level_custom",
  userCourse: "course",
  userOnboardingCompleted: "onboarding_completed",
  // Поле в courses, которое ссылается на семестр (id из semesters)
  courseSemester: "semesters",
  // Поля коллекции tags
  tagName: "name",
  tagColor: "color",
  // Поле в tags, которое ссылается на лекции (multiple-relation)
  tagLectures: "lectures",
  // Поля коллекции lecture_previews
  previewLecture: "lecture",
  previewGroup: "group",
  previewOwner: "owner",
  previewTitle: "title",
  previewText: "preview_text",
  // Поля коллекции lecture_shares
  shareLecture: "lecture",
  shareOwner: "owner",
  shareGrantee: "grantee",
  // Поля коллекции decks
  deckTitle: "title",
  deckColor: "color",
  deckOwner: "owner",
  deckSlug: "slug",
  deckDescription: "description",
  deckIsPublic: "is_public",
  // Поля коллекции deck_cards
  deckCardFront: "front",
  deckCardBack: "back",
  // Поле в deck_cards, которое ссылается на deck (id из decks)
  deckCardDeck: "deck",
  // Файлы-вложения карточки (тип "file" в PB)
  deckCardAttachments: "attachments",
  // Ручной порядок карточки в колоде (drag-n-drop)
  deckCardPosition: "position",
  // Поля коллекции exams
  examCourse: "course",
  examTitle: "title",
  examDate: "exam_date",
  examOwner: "owner",
  examMode: "mode",
  // Поля коллекции groups
  groupName: "name",
  groupSlug: "slug",
  groupOwner: "owner",
  groupInviteCode: "invite_code",
  // Поля коллекции group_members
  memberGroup: "group",
  memberUser: "user",
  memberJoinedAt: "joined_at",
  memberPreviewEnabled: "preview_enabled",
  // Поля коллекции exam_participants
  examParticipantExam: "exam",
  examParticipantUser: "user",
  // Поля коллекции exam_tickets
  ticketExam: "exam",
  ticketNumber: "number",
  ticketQuestion: "question",
  ticketAnswer: "answer",
  ticketAttachments: "attachments",
  ticketStatus: "status",
  ticketSources: "sources",
  ticketAuthor: "author",
} as const;
