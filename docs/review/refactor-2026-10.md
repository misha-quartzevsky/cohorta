# Рефакторинг cohorta: анализ и план работ (октябрь 2026)

Дата: 2026-10-26. Ветка работ: `refactor/cleanup-2026-10` (не пушить). Анализ вёлся на `design/c-group` (e45b20b). Вне объёма: `pb_migrations`, API-правила, схема, деплой-конфиги, безопасность (отложены владелицей).

## 0. Решения владельца (26.10)
- (а) Новый интерфейс единственный. `VITE_NEW_UI` и ветки старого UI удаляем (тема 5). Прод-значение флага не важно, реальных пользователей нет: **A0 закрыт**.
- (б) `NotesPage`, `ExamsPage`, `CoursesPage`, `MorePage`, `DeckEditorPage` (старая вёрстка): не удалять и не переписывать, записаны в бэклог. Если они импортируют то, что удаляется, **остановиться и спросить**.
- (в) `VerifyEmailPage` оставить.
- (г) Заготовки волны C (`joinGroupByCode`, `fetchCommonTickets`, `resetInviteCode`, `assign`, `DELETE share-subgroup`) не удалять.
- (д) Голосовой ввод (микрофон в шапке): не решаем сейчас, `SpeechProvider` и `useSpeech` не трогать. Вопрос вынесен в раздел 8.
- Порядок тем: **0 → 1 → разбор Playwright → 5 → 2 → 3 → 4 → 7 → 6 → 8 → 9 → 10**. Тема 8: `LectureView`, `Editor`, `GroupTicketPage` не резать, остальное только низкого и среднего риска. Безопасность, миграции, правила, схему не трогать (если рефакторинг упирается в схему: пометить и пропустить).
- Правила выполнения: после каждого коммита `tsc -b --noEmit`, `oxlint` (не больше 11 предупреждений), `vitest run`, `npm run build`; поведение не меняется; скриншоты до/после (десктоп и телефон) для визуальных экранов; мёртвый код удаляется отдельным коммитом после доказательства; попутные находки только в раздел 9; после запуска ревью `git diff` отдельным субагентом.

## 1. Базовая линия
Снята 26.10 на `refactor/cleanup-2026-10` до любых правок (HEAD e45b20b). Playwright: Firefox, headless, `retries: 0`, `workers: 1`, на **копии** `pocketbase/pb_data` (PocketBase 0.25.9 на `127.0.0.1:8090` с миграциями и хуками из репозитория, `--automigrate=false`; суперпользователь песочницы создан только в копии), Vite dev из `apps/web/.env` (`VITE_NEW_UI=true`).

| Проверка | Результат |
|---|---|
| `npx tsc -b --noEmit` | exit 0, ошибок нет |
| `npx oxlint` | 0 ошибок, **11 предупреждений** (6× `react(only-export-components)`: `ui/Toast.tsx:69`, `group/InvitePopover.tsx:6`, `group/GroupSidebarBlock.tsx:9`, `group/common.tsx:11`, `exam/ImportScreen.tsx:32`, `lib/undoContext.tsx:70`; 5 в скриптах и тестах: `scripts/c-seed.mjs:41`, `scripts/c-mutations.mjs:14`, `scripts/b2-drafts.mjs:108`, `scripts/b3-flow.mjs:189`, `tests/group-exams.spec.ts:8`) |
| `npx vitest run` | 32 файла, 242 теста, все зелёные, ~24 с |
| `npm run build` (`tsc -b && vite build`) | exit 0; PWA precache 316 файлов (12,4 МБ) |
| Playwright (25 спеков, 129 тестов, 33,9 мин; после разбора 27.10: 108 из 130, см. «Разбор Playwright») | **79 прошло, 50 упало**. Зелёные: все серверные спеки групп и квизов (`group-access` 13, `group-code` 9, `group-exam-link` 3, `group-exams` 11, `group-lifecycle` 14, `group-subgroup-leave` 7, `quiz-privacy` 11, `deck-card-lecture` 4), `timestamps` 2, часть `_coldload`, `decks`, `editor`, `tables` по 1–2. Красные (спека: число): `onboarding` 8, `exams` 7, `group-mode` 6, `registration` 5, `app-shell` 4, `editor` 3, `lecture-workflow` 3, `account-hygiene` 2, `auth` 2, `decks` 2, `_coldload` 1, `auth-nav` 1, `header-stability` 1, `navigation` 1, `no-duplicates` 1, `recording` 1, `referral` 1, `tables` 1. Полный список падений: см. ниже |

Всё красное из этой таблицы существует до рефакторинга и не является его результатом. Красные Playwright-спеки сосредоточены в UI-сценариях (вход, регистрация, онбординг, каркас, редактор, экзамены, режим «Группа»); серверные спеки (права, группы, квизы) зелёные. Причины по каждой спеке разбираются на этапе «разбор Playwright» (не в запуске 1): гипотеза A1 (старые селекторы `.global-sidebar`, `.app-header`, `.onb-next` при `VITE_NEW_UI=true`) покрывает не все падения; часть может быть связана с песочницей (копия локальной БД без подготовленных тестовых аккаунтов) или с данными. Это не подтверждено и до разбора не утверждается.

## 2. Сводка
- Находок: около 60. Низкий риск ~35, средний ~18, высокий ~7.
- Чисто: именование «cohorts → groups» (grep по `cohort`/`когорт` пуст); `any`, `@ts-ignore`, `TODO/FIXME`, закомментированного кода в области `lib/services/hooks` нет; готовность лекции считает один модуль (`computeLectureReadiness.ts`), дублей потребителей нет.
- Главное: старый UI и флаг (~40 файлов, `App.css` 6170 строк, ~290 неиспользуемых классов); дубли дат/месяцев/«86400000»/`currentUserId`; лишние запросы (все лекции с `content`, двойная загрузка лекции, N+1 в квизах); дубли в `pb_hooks` (~20 копий «найти или 404», 9 копий проверки участника подгруппы); пороги готовности записаны дважды (75).

### Топ-5 по пользе
1. Удалить старый UI и флаг (тема 5, после разбора Playwright).
2. Свести дубли дат, месяцев, дней недели, мс в сутки, `currentUserId()` (темы 2–3).
3. Убрать лишние запросы (тема 4): `useRecentLectures` и `fetchAllLectures` с `content`, `useReviewSuggestions` перезагружается после каждого действия, лекция грузится дважды, N+1.
4. Общие функции и структура `pb_hooks` (тема 6): `getOr404`, `isSubgroupMember`, `isLockedByOther`, `lib_db.js`, разрез `exam_groups.pb.js`; обязательно вместе с правкой регулярок `c-mutations.mjs`.
5. Тесты-страховка (тема 0): 10 дешёвых vitest-тестов на чистые функции.

## 3. Порядок работ

| № | Тема | Зачем | Оценка / риск | Чем проверять | Запуск |
|---|---|---|---|---|---|
| 0 | Тесты-страховка (раздел 7, 1–7) | ловить регрессии | S / низкий | `vitest run` | 1 |
| 1 | Мёртвое без связей: `LectureSidebar`, `SemesterSwitcher`, `TagBadges`, неиспользуемые экспорты, `shareGroupId`, лишние `export`, неиспользуемые CSS-классы (C1) | меньше шума | S / низкий | grep, tsc, oxlint, build | 1 |
| — | Разбор Playwright: красные спеки, перенос старых селекторов на новый каркас отдельным коммитом; спека на то, чего нет в новом UI: спросить, не удалять | прикрыть тестами до чистки | M–L / низкий | Playwright | 2 |
| 5 | Старый UI и флаг: сначала `isNewUI = () => true`, затем D1–D6 | главная чистка | L / высокий | всё | 2 (по слову владелицы) |
| 2 | Общие константы и хелперы: `currentUserId`, `MS_PER_DAY`, `READINESS_CONFIG`, `PARITY_LABELS`/`WeekParity`, месяцы, дни недели | убрать копипасту | S–M / низкий | vitest, tsc | 1 |
| 3 | Даты: свести дубли (не баг, см. 5.2), `formatDayMonth` | порядок | M / средний | тесты под двумя `TZ` | позже |
| 4 | Слой данных | скорость | M / средний | vitest, Playwright | позже |
| 7 | Типы | чище | M / средний | tsc | позже |
| 6 | `pb_hooks` структура | дубли, имена | M / средний | Playwright `group-*`, `c-mutations.mjs` | позже |
| 8 | Разрезы (без `LectureView`, `Editor`, `GroupTicketPage`) | читаемость | S–M | профильные спеки | позже |
| 9 | `generate.ts` + `quizLimits.ts` | один источник констант | S / M | `quizGenerate.test.ts` | позже |
| 10 | Гигиена: `*.log`, одноразовые скрипты, inline-стили | порядок | S–M / низкий | tsc | позже |

Тема 2 стоит после темы 5 в утверждённом порядке, но в запуск 1 включена по указанию владелицы; поэтому в запуске 1 она не трогает файлы, которые будут удалены в теме 5 (старые страницы), без необходимости: оставшиеся копии там уйдут вместе с файлами.

## 4. Находки по темам
Формат: файл:строка; что не так; чем заменить; размер; риск; проверка. «В» — проверено лично.

### 4.1 Старый UI и мёртвый код
- **A1. Playwright написан под старый каркас (высокий, L).** В `tests/` 0 вхождений `c-shell/c-sidebar/c-topbar`; старые селекторы `.global-sidebar`, `.app-header`, `.sidebar-note-row`, `.onb-next` в `app-shell`, `auth-nav`, `header-stability`, `helpers`, `lecture-workflow`, `no-duplicates`, `onboarding`, `_coldload`. `playwright.config.ts:38-41` поднимает `npm run dev` (читает `.env`, `true`). Результат прогона — раздел 1. (В.)
- **D1. Экраны старого UI, достижимые только при `isNewUI()===false`** (динамических импортов и `lazy()` нет): `Dashboard` (+9 файлов `pages/dashboard/*`, `useActivityTimeline`, `useCourseProgress`), `LecturesPage` (+`LectureEditor`), `LectureViewLegacy` 507 (+`ReadinessBadge`, `ShareAccessButton`, `ShareDialog`, `ShareToGroupButton`, `shareService`), `Login`, `PrivacyPage`, `GroupPage` 467 (+`useGroups`, `groupService.ts`), `NoteCreate`, `SchedulePage` 694 (+`SlotForm`), `TasksPage` 399 (+`TaskRow`), `ExamHubPage`, `ExamImportPage` (+`ExamParticipantsPanel`), `TicketView`, `TicketEdit` (+`LinkedLecturesField`), `CheatsheetPage`, `CardLibraryPage`, `CardStudyPage` (+`FlashcardPlayer`), `OnboardingWizard` 333 (+8 `Step*`). Ветки в `App.tsx:20-91,165-325`. ~40 файлов. (L; средний; после разбора Playwright.) По решению (б): если что-то из этого импортируют `NotesPage`, `ExamsPage`, `CoursesPage`, `MorePage`, `DeckEditorPage`, остановиться и спросить.
- **D2. Не импортируются нигде (низкий, S).** `components/LectureSidebar.tsx`, `SemesterSwitcher.tsx`, `TagBadges.tsx`. (В: grep по `src tests scripts functions` пуст.)
- **D3. Старый каркас в `AppLayout.tsx:106-133`:** `GlobalSidebar` 615, `BottomTabBar`, `DocumentScrollbar`, `TableOfContents`, `ModeToggle`; `GlobalSidebar.tsx:85` — прямой `pb.files.getURL`. (M; средний; проверить, не нужен ли `DocumentScrollbar` новому каркасу.)
- **D4. `Header.tsx:56` `if (isNewUI()) return null;`,** а вставлен в 8 живых мест (`DashboardNew:159`, `CoursesPage:90`, `ExamsPage:60`, `NotesPage:69`, `DeckEditorPage:332/352/371`, `LectureLayout:59`, `SemesterGate:33`, `App.tsx:126`); хуки `useUiShell`/`useSpeech` выполняются впустую. **Ограничение (б), (д):** `CoursesPage`, `ExamsPage`, `NotesPage`, `DeckEditorPage` в бэклоге, `Header` содержит микрофон и использует `useSpeech`: убирать вставки только после ответа на вопрос из раздела 8. (В.)
- **D5. Хвосты флага в живых файлах:** `featureFlags.ts:7-9` (комментарий «старый по умолчанию» неверен), `LectureView.tsx:45,439` (условие всегда true), `App.tsx:163-166`, `.env.example:8`, устаревшие комментарии (`AppShellNew.tsx:13-15`, `components.css:1602-1604`, `main.tsx` про вес 700, `SchedulePageNew.tsx:19`, `TasksPageNew.tsx:12`, `ExamHubPageNew.tsx:16`, `LecturesAllPage.tsx:13`, `SubjectLecturesPage.tsx:12`). 30 вызовов `isNewUI()` (В). Не путать с `VITE_AUTH_EMAIL` (живой). (S; низкий.)
- **D6. Переименование `*New`** после удаления старых: `DashboardNew`, `TicketPageNew`, `SchedulePageNew`, `TasksPageNew`, `CardsPageNew`, `DeckPageNew`, `CardReviewPageNew`, `ExamHubPageNew`, `ExamImportPageNew`, `CheatsheetPageNew`, `OnboardingNew`, `LoginPageNew`, `PolicyPageNew`, `AppShellNew`, `SlotFormNew`, `TaskRowNew`; `App.tsx:164` импортирует `LectureView` как `LectureViewNew`. (M; низкий; tsc.)
- **D7. Живые страницы старой вёрстки: бэклог (решение б).** `CoursesPage`, `ExamsPage`, `NotesPage`, `DeckEditorPage` 455, `MorePage` (+`CourseTile`, `CourseCard`, `CourseFormTile`, `LectureTile`, `AddTile`, `InlineEditor`, `ExamCourseCard`). Не удалять и не переписывать. Входящих ссылок на `/notes`, `/s/:sem/exams` в новом UI нет; единственный тест на `/notes`: `tests/app-shell.spec.ts:84`.
- **D8. Две библиотеки UI:** `components/ui/` (`ds-*`, 14 файлов) и `ui/` (`c-*`). В новом UI живёт только `components/ui/Toast.tsx` (`App.tsx:175`, `LectureView:77`, `useLectureActions:14,57`); второй механизм уведомлений в `NotifyProvider`. Перенести `Toast` в `ui/`, удалить остальное после D1 **если его не используют страницы из бэклога (б)**. (M; средний.)
- **Три файла палитры не мёртвые:** `lib/subjectPalette.ts` (`components/ui/SubjectCover`, `DesignPage`), `lib/courseGradient.ts` (7 потребителей, в т. ч. `CourseCard`, `ExamCourseCard`, `LectureTile`), `lib/colors.ts` (`CourseFormTile`, `DeckEditorPage:45`, `useCourseForm`, `courseService.ts:16,61 randomCourseColor` — вызывается и новым `SubjectFormDialog:56`). Часть держится страницами из бэклога (б): не удалять. (L; высокий.)
- **Неиспользуемые экспорты (0 ссылок вне определения; В: проверяется перед удалением в теме 1):** `examService.ts:141 updateExam`, `:154 deleteExam`; `groupService.ts:132 resetInviteCode`, `:138 transferGroup`; `lectureService.ts:235 assignLecture`, `:357 deleteLectureFiles`; `scheduleService.ts:282 deleteSlotLectureLink`; `fileTokens.ts:73 embedBareFileUrls`; `quizLimits.ts:23 charsMissing`; `types.ts:847 memberGroupId`, `:373 PremiumGrant`; `useActivityHeatmap.ts:49 HEATMAP_DAYS`. Лишний `export` у используемых только внутри файла: `getTicket`, `collectExport`, `fetchSettings`, `createDefaultSettings`, `updateTagLectures`, `truncateAtWord`, `DEFAULT_PAIR_TIMES`, `academicYearStart`, `TimeoutError`, `UNDO_WINDOW_MS`, `updateMyProfile`, ~20 типов `Use*Result`; `lib_previews.enabledGroups`, `lib_referral.REWARD_DAYS`. **Не удалять по решению (г):** `joinGroupByCode` (`groupApi.ts:263`), `fetchCommonTickets` (`groupExamApi.ts:58`), `resetInviteCode` (`groupService.ts:132`), маршруты `assign` и `DELETE share-subgroup`. Неиспользуемые ключи `FIELDS`: часть задел под будущее, не трогать без проверки.
- **CSS (по токенам в .ts/.tsx; динамические `ds-btn--*`, `ds-badge--*` вычтены).** C1: без использования `App.css` 28 классов, `components.css` 39, `group.css` 3. **Не трогать:** `tableWrapper`, `selectedCell`, `column-resize-handle` (Tiptap, могут создаваться в рантайме) и `cover-*` до проверки `subjectPalette.ts`. C2: 263 класса `App.css` и 52 `components.css` держатся только старым кодом: удалять вместе с D1 (учесть бэклог (б): их классы остаются). C3: `LectureView.tsx:408 var(--color-accent-soft, #FCE9DD)`, токен называется `--accent-soft` (`components.css:1493`): запасной hex срабатывает всегда (это правка отображения; поведение/вид не меняется только если значения совпадают — проверить скриншотом); `TagEditor.tsx:13-18,78,89` `#5843f6`; `components.css:1480,1493`.
- **Мусор вне `src`:** `apps/web/*.log`, ~45 одноразовых `scripts/b*-c*.mjs` (4 611 строк), в корне `pb-run.log`, `pw-*.log`, `test-results/`. (S; низкий; тема 10.)

### 4.2 Дубли
- **U1. Даты и месяцы.** `DraftsPage.tsx:30-35` = `lectures/LectureGroupList.tsx:23-30`; `schedule/AttachLectureModal.tsx:6-11 formatDateRu`; `lectureMeta.ts:5`; `format.ts:100`; `LecturesAllPage.tsx:66`, `DayDetailPopover:104`, `StudyWeekStrip:100`, `DashboardNew.tsx:58`. Месяцы: `SchedulePageNew.tsx:64`, `TrashPage.tsx:16`, `groupExamText.ts:27`, `studyPeriods.ts:150 MONTHS_MOCK`, `deletionService.ts:88`, `groupApi.ts:324,331`, `taskView.ts:12`. Дни недели: `DashboardNew.tsx:44`, `StudyWeekStrip:35`, `SlotForm.tsx:8`, `SlotFormNew.tsx:9`, `SchedulePageNew.tsx:63`. Один набор в `lib/format.ts`. (M; низкий; перед заменой зафиксировать текущие строки тестами.)
- **U1b. Разбор даты PocketBase: дубль, не баг (пересмотрено).** `parsePbDate` (`format.ts:55-62`, 21 использование) и 15 мест `new Date(x.replace(" ", "T"))` (`types.ts:673 isPremiumActive`, `groupExamText.ts:6,31`, `notifyCtx.ts:44`, `NotifyProvider.tsx:31`, `GroupLecturePage.tsx:179`, `GroupTicketPage.tsx:35`, `LectureView.tsx:144`, `LectureViewLegacy.tsx:151`, `TrashPage.tsx:19`, `deletionService.ts:92`, `groupApi.ts:322,330`, `trashService.ts:54`). Реальный ответ PocketBase содержит `Z`: `"created":"2026-10-16 06:06:05.176Z"` (ответ прода на анонимный запрос к `semesters`). Значит `replace(" ","T")` даёт корректный ISO в UTC, и расхождения нет. Багом это можно называть только после воспроизведения тестом под двумя `TZ` на значениях без `Z` (например, дата, записанная хуком или клиентом без зоны). До этого: дубль, сводится к `parsePbDate` в теме 3 без изменения поведения. Оставшийся вопрос: `examService.ts:67` берёт UTC-день `toISOString().slice(0,10)`, остальные места локальный `todayStr()` — отличие поведения вокруг полуночи, фиксировать тестом, не «чинить» (в раздел 9).
- **U2. Расписание.** Якорь чётности `settings?.odd_week_anchor ? fromDateStr(...) : mondayOf(now)` в `DashboardNew.tsx:110`, `SubjectPairsPage.tsx:91`, `SchedulePageNew.tsx:112-114`, `TodayWidget.tsx:40`, `SchedulePage.tsx:95`; перебор 14 дней «ближайшая дата»: `SubjectPairsPage.tsx:99-109`, `SchedulePageNew.tsx:745-752`; фильтр «сегодня» `DashboardNew.tsx:113-116`. Метки `PARITY` в 4 местах (`slotConflict.ts:32-36`, `SubjectPairsPage:43`, `accountExport.ts:17`, `SchedulePageNew:191,214`); `parityOverlaps` и `slotMatchesParity`; `week_parity: string` вместо `WeekParity`. В `lib/weekParity.ts`: `anchorOf`, `nextOccurrence`, `slotsOnDate`. (M; средний; `weekParity.test.ts`, `slotConflict.test.ts`.)
- **U3. Права в UI.** «Я владелец лекции» вручную: `UnderstandingScope.tsx:33`, `QuizPage.tsx:66`, `CardFormDialog.tsx:48`, `ExamParticipantsPanel.tsx:43`; при существующем `lectureOwnerId` (`types.ts:614`). Группа: `groupApi.ts:97`, `GroupPage.tsx:115`, `GroupAccessPage:75-76`, `GroupMemberPages:89-90,141`, `GroupSettingsPage:208-209`, `GroupHomePage:53`. `lib/access.ts` с чистыми функциями + тесты. UI-проверки только подсказка, право решает сервер. (M; средний.)
- **U4. Ошибки.** `errorMessage` (`format.ts:81-83`, 28 использований) отдаёт сырой английский текст PocketBase (это поведение: только пометить, раздел 9); ручные `e instanceof Error` в `JoinGroupPage:42,81`, `OnboardingNew:188`; ручной разбор `{status, response}` в `deletionService:75`, `groupExamApi:123,136`, `draftSync:34`, `draftQueue:83`, `authErrors:18` → `lib/pbError.ts` (M; низкий–средний). `LectureView.tsx:439` и `LectureViewLegacy:406` определяют «не найдено» регуляркой по тексту ошибки (S; средний). `authErrors.ts:42-49`: две ветки возвращают одну строку. Тихие `.catch(() => {})` ~25 в живом коде; `DashboardNew:104` глотает ошибку без индикации (раздел 9).
- **U5. Готовность лекции:** расчёт один, потребители не дублируют. Но: «последний квиз и скрытые вопросы» посчитаны дважды (`computeLectureReadiness.ts:103-111`, `quizPanelState.ts:61-73`), `normalizeTopic` и `topicKey` (`quizSummary.ts:37`), порог слабой темы 0.6 и «до 3» в двух файлах; `READINESS_THRESHOLDS.done = 75` (`:46`) и `REVIEW_THRESHOLD = 75` (`getReviewSuggestions.ts:47`) записаны дважды; магические 0.5/0.8, 21, 0.7+0.3, 60, 0.6/0.4. Свести в `READINESS_CONFIG` и `latestQuizQuestions()` (S; средний; тесты формулы).
- **U6. День в мс:** `86400000` в `computeLectureReadiness:64`, `getReviewSuggestions:55`, `groupExamText:10`, `lectureMeta:13`, `localDate:55`, `types:793`, `trashService:56`, `UnderstandingScope:290`, `useActivityHeatmap:109`, `useCourseProgress:47`. Округление разное (`floor` в формуле, `round` в подсказках): общая константа `MS_PER_DAY`, округление не унифицировать. Две «дней до экзамена»: `types.ts:786-794` и `groupExamText.ts:4-12` (разная семантика прошедших дат).
- **U7. `currentUserId()` — 14 копий:** `courseService, deckService, deletionService, examService, groupService, lectureActions, lectureService, quizService, scheduleService, searchService, semesterService, shareService, taskService`, `groupApi.ts:69`, `groupExamApi.ts:15`; inline в `accountExport:44`, `onboardingService:21`, `profileService:12`, `tagService:36` → `lib/pocketbase.ts` (S; низкий).
- **U8. Фильтры PocketBase:** 38 `pb.filter({:x})` против ~18 склеек (`quizService.ts:79,260,291,315,318,354`, `lectureService:43`, `courseService:69,143`, `examService:99`, `scheduleService:235`, `searchService:76,87,107`, `useLastVisited:28`); `genericService.ts:44` (`slug` из URL). Замена на `pb.filter` не должна менять результат запросов (S–M; низкий; `navigation`, `lecture-workflow`).
- **U9. Прочее:** 132 inline `style={{`; 16 литералов `setTimeout(…, NNN)`, `RETRY_MS`, `POLL_MS`, `3500`, `3000`, `150`, `2000`/`1e9`. Тексты интерфейса внутри логики: i18n не нужен (интерфейс только русский).

### 4.3 Размер и ответственность (файлы >300 строк)
Резать (низкий и средний риск, тема 8): `SchedulePageNew` 855 (`SchedulePage`/`WeekGrid`+`SlotCard`/`MobileDayPairs`/`SchedulePanel`; M; средний), `AppShellNew` 569 (`shell/{Sidebar,SidebarLectureToc,SidebarCourses,MobileTabBar,Topbar,hooks}`; M; средний), `TasksPageNew` 483 (S; низкий), `OnboardingNew` 467 (19 `useState`; `useOnboardingForm` + шаги; M; средний), `SettingsPeriodsPage` 414 (`toRows`, `rowProblem` в `studyPeriods.ts`; S), `SlashMenu` 411 (S), `QuizPage` 401 (`QuizQuestionView`; S). **В этом заходе не резать (решение владельца):** `LectureView` 527, `Editor` 474, `GroupTicketPage` 434. Остальное рядом с порогом: `DashboardNew` 369, `SubjectPairsPage` 355, `GroupExamPage` 354, `SettingsPage` 353, `LecturesAllPage` 353, `ExamHubPageNew` 347, `GroupSettingsPage` 345, `App.tsx` 336 (сократится после D1), `useLectureActions` 318; сервисы `groupApi` 378, `quizService` 369, `examService` 368, `lectureService` 367. `DeckEditorPage` 455 — в бэклоге (б). `lib/types.ts` 854: интерфейсы + `FIELDS` (268 использований) + геттеры + логика → `types`/`fields`/`accessors` с реэкспортом (M; низкий). CSS: `App.css` 6170, `components.css` 4046. Старые (уйдут с темой 5): `SchedulePage` 694, `GlobalSidebar` 615, `LectureViewLegacy` 507, `GroupPage` 467, `TasksPage` 399, `OnboardingWizard` 333.

### 4.4 Данные и состояние
- **P1. Прямой `pb.collection` в UI:** `GroupAccessPage:54,69,82`, `GroupLecturePage:45,138,142`, `LectureAccessDialog:58,60,138`, `ResetPages:88,151,198`; `pb.files.getURL` в `group/common.tsx:18` и `GlobalSidebar:85` → `avatarUrl(user)`. (M; средний.)
- **P2. `GroupAccessPage:52-87`:** зависимости эффектов от `groups.length`, `data.shares.length/requests.length` (`eslint-disable`), нет флага `alive`, фильтр склейкой `id="${id}"` (S; средний).
- **P3. `eslint-disable react-hooks/exhaustive-deps`:** `TicketPageNew:105` (прокомментирован), `GroupTicketPage:144`, `SettingsPeriodsPage:99`, `LectureView:417`, `JoinGroupPage:54`, `LecturePickerDialog:47`, `SlotFormNew:90`, `DateField:27`, `StepCityUniversity:57`, `StepPeriods:57`: разбирать по одному.
- **P4. Дубль состояния:** `TicketPageNew:90-105` (`useRef` + `useState` + эффект синхронизации; высокий риск); `LecturesAllPage:262-282` вручную `fetchSlots` при наличии `useSchedule`; `DashboardNew:98-104` вручную курсы при наличии `useCourses`.
- **P5. Гонка в `useAsyncData` (`hooks/useAsyncData.ts:47-62`):** `setData` без проверки актуальности, `pb.autoCancellation(false)` (`lib/pocketbase.ts:22`); счётчик запросов, как в `useLectureReadiness.ts:244-262` (S; низкий–средний; это исправление гонки: если меняет видимое поведение, остановиться и спросить).
- **P6. `useReviewSuggestions.ts:50-57`:** `fetcher` зависит от `existingDedupeKeys`; после каждого выполнения/скрытия задачи повторно 3 запроса; фильтр по dedupe сделать в `useMemo` (S; низкий).
- **P7. Дубль загрузки «лекции + вопросы + ответы»:** `useLecturesOverview.ts:30-45` и `useReviewSuggestions.ts:17-47` → общий `loadLectureReadinessRows()`; N+1 `quizService.ts:256-285` (`getOne("quizzes")` на каждый квиз; пакетная версия `:307` делает один `getFullList`); без `fields` у `fetchReadinessQuestionsByLecture:314`, `fetchReadinessAnswersByLecture:353` (S; низкий).
- **P8. Лишние данные:** `useLectures(courseSlug)` ради одного курса (`AppShellNew:167`, `GlobalSidebar:241`, `LectureLayout:32`) → `useCourseBySlug`; лекция грузится дважды (`AppShellNew:542` и `LectureView:73`); `useRecentLectures` (`lectureService:56-65`) читает всю библиотеку с `content` ради `slice` (вызовы `AppShellNew:81`, `GlobalSidebar:175`, `DashboardNew:94` `useRecentLectures(1)`, `useActivityHeatmap:79` `1e9`, `useCourseProgress:41` `2000`, `useActivityTimeline:71`, `NotesPage:40`); `fetchAllLectures:71` с `content`; `courseService:136-152 fetchLatestLectureTitles` последовательный цикл; `useSchedule.ts:36-51` без `useAsyncData`; `GroupProvider` и `useGroupData` оба слушают `window.focus`, `fetchGroupSummaries` (`groupApi:85-98`) в цикле по группам. (M; средний; сверить, кто использует `lectureBody`/`lectureExcerpt`.)

### 4.5 Типы
- `any` в lib/services/hooks нет. `as unknown as`: `NotifyProvider.tsx:91,104`, `groupApi.ts:157`, `groupService.ts:210` (фейковый `GroupMember`), `SpeechProvider:60` (не трогать, (д)), `renderLatex.ts:50`, `SketchModal.tsx:34,52 (useRef<any>)`, `main.tsx` (`window.EXCALIDRAW_ASSET_PATH` → `declare global`). `TasksPageNew:63,191` касты прячут `undefined`.
- `pocketbase/pb_data/types.d.ts` (24 372 строки) **не** описывает схему (декларации JSVM для хуков и миграций): генерировать типы из него нельзя. Вариант без новых библиотек: скрипт `apps/web/scripts/gen-types.mjs`, читающий `GET /api/collections` локального PocketBase. До этого источник правды `lib/types.ts`.
- Необязательные поля, которые на деле обязательны (только пометить, сверять с `required` в миграциях): `Lecture.slug?/Course.slug?/Deck.slug?` (для обязательности нужна миграция: вне объёма), `ScheduleSlot.week_parity?/kind?`, `QuizAnswer.correct?`, `Quiz.size?`, `QuizQuestion.prompt?/topic?`; `Lecture.title`/`Course.name` обязательны, но геттеры и 19 `String(x.title ?? …)` страхуются. Затрагивает 268 использований `FIELDS.*`.
- Дубли проекций: `PanelAnswer`, `QuestionRef/AnswerRef` → `Pick<…>`; `SuggestionLecture` и `LectureOverviewRow`; `GroupSummary/RosterPerson/Group/GroupMember/GroupData` (два параллельных слоя `groupService` (легаси) и `groupApi`; первый уйдёт в теме 5).

### 4.6 `pb_hooks` и `functions` (поведение не менять)
**Главный риск:** `apps/web/scripts/c-mutations.mjs:129-159` находит места для мутаций регулярками по именам файлов и точным строкам кода. Перенос или переименование ломает мутации: править регулярки в том же коммите. Имена хуков есть и в `docs/decisions.md`, `docs/design/PROGRESS.md`, `prod-rollout-runbook.md`, `prod-access-hotfix-plan.md`, `docs/recon-cohorta-ui.md`, `groupService.ts`. Внешний API `lib_groups.js` не менять (реэкспорт).
- **H1.** «Найти по id или 404» ~20 копий (`exam_groups.pb.js` 20, `group_access` 12, `trash` 6, `groups_access` 5, `lib_groups` 4, `groups_manage` 3) → `getOr404`; тексты сохранить. `groups_manage.pb.js:149` без `try`: неизвестный id даёт стандартную ошибку PocketBase (расхождение поведения: зафиксировать тестом, раздел 9).
- **H2.** Участник подгруппы: 9 копий (`lib_groups.js:70,107`, `exam_groups.pb.js:234,244,269,300,326,484`, `group_access.pb.js:40`) → `isSubgroupMember`; блок «билет + участие» в `assign`, `lock`, `unlock`, `take-my-answer` → `memberTicket(e)`.
- **H3.** Блокировка билета: `exam_groups.pb.js:276,330,489`, `inSeconds(30)` `:279,349,493` → `isLockedByOther`, `LOCK_SECONDS`.
- **H4–H6.** Создание `lecture_shares` 3 копии (`lib_groups.js:93-101`, `group_access.pb.js:55-63,167-174`); подпись «имя, иначе почта до @» 3 копии (`group_access.pb.js:237-245`, `groups_access.pb.js:91-98,224-231`, результат при ошибке различается); `.toISOString().replace("T"," ")` 5 копий (`account_deletion:50,78`, `trash:104,237`, `group_access:236`).
- **H7.** Корзина: каскад «предмет + лекции» трижды (`trash.pb.js:202-211,222-229,239-246`), ветвление по типу в `delete/restore/purge` → `lib_trash.js`; без тестов на `trash/purge`, `trash/empty`, cron: сначала тест; 403 на чужое в `trash` не унифицировать.
- **H8–H10.** `first`/`all`/`nowStr` → `lib_db.js` (реэкспорт из `lib_groups.js`); `exam_pok.pb.js` дважды читает один экзамен (`lib_exam.js:30-37`, `exam_pok.pb.js:35-39`; fail-open); двойной `require` `groups_access.pb.js:26,40`.
- **Мёртвое:** `shareGroupId` (`lib_groups.js:35-42,283`, 0 вызовов), экспорты `enabledGroups`, `REWARD_DAYS`; устаревший комментарий `group_access.pb.js:66-68`. Маршруты, не вызываемые клиентом (`DELETE share-subgroup`, `assign`): оставить (г), пометить в заголовке.
- **Имена (структурно, не в этом заходе):** `groups_access.pb.js` → `groups_join.pb.js`; `group_access.pb.js` → `lecture_sharing.pb.js`; `exam_groups.pb.js` 496 → `exam_subgroups.pb.js` + `exam_tickets.pb.js`; `lib_exam.js` → `lib_exam_pok.js`. Заголовки-комментарии устарели (`groups_manage.pb.js:10-14`, `groups_access.pb.js:10-12`, `exam_groups.pb.js:6-17`).
- **Ошибки/числа:** проглоченные ошибки `account_deletion.pb.js:22-26,30-34,41-45,80-84`, `trash.pb.js:32-36,43-47,58-62` (логировать, поведение оставить); дубли текстов «Этот человек не состоит в группе.» и «Выбери другого участника.»; константы: блокировка 30 с, удаление 14 дней, корзина 30 дней (`days: 30` в ответе и литерал в cron), лимиты `rateLimit`.
- **`functions/api/quiz/generate.ts` 422 строки:** 300 знаков (`MIN_TEXT_LENGTH:66` и `QUIZ_MIN_CHARS`) и размеры 5/8/12 (`ALLOWED_SIZES:64` и `QUIZ_SIZES`) продублированы, дубль признан комментарием; тест `quizGenerate.test.ts:114,124` хардкодит. Дёшево: тест-паритет. Полноценно: `quizConfig` и разрез на `src/server/*` (всё из `functions/` Cloudflare превращает в маршруты; сборка Cloudflare, `export startOfDayUtc` используется тестом). `callGemini` 5 позиционных аргументов, `generateValidated` 6. `pbQuizzesToday` при `!res.ok` возвращает 0 (молча отключает лимит) — только отметить (раздел 9).

## 5. Пересмотренные оценки (по решениям владельца)
1. **A0 закрыт:** прод-значение флага не нужно.
2. **U1b не баг:** PocketBase отдаёт `Z`, 15 мест с `replace(" ","T")` корректны; это дубль. Баг заявляется только после теста под двумя `TZ`.
3. **D4, D8, палитры:** зависят от страниц из бэклога (б) и от вопроса про микрофон (д): без ответа не трогать.

## 6. Что трогать нельзя или рискованно
- Всё, что требует миграции, правил, схемы: пустые `slug`, поля `required`, `courses.color`.
- Удаление старого UI без прогона Playwright и без решения по D4/D8.
- `lib/subjectPalette.ts`, `courseGradient.ts`, `colors.ts`: живые через страницы из бэклога и `courseService.createCourse`.
- CSS-классы Tiptap-таблиц и `cover-*` без проверки.
- `LectureView`, `Editor`, `GroupTicketPage` (по решению), `TicketPageNew` (дубль состояния).
- `groupService.ts`/`useGroups` до удаления флага (`App.tsx:215`).
- `pb_hooks`: переносы без правки регулярок `c-mutations.mjs`; `exam_pok.pb.js` fail-open; `trash` 403/404; различия `userLabel`; `floor/round` в днях.
- `trash/purge`, `trash/empty`, cron `trash_purge`/`account_deletion`: без тестов, необратимо.
- `SpeechProvider`, `useSpeech` (решение д).
- Заготовки волны C и `VerifyEmailPage`.

## 7. Какие тесты добавить первыми (vitest, `environment: node`, без новых зависимостей)
1. `lib/format.test.ts` (дописать): `parsePbDate` (с `Z`, без зоны, `+03:00`, `null`, мусор) — заодно отвечает на вопрос 5.2 под двумя `TZ`.
2. `lib/types.test.ts` (новый): `isPremiumActive`, `examDaysLeft`, `lectureHref`, `lectureExcerpt`.
3. `computeLectureReadiness.test.ts` (дописать): два квиза — берётся новый; границы тем 0.5/0.8; `weakTopics` ≤ 3.
4. Паритет порогов: `READINESS_THRESHOLDS.done === REVIEW_THRESHOLD` (после экспорта константы; экспорт без смены значения).
5. `getReviewSuggestions.test.ts` (дописать): >3 кандидатов → ровно 3; без дублей между «повторить» и «давно».
6. `lib/taskView.test.ts` (новый): `dueLabel`, `isOverdue`, `taskInPeriod`.
7. `weekParity.test.ts` (дописать): `dateForWeekday` (воскресенье, смена года), `slotMatchesParity(undefined, …)`.
8. `draftSync` (чистое ядро или `vi.mock("./lectureService")`): 404 удаляет черновик, `failed` не удаляет, новая версия во время отправки сохраняется (M).
9. `errorMessage`/`registerErrorMessage` на структурах PocketBase.
10. `lib/access.test.ts` (вместе с U3).
Серверная сторона: `node scripts/c-mutations.mjs` до и после каждого переноса; тест на `trash/purge`/`trash/empty` до выноса `lib_trash.js`; тест 404 на `POST /api/groups/{id}/leave` с неизвестным id до `getOr404`; тест-паритет `quizLimits` ↔ `generate.ts`.

## 8. Вопросы владельцу
- **Голосовой ввод (д):** `Header` (микрофон, `useSpeech`) в новом UI возвращает `null` (`Header.tsx:56`), но вставлен в 8 страниц, часть из них из бэклога (б). Хуки `useUiShell`/`useSpeech` внутри выполняются впустую. Пока `SpeechProvider` и `useSpeech` не решены, `Header` не удаляется. Нужно решение: возвращать ли диктовку в новый каркас, и если нет, то когда убирать.
- Конец тем 5/8: страницы из бэклога (б) используют `components/ui/`, палитры и (частично) `Header`: при столкновении остановлюсь и спрошу.

## 9. Нашёл по пути
(попутные находки; не исправлялись)
- `errorMessage` (`format.ts`) отдаёт пользователю сырой английский текст PocketBase.
- `DashboardNew.tsx:104` глотает ошибку загрузки лекций без индикации.
- `examService.ts:67` берёт UTC-день (`toISOString().slice(0,10)`), остальные места локальный `todayStr()`: расхождение около полуночи.
- `groups_manage.pb.js:149`: `findRecordById("groups", …)` без `try`, неизвестный id даёт стандартную ошибку PocketBase, а не 404 «Группа не найдена.».
- `pbQuizzesToday` (`generate.ts`) при `!res.ok` возвращает 0 и молча отключает дневной лимит.
- `authErrors.ts:42-49`: две ветки `registerErrorMessage` возвращают одну и ту же строку (мёртвая проверка `raw`).
- `LectureView.tsx:408` ссылается на несуществующий токен `--color-accent-soft` (токен называется `--accent-soft`), поэтому всегда срабатывает запасной hex.
- Комментарий к `parsePbDate` (`format.ts`) говорит, что Firefox не разбирает «2026-01-15 10:00:00.123Z». Проверено 26.10 в установленном Firefox (Playwright): `new Date("2026-10-26 00:00:00.000Z")` и вариант с `T` дают одно и то же значение. Комментарий устарел; места, где даты PocketBase разбираются без `parsePbDate` (например `examDaysLeft` в `types.ts`), в Firefox работают.
- Метки чётности недели (`slotConflict.ts`, `SubjectPairsPage`, `accountExport`, `SchedulePageNew`, формы пары) оказались не дублями, а разными формулировками («на нечётных неделях», «нечётные недели», «нечётная», «Нечётные»): не объединялись, чтобы не менять тексты интерфейса. Массивы дней недели тоже разной длины и формы (6 и 7 дней, с полными названиями); общим остался бы только `DashboardNew` + старый `StudyWeekStrip`.
- `getReviewSuggestions.test.ts` уже покрывал «не больше 3 подсказок» и отсутствие дублей: отдельный тест не добавлялся.
- Правки `pb_hooks` подхватываются PocketBase только после ручного перезапуска (`File … changed, please restart the app manually`); на песочнице перезапускал по PID.
- Блок «последний квиз и скрытые вопросы» остаётся продублированным в `computeLectureReadiness.ts` и `quizPanelState.ts` (формула критична, вынесение отложено в тему 4/7).
- `oxlint` (11 предупреждений) включает `scripts/` и `tests/`; `tests/group-exams.spec.ts:8` импортирует неиспользуемый `grantShare`.

## 10. Итоги запусков
### Запуск 1 (26.10): темы 0, 1, 2
Ветка `refactor/cleanup-2026-10`, не запушена. Проверки после каждого кодового коммита: `tsc -b --noEmit` exit 0, `oxlint` 11 предупреждений (как в базовой линии), `vitest run` зелёный, `npm run build` exit 0. Тема 5 не начиналась.

| Коммит | Тема | Файлов | + / − |
|---|---|---|---|
| 0abeb2e | отчёт, базовая линия | 1 | +214 / 0 |
| 2fd41d5 | 0: тесты-страховка | 6 | +334 / −1 |
| da9ef42 | 1: удалены `LectureSidebar`, `SemesterSwitcher`, `TagBadges` | 3 | 0 / −158 |
| 9d50e7e | 1: удалены функции без вызовов | 5 | 0 / −63 |
| 366b6c4 | 1: лишний `export` у 10 символов | 8 | +10 / −10 |
| b4920e0 | 1: `shareGroupId`, экспорты `enabledGroups`, `REWARD_DAYS` (pb_hooks) | 3 | +1 / −13 |
| b5bd876 | 1: удалены правила 69 CSS-классов (100 правил) | 3 | +3 / −515 |
| 07c158c | 2: `currentUserId()` | 20 | +37 / −93 |
| ec6cb59 | 2: `MS_PER_DAY` | 10 | +24 / −11 |
| 21e8e02 | 2: пороги готовности лекции | 4 | +33 / −9 |
| aadc61f | 2: `MONTHS_GENITIVE`, `MONTHS_SHORT` | 7 | +20 / −38 |
| итого | | 56 | +676 / −911 |

Тесты: 242 → 301 (+59: `format`, `types`, `taskView`, `authErrors`, готовность лекции, `dateForWeekday`, паритет порогов). Серверные Playwright-спеки после правки `pb_hooks` (8 файлов, 72 теста) зелёные на песочнице. Экраны: 20 маршрутов × 2 ширины (1440 и 390), снимки до/после совпадают побайтно после коммитов CSS, `currentUserId` и месяцев (форма новой группы со случайным кодом исключена: нестабильна и до правок). Скрипты для сверки (`apps/web/scripts/refactor-shots.mjs`, `css-unused.mjs`) не закоммичены.

Не сделано в запуске 1 (осознанно): тест 8 (`draftSync`) и тест 10 (`access.ts` ещё нет); метки чётности и дни недели (не дубли, см. раздел 9); разбор красных Playwright-спек (следующий запуск, до темы 5).

### Запуск 2 (27.10): разбор красных Playwright
Коммиты (только тесты и тестовая инфраструктура, код продукта не менялся): 91ead0a (вход, регистрация, онбординг, политика, удаление), e576cb5 (каркас), ee9028d (редактор, таблицы), b325304 (экзамены), 2dc619d и 7e4d05b (group-mode, referral), cab3d41 (`scripts/e2e-sandbox.mjs`), 949c41a (`repro-desktop-logout.mjs`). Playwright: было 79 из 129, стало 108 из 130. Тема 5 не начиналась. Раздел «Разбор Playwright» выше.

## Разбор Playwright (27.10)

Метод: песочница на копии `pocketbase/pb_data` (теперь `apps/web/scripts/e2e-sandbox.mjs`), красные спеки запускались по одной (`--workers=1`, trace и скриншот при падении, таймаут 15–40 с), для каждого записана первая упавшая строка и селектор, скриншот сверен с реальным экраном. Класс по доказательству: A (старый селектор или ожидание, продукт работает), B (окружение), C (дефект продукта, воспроизведён скриптом), D (тест проверяет то, чего в новом интерфейсе нет, ждёт решения). Код продукта не менялся.

### Итог
| | Было (baseline) | Стало |
|---|---|---|
| Прошло | 79 | 108 |
| Упало | 50 | 22 |
| Всего | 129 | 130 (добавлен 1 тест: «имя обязательно» для нового мастера) |

Из 50 красных: **28 починено** (класс A), **21 ждёт решения** (класс D), **1 красный из-за дефекта продукта** (класс C, тест перенесён и оставлен красным). Класс B: причина общая для всех, устранена скриптом песочницы, отдельных красных тестов не осталось.

### Причины (группировка)
1. **Старый каркас и тексты (A, 28 тестов):** `.login-switch`, `.login-error`, `.login-title`, `.hero-greeting`, `.profile-email`, `.global-sidebar`, `.app-header`, `.app-main`, `.toc-item`, `.sidebar-note-row`, `.course-row`, `.tile-click`, `.save-indicator`, `.lecture-card-meta`, `.exam-*`, `.onb-*`, `#onb-*`. Один корень (регистрация и мастер) валил 13 тестов в 5 файлах: `registration` 5, `onboarding` 8, `group-mode` 6, `referral` 1, `account-hygiene` 1.
2. **Окружение (B):** на копии БД демо-данные дрейфовали (лекции переименованы, билет №4 остался «в работе» после прерванного прогона), порт и переменные подбирались вручную. Теперь `node scripts/e2e-sandbox.mjs` копирует БД, заводит суперпользователя, поднимает PocketBase из репозитория на 8090 (`--automigrate=false`) и прогоняет `scripts/seed.ts`; при занятом порту останавливается, `--stop` гасит процесс.
3. **Изменённое поведение или функции нет (D):** семестр в сайдбаре, дерево лекций курса, плеер карточек с «Знаю», логин и правка периодов в мастере, точка входа экзамена со счётчиком, импорт с пропуском номеров, старый экран группы, микрофон в шапке, премиум в профиле.
4. **Дефект продукта (C):** на десктопе нет «Выйти».

### Таблица: тест → класс → причина → статус
| Тест | Класс | Первая упавшая строка и причина | Статус |
|---|---|---|---|
| account-hygiene:36 политика данных | A | `.privacy-title` → `.c-policy h1`, ссылка в подвале `.c-auth-legal a` | починен |
| account-hygiene:48 удаление аккаунта | A | `.login-switch`; поток «Удалить аккаунт» теперь в `/settings`, диалог из двух шагов; после входа экран «Аккаунт будет удалён» | починен (уведомление на `/login` убрано из ожиданий, см. вопрос Д5) |
| auth:13 неверные данные | A | `.login-error` → `.c-auth-error` | починен |
| auth:27 демо-доступы | A | `.hero-greeting` → `.c-dash-head h1`; email показан в «Профиле и настройках», не в шапке | починен |
| auth-nav:18 демо-логин | A | `.hero-greeting`, `.course-row`, `.tile-click`, `.toc-item` → `.c-dash-head h1`, `.c-shell-courses a`, `.c-lec-row`, `.c-toc a` | починен |
| registration:44, :54 | A | `.login-switch` → `.c-auth-switch a`, мастер 8 шагов → 4, email в `/settings` | починены |
| registration:93 короткий пароль | A | ошибка теперь под полем: «Минимум 8 символов» (раньше «не короче 8» над формой) | починен |
| registration:101 несовпадение | A | «Пароли не совпадают» под полем (`.c-field.err`) | починен |
| registration:114 повторная регистрация | A | выход через `logout()`; текст «Эта почта уже зарегистрирована» тот же | починен |
| onboarding:66 редирект и недоступность | A | `.onb-shell`, `.onb-progress` → `.c-onb`, `.c-onb-step` «Шаг 1 из 4» | починен |
| onboarding:79 полный проход | A | мастер из 4 шагов; вместо числа периодов проверяются `/s/8` и редирект с `/onboarding` | починен |
| onboarding:89 имя + адрес профиля | D | `.onb-next` не найден: шага «Адрес профиля» в мастере нет (логин меняют в настройках). Часть «имя обязательно» вынесена в новый тест | ждёт решения (Д1) |
| onboarding:107 коллизия логина | D | то же: шага с логином нет | ждёт решения (Д1) |
| onboarding:133 «вуз не найден» | A | `.onb-option--dashed`, `#onb-uni-custom` → `.c-onb-unis .manual`, поле «Название вуза»; «Шаг 3 из 4» | починен |
| onboarding:153 смена ступени | A | `.onb-pill` → `.c-onb-round`; уровень и курс на одном шаге | починен |
| onboarding:169 переименование и удаление периода | D | `.onb-option` не найден: в мастере нет ни количества, ни правки периодов (правка перенесена в `/settings/periods`) | ждёт решения (Д2) |
| onboarding:200 пересоздание набора | D | то же | ждёт решения (Д2) |
| app-shell:17 профиль и выход | C | профиль и email починены; выход: `getByText("Выйти")` не находится на `/settings` | красный, класс C (см. ниже) |
| app-shell:34 попап семестров | D | `.sidebar-semester-btn` не найден: переключателя семестра в сайдбаре нет | ждёт решения (Д3) |
| app-shell:76 `/notes` без краша сайдбара | A | `.global-sidebar`, `.sidebar-nav-item` → `.c-shell-sidebar`, `.c-shell-nav a` | починен |
| app-shell:100 смена семестра SPA | D | `.sidebar-semester-btn` | ждёт решения (Д3) |
| navigation:17 смена семестра, список курсов | D | то же | ждёт решения (Д3) |
| header-stability:26 шапка не дёргается | A | `.app-header` → `.c-shell-topbar`; переход лекция → лекция через поиск | починен |
| no-duplicates:14 один сайдбар | A | `.global-sidebar` → `.c-shell-sidebar`, `.app-main` → `.c-shell-main` | починен |
| lecture-workflow:35 бесшовная навигация | A | маркеры на `.c-shell-topbar` и `.lecture-view-content`; переход через поиск | починен |
| lecture-workflow:110 TOC | A | «Оглавление» → «Содержание» (`.c-shell-section`), `.toc-item` → `.c-toc a` | починен |
| lecture-workflow:165 дерево курсов | D | `.sidebar-semester-btn`; вложенных лекций в дереве нет | ждёт решения (Д3, Д4) |
| _coldload:68 туда-обратно | A | переход через крошку предмета и строку списка | починен |
| editor:42, :93, :119 | A | `.course-row`, `.tile-click`, `.save-indicator`, `.lecture-card-meta` → `.c-shell-courses a`, `.c-lec-row`, `.c-shell-save.saved`, `.c-lecture-meta`; год в дате только не для текущего года | починены |
| tables:15 таблица | A | `.save-indicator.saved` → `.c-shell-save.saved` | починен |
| decks:15, :69 плеер карточек | D | `.flash-card-stage` не найден: плеер на `/decks/:slug/review` с оценками «Снова/Трудно/Хорошо/Легко», «Знаю» нет | ждёт решения (Д6) |
| exams:30 точка входа | D | `.exam-entry` с мета «2 из 8 готовы» на странице предмета нет, есть вкладка «Экзамен» | ждёт решения (Д7) |
| exams:38 хаб | A | `.exam-hero-title` и др. → `.c-exam-head h1`, `.c-exam-readiness`, `.c-exam-chip` | починен |
| exams:48 импорт | D | `.exam-import-textarea` и «Разобрать текст» нет: живой предпросмотр, номера из текста убираются, билеты добавляются в конец (9, 10, 11), «будут пропущены» нет | ждёт решения (Д8) |
| exams:66 шпаргалка | A | `.exam-cheatsheet-ticket` → `.c-cheatsheet-item` | починен |
| exams:77 строка «Экзамен N/M» в сайдбаре | D | `.sidebar-course-toggle`, `.sidebar-exam-row`: в сайдбаре нет раскрывающихся предметов с экзаменом | ждёт решения (Д7) |
| exams:89 дашборд без даты | A | `.resume-block` → проверка `.c-dash`; блок «Экзамен · …» только у экзамена с датой | починен |
| exams:99 билет empty → draft → ready | A | «Отметить готовым» теперь ведёт на просмотр билета, счётчик проверяется на хабе | починен |
| group-mode:26 Соло: нет пункта, `/group` редиректит | D | пункт проверен и проходит, но `/s/1/group` в режиме Соло больше не редиректит на `/s/1` (экран «Вступи в свою группу») | ждёт решения (Д9) |
| group-mode:56, :86, :154, :224, :326 | D | `.sidebar-nav-item`, `#group-name-input`, `.group-card`, поиск похожих групп, `.group-invite-code`: экран группы переписан в волне C (поиск похожих и вступление по id убраны ради безопасности) | ждут решения (Д9) |
| referral:96 бонус за активацию | D | регистрация починена; далее `.mode-toggle-btn`, `#group-name-input`, «Сохранить заметку», `.profile-premium`: старые экраны группы, создания заметки и индикатор премиума | ждёт решения (Д10) |
| recording:31 микрофон | D | `.header-mic`: `Header` в новом интерфейсе возвращает `null`, диктовка не подключена | ждёт решения (Д11, это вопрос по микрофону из раздела 8) |

### Класс C: дефекты продукта
**C1. На десктопе нет выхода из аккаунта.**
- Воспроизведение: `node scripts/e2e-sandbox.mjs`, Vite на :5173, затем `node apps/web/scripts/repro-desktop-logout.mjs` (закоммичен).
- Шаги: вход демо-аккаунтом, ширина окна 1440, открыть `/`, `/settings`, `/profile`, искать «Выйти».
- Факт: «Выйти» нет нигде; `/profile` на ширине от 1024 перенаправляет на `/settings`; блок профиля в сайдбаре (`.c-shell-profile`) ведёт на `/settings`. На 390 «Выйти» есть в `/profile`.
- Ожидание: в макете `docs/design/screens/Screen-settings.dc.html`, раздел «Данные и безопасность», есть строка «Аккаунт · Вход выполнен: … · Выйти»; в реализации `pages/SettingsPage.tsx` этой строки нет (кнопка есть только в `pages/ProfilePage.tsx`, которая на десктопе недоступна).
- Серьёзность для первых пользователей: высокая. Нельзя выйти с компьютера, нельзя сменить аккаунт (общий компьютер, тестирование двумя аккаунтами). Обход: окно уже 1024 пикселей и `/profile`, либо очистка данных сайта.
- Тест: `app-shell.spec.ts:17` ждёт «Выйти» на `/settings` и остаётся красным до исправления продукта. В остальных тестах выход делает хелпер `logout()` через узкое окно.

### Класс D: вопросы к вам
- **Д1.** В новом мастере нет шага «Адрес профиля» (логин = поддомен). Тесты `onboarding:89` (формат логина) и `:107` (коллизия) проверяли его. Перенести их на экран настроек (логин меняют там) или считать функцию снятой?
- **Д2.** Правка периодов (переименование, удаление, пересоздание набора, количество) ушла из мастера в `/settings/periods`. Тесты `onboarding:169`, `:200`: переписать под `/settings/periods`?
- **Д3.** В новом интерфейсе нет переключателя текущего семестра (в `SemesterProvider` есть `setSemester`, но его никто не вызывает; на страницах «Лекции» есть только фильтр «Период»). Тесты `app-shell:34`, `:100`, `navigation:17`, `lecture-workflow:165` проверяли попап в сайдбаре и смену `/s/:slug` через него. Так задумано? Если да, что считать заменой?
- **Д4.** В сайдбаре нет списка лекций курса и раскрытия предмета (`lecture-workflow:165`). Так и должно быть?
- **Д5.** После запроса на удаление аккаунта `/login?deletion=1` в новом экране входа ничего не показывает; раньше было «Запрос на удаление аккаунта принят». Сообщение нужно вернуть или экран «Аккаунт будет удалён» после входа достаточен? (Сейчас в `account-hygiene:48` проверка уведомления заменена проверкой экрана ожидания.)
- **Д6.** Плеер карточек: оценки «Снова/Трудно/Хорошо/Легко» вместо «Знаю», перелистывание по клавишам другое. Переписать `decks:15`, `:69` под новый плеер (`/decks/:slug/review`)?
- **Д7.** Нет точки входа «Экзамен» с мета-счётчиком на странице предмета (есть вкладка) и строки «Экзамен N/M» в сайдбаре (`exams:30`, `:77`). Счётчик теперь только на хабе. Перенести проверку на вкладку и хаб?
- **Д8.** Импорт билетов: номера из текста убираются, билеты добавляются в конец, пропуска занятых номеров нет (`exams:48`). Это решение по макету? Если да, переписать тест под живой предпросмотр.
- **Д9.** Экран группы переписан (волна C): поиска похожих групп нет, `/s/:sem/group` в Соло открывает «Вступи в свою группу». Пять тестов `group-mode` и `group-mode:26` проверяют старое. Заменить новыми тестами на новый экран (серверные спеки групп зелёные, интерфейс покрыт только ручным скриптом `scripts/c-two-accounts.mjs`)?
- **Д10.** `referral:96`: реферальная логика покрыта хуком, но сквозной сценарий опирается на старые экраны группы, создания заметки (кнопка «Сохранить заметку») и индикатор «Премиум до» в профиле, которого в новом интерфейсе нет. Показывать премиум в профиле? Переписать тест?
- **Д11.** `recording:31` ждёт микрофон в шапке (вопрос про голосовой ввод в разделе 8).

### Рекомендация по теме 5
Начинать можно, с оговорками.
- **Что готово:** базовая страховка есть. После переноса тестов на `c-shell`/`c-auth`/`c-onb`/`c-exam` 108 тестов проходят: серверные (права, группы, квизы) и сквозные для входа, регистрации, онбординга, каркаса, редактора, таблиц, экзаменов. Это покрывает то, что удаление старого UI могло бы сломать в новом.
- **Риски:**
  1. 22 красных теста закрывают участки, где поведение изменилось или функции нет (семестр, группа, карточки, микрофон, премиум): регрессии там удаление старого UI не заметит. До решения вопросов Д3, Д6, Д9–Д11 по этим участкам защиты нет.
  2. Удаляемые экраны старого UI пока никто не вызывает, но страницы из бэклога (`NotesPage`, `ExamsPage`, `CoursesPage`, `MorePage`, `DeckEditorPage`) и `Header` (микрофон) зависят от части старых модулей: остановка и вопрос по правилу запуска остаётся в силе.
  3. Дефект C1 (нет выхода на десктопе) к удалению не относится, но тест на него красный до правки продукта.
  4. Тесты прогонялись на копии локальной БД, не на чистой: на чистой БД демо-данные берёт `scripts/seed.ts` (в песочнице он запускается сам).


### Приложение к разделу 1: красные Playwright-тесты (baseline, 26.10)

```
_coldload.spec.ts:68 — переключение туда-обратно рендерит формулу
account-hygiene.spec.ts:36 — страница политики данных доступна и без входа + ссылка из /login
account-hygiene.spec.ts:48 — запрос на удаление аккаунта: подтверждение → разлогин → уведомление
app-shell.spec.ts:17 — профиль в сайдбаре; выход → редирект на /login
app-shell.spec.ts:34 — переключатель семестров: попап открывается из сайдбара
app-shell.spec.ts:76 — роут /notes рендерится без краша сайдбара (current=null)
app-shell.spec.ts:100 — смена семестра через сайдбар = SPA (URL и контент, без reload)
auth-nav.spec.ts:18 — демо-логин: редирект на /s/demo и TOC-асид с отступом 30px
auth.spec.ts:13 — неверные данные: ошибка на странице /login
auth.spec.ts:27 — демо-доступы: редирект на /s/demo и email в шапке
decks.spec.ts:15 — деки: перелистывание колоды (flip + «Знаю»)
decks.spec.ts:69 — деки: клавиатура переворачивает и «Знаю» продвигает
editor.spec.ts:42 — формула видна сразу; клик в тело открывает редактор; автосейв сохраняет правку
editor.spec.ts:93 — шапка записи показывает человекочитаемую дату, а не сырую строку PocketBase
editor.spec.ts:119 — клик в середину абзаца ставит каретку в точку клика
exams.spec.ts:30 — 1. точка входа экзамена на странице курса
exams.spec.ts:38 — 2. центр подготовки: hero, прогресс, карта чипов
exams.spec.ts:48 — 3–4. импорт: разбор текста + пометка занятых номеров
exams.spec.ts:66 — 5. шпаргалка: только ready-билеты, формула отрендерена
exams.spec.ts:77 — 6. сайдбар: строка «Экзамен N/M» в ветке курса
exams.spec.ts:89 — 7. дашборд: блок «экзамен скоро» скрыт без даты экзамена
exams.spec.ts:99 — 8. билет: empty → draft (автосейв) → ready (кнопка)
group-mode.spec.ts:44 — по умолчанию Соло: нет пункта «Группа», /group редиректит
group-mode.spec.ts:56 — переключатель включает режим, создание группы даёт карточку и ростер
group-mode.spec.ts:86 — fuzzy-поиск: совпадение по названию предлагает присоединиться, создание уходит на второй план
group-mode.spec.ts:154 — этап B: участник видит thumbnail чужой лекции, но не её содержимое
group-mode.spec.ts:224 — этап C: точечная выдача и индивидуальный отзыв доступа к лекции
group-mode.spec.ts:326 — этап C ч.2: коллективная подготовка — виджет и переключение режима экзамена
header-stability.spec.ts:26 — шапка не «дёргается» при переключении лекций из сайдбара
lecture-workflow.spec.ts:35 — seamless navigation: Header — тот же узел, карточка анимируется
lecture-workflow.spec.ts:110 — TOC в сайдбаре: пункты = H1–H3, клик скроллит
lecture-workflow.spec.ts:165 — дерево курсов: на дашборде дерево, на лекции активный курс раскрыт
navigation.spec.ts:17 — переключение семестра в сайдбаре меняет список курсов
no-duplicates.spec.ts:14 — ровно один .global-sidebar и ни одного .workspace-sidebar
onboarding.spec.ts:66 — после регистрации — редирект на /onboarding, приложение недоступно
onboarding.spec.ts:79 — полный проход мастера → дашборд с периодами
onboarding.spec.ts:89 — имя обязательно, адрес профиля проверяет формат
onboarding.spec.ts:107 — коллизия логина
onboarding.spec.ts:133 — эскейп «вуз не найден» → ручной ввод
onboarding.spec.ts:153 — смена ступени пересчитывает диапазон курса
onboarding.spec.ts:169 — периоды: переименование и удаление
onboarding.spec.ts:200 — периоды: пересоздание набора не плодит дублей
recording.spec.ts:31 — клик по микрофону включает индикатор записи (диктофон), повторный — выключает
referral.spec.ts:96 — бонус за активацию: начисляется обоим после первой лекции, не повторяется
registration.spec.ts:44 — новый email: автологин и попадание на дашборд
registration.spec.ts:54 — стухшая чужая сессия не подменяет профиль после регистрации
registration.spec.ts:93 — короткий пароль: ошибка
registration.spec.ts:101 — несовпадение подтверждения: ошибка
registration.spec.ts:114 — повторная регистрация того же email: ошибка
tables.spec.ts:15 — таблица вставляется из slash-меню, есть тулбар, правка сохраняется
```

Ревью запуска 1 (отдельный субагент, правок не писал, `git diff e45b20b..HEAD`): блокеров и находок «надо поправить» нет; изменений поведения, потерянных экспортов и пропавших состояний интерфейса не найдено. `vitest run` проходит в четырёх часовых поясах (`UTC`, `Pacific/Kiritimati`, `America/Los_Angeles`, `Europe/Moscow`). Два замечания: (1) `pages/SchedulePage.tsx:58` держит свою копию `MONTHS_GEN` (старая страница, уйдёт в теме 5); (2) остались inline-выражения `String(pb.authStore.record?.id ?? "")` в `CardFormDialog.tsx:44`, `LectureAccessDialog.tsx:43`, `useLectureActions.tsx:72`, `UnderstandingScope.tsx:34`, `QuizPage.tsx:66` (вне services, войдут в U3). Побочно: ревьюер создал `/tmp/cls_removed.txt` вне репозитория.
