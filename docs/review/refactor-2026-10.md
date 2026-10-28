# Рефакторинг cohorta: анализ и план работ (октябрь 2026)

Дата: 2026-10-26, пересмотрено 28.10 (запуск 5, шаг 1) после удаления старого интерфейса. Анализ вёлся на `design/c-group` (e45b20b); работы слиты в `design/c-group` (merge 51339c2) и запушены, точка отката: тег `pre-refactor-2026-10` на e45b20b; дальнейшие запуски в ветке `refactor/cleanup-2026-10b`. Вне объёма: `pb_migrations`, API-правила, схема, деплой-конфиги, безопасность (отложены владелицей).

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
Состояние на 28.10, после запусков 1–4 (темы 0, 1, 2 и 5 выполнены; старые экраны, каркас, `components/ui/`, `App.css` и флаг удалены, 75 файлов). Оставшиеся находки ниже; разделы про удалённые файлы убраны.
- Осталось находок: около 40. Низкий риск ~25, средний ~12, высокий ~3.
- Чисто: именование «cohorts → groups» (grep по `cohort`/`когорт` пуст); `any`, `@ts-ignore`, `TODO/FIXME`, закомментированного кода в `lib/services/hooks` нет; готовность лекции считает один модуль (`computeLectureReadiness.ts`).
- Главное теперь: даты (13 мест `new Date(x.replace(" ", "T"))` вместо `parsePbDate`, дубли форматирования), лишние запросы (все лекции с `content`, двойная загрузка лекции, N+1 в квизах, `useReviewSuggestions` перезагружается после каждого действия), `pb_hooks` (~20 копий «найти или 404», 9 копий проверки участника подгруппы), типы (`lib/types.ts` 851 строка, касты `as unknown as`), разрезы больших файлов, пороги готовности (75 записано дважды).

### Топ-5 по пользе (оставшееся)
1. Слой данных (тема 4): `useRecentLectures` и `fetchAllLectures` с `content`, `useReviewSuggestions`, дубль загрузки «лекции + вопросы + ответы», двойная загрузка лекции, N+1.
2. Общие функции и структура `pb_hooks` (тема 6): `getOr404`, `isSubgroupMember`, `isLockedByOther`, `lib_db.js`, разрез `exam_groups.pb.js`; обязательно вместе с правкой регулярок `c-mutations.mjs`.
3. Даты (тема 3): свести 13 копий к `parsePbDate`, один набор месяцев и дней недели, одна «дней до экзамена».
4. Типы (тема 7): `lib/types.ts` на `types`/`fields`/`accessors`, убрать касты.
5. Тесты-страховка (тема 0): тесты 8 (`draftSync`) и 10 (`access.ts`) ещё не написаны.

## 3. Порядок работ

| № | Тема | Зачем | Оценка / риск | Чем проверять | Запуск |
|---|---|---|---|---|---|
| 0 | Тесты-страховка (раздел 7, 1–7) | ловить регрессии | S / низкий | `vitest run` | 1, готово |
| 1 | Мёртвое без связей: `LectureSidebar`, `SemesterSwitcher`, `TagBadges`, неиспользуемые экспорты, `shareGroupId`, лишние `export`, неиспользуемые CSS-классы (C1) | меньше шума | S / низкий | grep, tsc, oxlint, build | 1 |
| — | Разбор Playwright: красные спеки, перенос старых селекторов на новый каркас отдельным коммитом; спека на то, чего нет в новом UI: спросить, не удалять | прикрыть тестами до чистки | M–L / низкий | Playwright | 2 |
| 5 | Старый UI и флаг: сначала `isNewUI = () => true`, затем D1–D6 | главная чистка | L / высокий | всё | 4, готово |
| 2 | Общие константы и хелперы: `currentUserId`, `MS_PER_DAY`, `READINESS_CONFIG`, `PARITY_LABELS`/`WeekParity`, месяцы, дни недели | убрать копипасту | S–M / низкий | vitest, tsc | 1, готово |
| 3 | Даты: свести дубли (не баг, см. 5.2), `formatDayMonth` | порядок | M / средний | тесты под двумя `TZ` | 5 |
| 4 | Слой данных | скорость | M / средний | vitest, Playwright | 5 |
| 7 | Типы | чище | M / средний | tsc | 5 |
| 6 | `pb_hooks` структура | дубли, имена | M / средний | Playwright `group-*`, `c-mutations.mjs` | позже |
| 8 | Разрезы (без `LectureView`, `Editor`, `GroupTicketPage`) | читаемость | S–M | профильные спеки | позже |
| 9 | `generate.ts` + `quizLimits.ts` | один источник констант | S / M | `quizGenerate.test.ts` | позже |
| 10 | Гигиена: `*.log`, одноразовые скрипты, inline-стили | порядок | S–M / низкий | tsc | позже |

Порядок выполнения: 0 → 1 → разбор Playwright → 5 → 3 → 4 → 7 → 6 → 8 → 9 → 10 (тема 2 выполнена в запуске 1 по указанию владелицы).

## 4. Находки по темам
Формат: файл:строка; что не так; чем заменить; размер; риск; проверка. «В» — проверено лично.

### 4.1 Старый UI и мёртвый код
**Выполнено в запусках 1 и 4 (темы 1 и 5):** удалены D1 (старые экраны, 75 файлов вместе с осиротевшими), D2 (`LectureSidebar`, `SemesterSwitcher`, `TagBadges`), D3 (старый каркас), D5 (флаг и его ветки, 30 вызовов `isNewUI()`), D6 (`*New` → без суффикса), D8 (`components/ui/`, `DesignPage`, `subjectPalette.ts`); `Toast` перенесён в `ui/`; `framer-motion` убран из зависимостей; CSS: `App.css` слит в `styles/components.css`, мёртвые правила удалены; A1 закрыт (Playwright перенесён на новый каркас, см. «Разбор Playwright», «Запуск 3»). Подробности и список коммитов: «Запуск 4».

**Остаётся из 4.1:**
- **D4. `Header.tsx` явно возвращает `null`** (комментарий «см. бэклог: голосовой ввод»), тело и микрофон сохранены; компонент вставлен в живые места (`Dashboard`, `CoursesPage`, `ExamsPage`, `NotesPage`, `DeckEditorPage`, `LectureLayout`, `SemesterGate`, `App.tsx`), хуки `useUiShell`/`useSpeech` выполняются впустую. **Ограничения (б), (д):** убирать вставки только после ответа на вопрос из раздела 8. Недостижимый код после `return null` даёт предупреждение Firefox «unreachable code after return statement»; шапка-комментарий файла описывает прежнее поведение.
- **D7. Живые страницы старой вёрстки: бэклог (решение б).** `CoursesPage`, `ExamsPage`, `NotesPage`, `DeckEditorPage` 455, `MorePage` и их зависимости: `AddTile`, `ConfirmDialog`, `CourseCard`, `CourseFormTile`, `CourseTile`, `ExamCourseCard`, `InlineEditor`, `KebabMenu`, `LectureTile`, `useConfirmDialog`, `useCourseForm`, `lib/courseGradient.ts`, `lib/tileActions.tsx`. Не удалять и не переписывать. `lib/colors.ts` и `courseService.randomCourseColor` живы и без бэклога (`SubjectFormDialog`).
- **Неиспользуемые экспорты** (проверено заново 28.10, 0 ссылок вне определения; удалялись в теме 1 только те, что были без вызывающих до запуска 4): `examService.ts`: `setExamMode`, `fetchParticipants`, `addParticipant`, `removeParticipant`, `deleteTicket`; `lectureService.ts`: `showLectureToGroup`, `hideLectureFromGroup`, `createUnassignedLecture`; `deletionService.ts`: `requestDeletion`; `types.ts`: `lectureOwnerId`, `lectureGroupId`, `groupOwnerId`, `memberUserId`, типы `LectureShare`, `PremiumGrant`; `deckService.deleteDeck` (вызывался удалённым `CardLibraryPage`, в макетах «Удалить колоду» нет, см. раздел 9). **Не удалять по решению (г):** `joinGroupByCode` (`groupApi.ts`), `fetchCommonTickets` (`groupExamApi.ts`), `resetInviteCode` и `transferGroup` (`groupService.ts`), маршруты `assign` и `DELETE share-subgroup`. Неиспользуемые ключи `FIELDS`: часть задел, не трогать без проверки.
- **Устаревшие комментарии с именами удалённого** (`GlobalSidebar`, `TableOfContents`, `App.css`, `*New.tsx`): `Header.tsx:1-12`, `AppLayout.tsx:34`, `LectureLayout.tsx:14`, `lectureFrame.ts:51`, `uiShellContext.ts:8`, `AppShell.tsx:72,156`, `useTocScan.ts`, `useProductSearch.ts`, `useLectures.ts`, `tokens.css`, `src/DESIGN.md`, `components.css`, `.clinerules` (почти целиком про удалённый код). Правка комментариев не менялась.
- **Легаси-алиасы в `tokens.css:191-215`** («удалить вместе с App.css»): не читаются нигде `--brand-1-hover`, `--brand-wash`, `--success-ink`, `--success-soft`, `--warning`, `--warning-ink`, `--warning-soft`; остальные ещё используются.
- **CSS C3:** `LectureView.tsx` ссылается на несуществующий токен `--color-accent-soft` с запасным hex (раздел 9); `TagEditor.tsx` `#5843f6`: жёсткие цвета в токены, правка вида, проверять скриншотом.
- **Мусор вне `src`:** `apps/web/*.log`, ~45 одноразовых `scripts/b*-c*.mjs` (4 611 строк), в корне `pb-run.log`, `pw-*.log`, `test-results/`. (S; низкий; тема 10.)

### 4.2 Дубли
- **U1. Даты и месяцы (остаток после темы 2).** Месяцы и дни уже сведены в `lib/format.ts` (`MONTHS_GENITIVE`, `MONTHS_SHORT`); остались: `formatDate` дважды (`DraftsPage.tsx:30` = `lectures/LectureGroupList.tsx:23`), `schedule/AttachLectureModal.tsx:6 formatDateRu`, `lectureMeta.ts:5`, `format.ts:106 formatDate`, `studyPeriods.ts:150 MONTHS_MOCK`. Дни недели: `Dashboard.tsx:44 WEEKDAYS` (7), `SchedulePage.tsx:60 DAY_NAMES` (6), `SubjectPairsPage.tsx:40 DAY_FULL` (полные): разной формы, не дубли. Один `formatDayMonth` в `lib/format.ts`. (M; низкий; перед заменой зафиксировать текущие строки тестами.)
- **U1b. Разбор даты PocketBase: дубль, не баг (пересмотрено).** `parsePbDate` (`format.ts:55-62`, 13 использований) и 13 мест `new Date(x.replace(" ", "T"))`: `types.ts:675 isPremiumActive`, `groupExamText.ts:7,30`, `notifyCtx.ts:44`, `NotifyProvider.tsx:31`, `GroupLecturePage.tsx:179`, `GroupTicketPage.tsx:35`, `LectureView.tsx:142`, `TrashPage.tsx:17`, `deletionService.ts:87`, `groupApi.ts:322,329`, `trashService.ts:55`. Реальный ответ PocketBase содержит `Z`: `"created":"2026-10-16 06:06:05.176Z"` (ответ прода на анонимный запрос к `semesters`). Значит `replace(" ","T")` даёт корректный ISO в UTC, и расхождения нет. Багом это можно называть только после воспроизведения тестом под двумя `TZ` на значениях без `Z`. До этого: дубль, сводится к `parsePbDate` в теме 3 без изменения поведения. Оставшийся вопрос: `examService.ts:67` берёт UTC-день `toISOString().slice(0,10)`, остальные места локальный `todayStr()` — отличие поведения вокруг полуночи, фиксировать тестом, не «чинить» (раздел 9).
- **U2. Расписание.** Якорь чётности `settings?.odd_week_anchor ? fromDateStr(...) : mondayOf(now)` в `Dashboard.tsx:110`, `SubjectPairsPage.tsx:91`, `SchedulePage.tsx:105`; перебор 14 дней «ближайшая дата»: `SubjectPairsPage.tsx`, `SchedulePage.tsx`; фильтр «сегодня» `Dashboard.tsx:113-116`. Метки `PARITY` в `slotConflict.ts`, `SubjectPairsPage`, `accountExport.ts`, `SchedulePage` (разные формулировки, не дубли, см. раздел 9); `parityOverlaps` и `slotMatchesParity`; `week_parity: string` вместо `WeekParity`. В `lib/weekParity.ts`: `anchorOf`, `nextOccurrence`, `slotsOnDate`. (M; средний; `weekParity.test.ts`, `slotConflict.test.ts`.)
- **U3. Права в UI.** «Я владелец лекции» вручную: `UnderstandingScope.tsx:34`, `QuizPage.tsx:66`, `CardFormDialog.tsx:44`, `useLectureActions.tsx:71`, `LectureAccessDialog.tsx:43` (через `pb.authStore.record?.id`); при существующем `lectureOwnerId` (`types.ts`, сейчас без вызывающих). Группа: `groupApi.ts:97`, `GroupAccessPage`, `GroupMemberPages`, `GroupSettingsPage`, `GroupHomePage:53`. `lib/access.ts` с чистыми функциями + тесты. UI-проверки только подсказка, право решает сервер. (M; средний.)
- **U4. Ошибки.** `errorMessage` (`format.ts:81-90`) отдаёт сырой английский текст PocketBase (это поведение: только пометить, раздел 9); ручные `e instanceof Error` в `JoinGroupPage:42,81`, `Onboarding.tsx:188`, `ui/EditableRow.tsx:176`; ручной разбор `{status, response}` в `deletionService:73`, `groupExamApi:123`, `onboardingService:36`, `draftSync`, `draftQueue`, `authErrors` → `lib/pbError.ts` (M; низкий–средний). `LectureView.tsx:437` определяет «не найдено» регуляркой по тексту ошибки (S; средний). `authErrors.ts:42-49`: две ветки возвращают одну строку. Тихие `.catch(() => {})` в живом коде; `Dashboard.tsx:104` глотает ошибку без индикации (раздел 9).
- **U5. Готовность лекции:** расчёт один, потребители не дублируют. Но: «последний квиз и скрытые вопросы» посчитаны дважды (`computeLectureReadiness.ts:103-111`, `quizPanelState.ts:61-73`), `normalizeTopic` и `topicKey` (`quizSummary.ts:37`), порог слабой темы 0.6 и «до 3» в двух файлах; `READINESS_THRESHOLDS.done = 75` (`:46`) и `REVIEW_THRESHOLD = 75` (`getReviewSuggestions.ts:47`) записаны дважды; магические 0.5/0.8, 21, 0.7+0.3, 60, 0.6/0.4. Свести в `READINESS_CONFIG` и `latestQuizQuestions()` (S; средний; тесты формулы).
- **U6. День в мс:** Константа `MS_PER_DAY` введена в теме 2 (`localDate.ts:7`). Округление разное (`floor` в `computeLectureReadiness:70`, `UnderstandingScope:291`, `trashService:57`; `round` в `getReviewSuggestions:57`, `groupExamText:11`, `lectureMeta:14`, `localDate:58`, `types:795`): не унифицировать. Две «дней до экзамена»: `types.ts:788 examDaysLeft` и `groupExamText.ts:5 daysUntil` (разная семантика прошедших дат: тест перед слиянием).
- **U7. `currentUserId()`:** выполнено в теме 2 (`lib/pocketbase.ts:27`); остались прямые `pb.authStore.record?.id` в `CardFormDialog:44`, `LectureAccessDialog:43`, `useLectureActions:71`, `UnderstandingScope:34`, `QuizPage:66` (см. U3).
- **U8. Фильтры PocketBase:** 38 `pb.filter({:x})` против ~18 склеек (`quizService.ts:79,260,291,315,318,354`, `lectureService:43`, `courseService:69,143`, `examService:99`, `scheduleService:235`, `searchService:76,87,107`, `useLastVisited:28`); `genericService.ts:44` (`slug` из URL). Замена на `pb.filter` не должна менять результат запросов (S–M; низкий; `navigation`, `lecture-workflow`).
- **U9. Прочее:** 132 inline `style={{`; 16 литералов `setTimeout(…, NNN)`, `RETRY_MS`, `POLL_MS`, `3500`, `3000`, `150`, `2000`/`1e9`. Тексты интерфейса внутри логики: i18n не нужен (интерфейс только русский).

### 4.3 Размер и ответственность (файлы >300 строк, `wc -l`, 28.10)
Резать (низкий и средний риск, тема 8): `SchedulePage` 848 (`WeekGrid`+`SlotCard`/`MobileDayPairs`/`SchedulePanel`; M; средний), `AppShell` 565 (`shell/{Sidebar,SidebarLectureToc,SidebarCourses,MobileTabBar,Topbar,hooks}`; M; средний), `TasksPage` 480 (S; низкий), `Onboarding` 467 (19 `useState`; `useOnboardingForm` + шаги; M; средний), `SettingsPeriodsPage` 414 (`toRows`, `rowProblem` в `studyPeriods.ts`; S), `SlashMenu` 411 (S), `QuizPage` 401 (`QuizQuestionView`; S). **В этом заходе не резать (решение владельца):** `LectureView` 525, `Editor` 474, `GroupTicketPage` 434. Остальное рядом с порогом: `Dashboard` 369, `SettingsPage` 364, `SubjectPairsPage` 355, `GroupExamPage` 354, `LecturesAllPage` 351, `GroupSettingsPage` 345, `ExamHubPage` 345, `useLectureActions` 317; сервисы `groupApi` 376, `quizService` 365, `examService` 363, `lectureService` 326. `DeckEditorPage` 455 и `SpeechProvider` 441 — в бэклоге/не трогать. `lib/types.ts` 851: интерфейсы + `FIELDS` + геттеры + логика → `types`/`fields`/`accessors` с реэкспортом (M; низкий). CSS: `components.css` 6076 (включая бывший `App.css`), `group.css` 344. `App.tsx` сократился до ~230 строк; старые крупные файлы удалены.

### 4.4 Данные и состояние
- **P1. Прямой `pb.collection` в UI:** `GroupAccessPage:54,69,82`, `GroupLecturePage:45,138,142`, `LectureAccessDialog:58,60,138`, `ResetPages:88,151,198`; `pb.files.getURL` в `group/common.tsx:18` → `avatarUrl(user)`. (M; средний.)
- **P2. `GroupAccessPage:52-87`:** зависимости эффектов от `groups.length`, `data.shares.length/requests.length` (`eslint-disable`), нет флага `alive`, фильтр склейкой `id="${id}"` (S; средний).
- **P3. `eslint-disable react-hooks/exhaustive-deps`:** `TicketPage` (прокомментирован), `GroupTicketPage`, `SettingsPeriodsPage`, `LectureView`, `JoinGroupPage`, `LecturePickerDialog`, `SlotForm`, `DateField`: разбирать по одному (номера строк уточнять поиском `eslint-disable`; `StepCityUniversity` и `StepPeriods` удалены).
- **P4. Дубль состояния:** `TicketPage` (`useRef` + `useState` + эффект синхронизации; высокий риск); `LecturesAllPage` вручную `fetchSlots` при наличии `useSchedule`; `Dashboard.tsx:98-104` вручную курсы при наличии `useCourses`.
- **P5. Гонка в `useAsyncData` (`hooks/useAsyncData.ts:47-62`):** `setData` без проверки актуальности, `pb.autoCancellation(false)` (`lib/pocketbase.ts:22`); счётчик запросов, как в `useLectureReadiness.ts:244-262` (S; низкий–средний; это исправление гонки: если меняет видимое поведение, остановиться и спросить).
- **P6. `useReviewSuggestions.ts:50-57`:** `fetcher` зависит от `existingDedupeKeys`; после каждого выполнения/скрытия задачи повторно 3 запроса; фильтр по dedupe сделать в `useMemo` (S; низкий).
- **P7. Дубль загрузки «лекции + вопросы + ответы»:** `useLecturesOverview.ts:30-45` и `useReviewSuggestions.ts:17-47` → общий `loadLectureReadinessRows()`; N+1 `quizService.ts:256-285` (`getOne("quizzes")` на каждый квиз; пакетная версия `:307` делает один `getFullList`); без `fields` у `fetchReadinessQuestionsByLecture:314`, `fetchReadinessAnswersByLecture:353` (S; низкий).
- **P8. Лишние данные:** `useLectures(courseSlug)` ради одного курса (`AppShell.tsx:163`, `LectureLayout.tsx:32`, `TicketPage.tsx:78`) → `useCourseBySlug`; лекция грузится дважды (`AppShell` и `LectureView`); `useRecentLectures` (`lectureService`) читает всю библиотеку с `content` ради `slice` (вызовы `AppShell.tsx:77` `(100)`, `Dashboard.tsx:94` `(1)`, `useActivityHeatmap.ts:77` `(1e9)`, `NotesPage:40` `(100)`); `fetchAllLectures` с `content` (`CardFormDialog:45`, `useLecturesOverview:36`); `courseService:131 fetchLatestLectureTitles` последовательный цикл; `useSchedule.ts` без `useAsyncData`; `GroupProvider` и `useGroupData` оба слушают `window.focus`, `fetchGroupSummaries` (`groupApi`) в цикле по группам. (M; средний; сверить, кто использует `lectureBody`/`lectureExcerpt`.)

### 4.5 Типы
- `any` в lib/services/hooks нет. `as unknown as`: `NotifyProvider.tsx:91,104`, `groupApi.ts:157`, `groupService.ts` (фейковый `GroupMember` в `fetchRoster`), `SpeechProvider:60` (не трогать, (д)), `renderLatex.ts:50`, `SketchModal.tsx:34,52 (useRef<any>)`, `main.tsx` (`window.EXCALIDRAW_ASSET_PATH` → `declare global`). `TasksPage` (касты прячут `undefined`).
- `pocketbase/pb_data/types.d.ts` (24 372 строки) **не** описывает схему (декларации JSVM для хуков и миграций): генерировать типы из него нельзя. Вариант без новых библиотек: скрипт `apps/web/scripts/gen-types.mjs`, читающий `GET /api/collections` локального PocketBase. До этого источник правды `lib/types.ts`.
- Необязательные поля, которые на деле обязательны (только пометить, сверять с `required` в миграциях): `Lecture.slug?/Course.slug?/Deck.slug?` (для обязательности нужна миграция: вне объёма), `ScheduleSlot.week_parity?/kind?`, `QuizAnswer.correct?`, `Quiz.size?`, `QuizQuestion.prompt?/topic?`; `Lecture.title`/`Course.name` обязательны, но геттеры и 19 `String(x.title ?? …)` страхуются. Затрагивает 268 использований `FIELDS.*`.
- Дубли проекций: `PanelAnswer`, `QuestionRef/AnswerRef` → `Pick<…>`; `SuggestionLecture` и `LectureOverviewRow`; `GroupSummary/RosterPerson/Group/GroupMember/GroupData` (`groupService.ts` сокращён в теме 5 до пяти функций, остальное в `groupApi`).

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
3. **D4, D8, палитры:** решены в теме 5: `components/ui/`, `DesignPage`, `subjectPalette.ts` удалены (их держала только dev-страница), `courseGradient.ts` и `Header` остались из-за бэклога (б) и микрофона (д).

## 6. Что трогать нельзя или рискованно
- Всё, что требует миграции, правил, схемы: пустые `slug`, поля `required`, `courses.color`.
- `lib/courseGradient.ts`, `colors.ts`: живые через страницы из бэклога и `courseService.createCourse`.
- CSS-классы Tiptap-таблиц и `cover-*` без проверки.
- `LectureView`, `Editor`, `GroupTicketPage` (по решению), `TicketPage` (дубль состояния).
- `pb_hooks`: переносы без правки регулярок `c-mutations.mjs`; `exam_pok.pb.js` fail-open; `trash` 403/404; различия `userLabel`; `floor/round` в днях.
- `trash/purge`, `trash/empty`, cron `trash_purge`/`account_deletion`: без тестов, необратимо.
- `SpeechProvider`, `useSpeech` (решение д).
- Заготовки волны C и `VerifyEmailPage`.

## 7. Какие тесты добавить первыми (vitest, `environment: node`, без новых зависимостей)
Статус на 28.10: пункты 1–7 и 9 выполнены в запуске 1 (vitest 242 → 301); не сделаны 8 (`draftSync`) и 10 (`access.ts`, ждёт темы U3).
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
- **Голосовой ввод (д):** `Header` (микрофон, `useSpeech`) в новом UI явно возвращает `null`, но вставлен в страницы, часть из них из бэклога (б). Хуки `useUiShell`/`useSpeech` внутри выполняются впустую. Пока `SpeechProvider` и `useSpeech` не решены, `Header` не удаляется. Нужно решение: возвращать ли диктовку в новый каркас, и если нет, то когда убирать.
- Тема 8: страницы из бэклога (б) используют `courseGradient`, `colors` и (частично) `Header`: при столкновении остановлюсь и спрошу.

## 9. Нашёл по пути
(попутные находки; не исправлялись)
- `errorMessage` (`format.ts`) отдаёт пользователю сырой английский текст PocketBase.
- `Dashboard.tsx:104` глотает ошибку загрузки лекций без индикации.
- `examService.ts:67` берёт UTC-день (`toISOString().slice(0,10)`), остальные места локальный `todayStr()`: расхождение около полуночи.
- `groups_manage.pb.js:149`: `findRecordById("groups", …)` без `try`, неизвестный id даёт стандартную ошибку PocketBase, а не 404 «Группа не найдена.».
- `pbQuizzesToday` (`generate.ts`) при `!res.ok` возвращает 0 и молча отключает дневной лимит.
- `authErrors.ts:42-49`: две ветки `registerErrorMessage` возвращают одну и ту же строку (мёртвая проверка `raw`).
- `LectureView.tsx` (поиск `color-accent-soft`) ссылается на несуществующий токен `--color-accent-soft` (токен называется `--accent-soft`), поэтому всегда срабатывает запасной hex.
- Комментарий к `parsePbDate` (`format.ts`) говорит, что Firefox не разбирает «2026-01-15 10:00:00.123Z». Проверено 26.10 в установленном Firefox (Playwright): `new Date("2026-10-26 00:00:00.000Z")` и вариант с `T` дают одно и то же значение. Комментарий устарел; места, где даты PocketBase разбираются без `parsePbDate` (например `examDaysLeft` в `types.ts`), в Firefox работают.
- Метки чётности недели (`slotConflict.ts`, `SubjectPairsPage`, `accountExport`, `SchedulePageNew`, формы пары) оказались не дублями, а разными формулировками («на нечётных неделях», «нечётные недели», «нечётная», «Нечётные»): не объединялись, чтобы не менять тексты интерфейса. Массивы дней недели тоже разной длины и формы (6 и 7 дней, с полными названиями); общим остался бы только `DashboardNew` + старый `StudyWeekStrip`.
- `getReviewSuggestions.test.ts` уже покрывал «не больше 3 подсказок» и отсутствие дублей: отдельный тест не добавлялся.
- Правки `pb_hooks` подхватываются PocketBase только после ручного перезапуска (`File … changed, please restart the app manually`); на песочнице перезапускал по PID.
- Блок «последний квиз и скрытые вопросы» остаётся продублированным в `computeLectureReadiness.ts` и `quizPanelState.ts` (формула критична, вынесение отложено в тему 4/7).
- `oxlint` (11 предупреждений) включает `scripts/` и `tests/`; `tests/group-exams.spec.ts:8` импортирует неиспользуемый `grantShare`.
- **Д5 (запуск 3).** После запроса на удаление аккаунта `/login?deletion=1` ничего не показывает (раньше было «Запрос на удаление аккаунта принят»). Тест проверяет только экран «Аккаунт будет удалён» после входа. Нужно ли сообщение на `/login`, решаете вы.
- **Д10 (запуск 3).** «Премиум до» в профиле в новом интерфейсе нет; тест реферала этого не проверяет. Показывать ли премиум в профиле, отдельное решение.
- Ссылка-приглашение в новом интерфейсе — `/join/КОД` с подтверждением (Screen-group-join-confirm), автовступления нет; `/login?invite=` работает только в старом `Login.tsx` (уйдёт в теме 5).
- В макете Screen-cards-review под кнопками оценок есть интервалы («сейчас, 1 день, 3 дня, 7 дней»); в продукте их нет по решению владелицы (B5, комментарий в `CardReviewPageNew.tsx`). Не дефект, только отличие от макета.

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

### Запуск 3 (27.10): хвост разбора Playwright и дефект C1
Коммиты: 93c6760 (fix(C1)), 3f86222 (onboarding), efdf648 (app-shell, navigation), a1e94c2 (lecture-workflow), 627ac94 (decks), 2e0060d (exams), f166554 (group-mode), ea3360f (referral, recording). Код продукта менялся только в C1 (`hooks/useSignOut.ts`, `ProfilePage.tsx`, `SettingsPage.tsx`).

**Прогон:** было 108 прошло / 22 красных; **стало 124 прошло / 0 красных / 7 fixme (skipped)**, всего 131 (на один тест больше: «по умолчанию Соло» разделён на рабочий и fixme). Полный прогон на свежей песочнице 4,6 мин. После каждого коммита: `tsc` чисто, oxlint 11 предупреждений, vitest 301/301, `npm run build` проходит.

**C1 исправлен.** В «Данные и безопасность» добавлена строка «Аккаунт · Вход выполнен: email · Выйти» по Screen-settings. Обработчик общий с «Профилем» на телефоне: хук `useSignOut` (раньше те же две строки жили в `ProfilePage`). Скриншоты 1440: `docs/review/shots/c1-settings-before.png`, `c1-settings-after.png`. `app-shell:17` зелёный; хелпер `logout()` теперь выходит через `/settings`, без узкого окна.

| Тест | Решение | Что сделано / сверка с макетом |
|---|---|---|
| onboarding:89 формат логина | переписан (Д1) | `/settings`, строка «Имя пользователя» есть и в макете; часть «имя обязательно» уже закрыта тестом :206 |
| onboarding:107 коллизия логина | переписан (Д1) | второй аккаунт получает «Это имя уже занято» в `/settings`, другой логин сохраняется |
| onboarding:169 переименование/удаление периода | переписан (Д2) | `/settings/periods`: переименовать, удалить последний, сохранить, после перезагрузки на месте |
| onboarding:200 пересоздание без дублей | переписан (Д2) | счётчик «−» до 2, сохранить, `/s/2` есть, `/s/3` нет |
| app-shell:34 попап семестров | переписан (Д3) | фильтр «Период» в «Все лекции» (Screen-lectures-period): список, «текущий», «Все периоды», закрытие кликом и Escape |
| app-shell:102 смена семестра = SPA | переписан (Д3) | смена периода без reload (метка на window) |
| navigation:17 | переписан (Д3) | лекции «Математического анализа» есть в «Демо-семестр», нет в «Семестр 1» |
| lecture-workflow:165 дерево курсов | переписан (Д4) | Foundation-shell и Screen-editor-toc: на дашборде плоские «Предметы», на лекции «Содержание» вместо них со ссылкой на предмет; вложенных лекций в макете нет |
| account-hygiene (Д5) | без правок | экран «Аккаунт будет удалён» проверяется; сообщения на `/login` нет, записано в «Нашёл по пути» |
| decks:15, :69 | переписаны (Д6) | `/decks/retina-vision/review`: «Показать ответ», «Снова/Трудно/Хорошо/Легко», клавиши пробел и 1–4 |
| exams:30 | переписан (Д7) | вкладка «Экзамен» на странице предмета ведёт на хаб со счётчиком «2 из 8» |
| exams:48 импорт | переписан (Д8) | макет Screen-ticket-import: номера из текста убираются, билеты идут в конец (9–11), «Добавить 3 билета»; пропуска занятых нет, класса C нет |
| exams:77 строка «Экзамен N/M» | переписан (Д7) | в сайдбаре её нет по макету; счётчик проверяется на хабе (шапка и список билетов) |
| group-mode:26 Соло | разделён | рабочая часть (нет пункта «Группа», переключатель на «Соло») зелёная; редирект `/group` в Соло: **вопрос** (fixme) |
| group-mode:56, :86, :154, :224, :326 | fixme (Д9) | «[Д9] экран группы переписан в волне C, нужны новые UI-тесты», тела сохранены |
| referral:96 | переписан (Д10) | группа, лекции и вступление по коду через API; регистрация приглашённого через интерфейс; бонус обоим и отсутствие повтора проверяются; «Премиум до» убран из проверок |
| recording:31 | fixme (Д11) | «[Д11] диктовка в новом каркасе не подключена, решение владельца»; Header, SpeechProvider, useSpeech не тронуты |

**fixme: 7.** Д9: 5, Д11: 1, плюс 1 вопрос по редиректу (выходит за допустимые Д9/Д11, см. ниже).

**Новые находки класса C:** нет. Д3, Д4, Д6, Д7, Д8 совпали с макетом; Д1 тоже (логин правится в `/settings`). Отличие от макета без дефекта: интервалы под оценками карточек (решение B5).

**Вопросы к вам:**
1. `/s/1/group` в режиме Соло: сейчас открывает экран группы без редиректа на `/s/1`. В макетах и userflow про это ничего нет. Так задумано? Если да, тест удалить или переписать на «открывается экран группы».
2. Д9: когда писать новые UI-тесты на экран группы (5 fixme)?
3. Д11: судьба микрофона (1 fixme).
4. Д5 и Д10 (сообщение на `/login` после запроса удаления, «Премиум до» в профиле): добавлять ли, см. «Нашёл по пути».

Тема 5 не начиналась. Рекомендация: 22 красных закрыты, участки семестра, карточек, экзаменов и реферала снова под защитой; без защиты остаются экран группы (Д9) и микрофон (Д11).

### Запуск 4 (28.10): тема 5, удаление старого UI и флага VITE_NEW_UI
Перед запуском (решения к запуску 3): `group-mode` «Соло: прямой заход на /group» переписан под экран «Вступи в свою группу» (Screen-group-join, fixme снят); микрофон (Д11) и Д9 остаются fixme; Д5 и «Премиум до» не добавлялись; `scripts/probe-dom.mjs` удалён. Тестов fixme теперь 6 (Д9: 5, Д11: 1).

**Базовая линия (до правок):** tsc чисто, oxlint 11, vitest 301/301, build проходит, Playwright 125 прошли / 6 fixme / 0 красных. Скриншоты «до»: 20 маршрутов × 1440 и 390 (42 файла, вне репозитория, `%TEMP%\cohorta-shotsase3`, снимались со старого кода в отдельном worktree на коммите b8b604f).

**Коммиты (16, диапазон b8b604f..HEAD):**
| Коммит | Шаг |
|---|---|
| 066d31b | 5.1 `isNewUI()` всегда true (точка отката) |
| dcf95af | 5.2 `Toast` перенесён в `ui/` |
| f9096ad | 5.3a дашборд: `Dashboard`, `pages/dashboard/*` (кроме `StartCard`), `useActivityTimeline`, `useCourseProgress` |
| e431e92 | 5.3b лекции: `LectureViewLegacy`, `LecturesPage`, `LectureEditor`, `ReadinessBadge`, `ShareAccessButton`, `ShareDialog`, `ShareToGroupButton` |
| 4558b0f | 5.3c `Login`, `PrivacyPage` |
| e63ee73 | 5.3d `GroupPage`, `useGroups`; из `groupService.ts` убраны экспорты старого экрана |
| 174099e | 5.3e `NoteCreate`, `SchedulePage`, `SlotForm`, `TasksPage`, `TaskRow` |
| c044a6f | 5.3f `ExamHubPage`, `ExamImportPage`, `TicketView`, `TicketEdit`, `CheatsheetPage`, `ExamParticipantsPanel`, `LinkedLecturesField`, осиротевший `shareService` |
| 37bffc3 | 5.3g `CardLibraryPage`, `CardStudyPage`, `FlashcardPlayer` |
| 58ced67 | 5.3h `OnboardingWizard`, `steps/*`, `labels` |
| 183fac7 | 5.4 старый каркас: `GlobalSidebar`, `BottomTabBar`, `DocumentScrollbar`/`ScrollBar`, `TableOfContents`, `ModeToggle`, `AccountActions`, `useLectureSearch` |
| a3cf52e | 5.5 `components/ui/` (14 файлов), `DesignPage`, `subjectPalette.ts` |
| 71dad30 | 5.6 флаг: `isNewUI`, ветки в `App.tsx`, `LectureView`, `.env.example`, комментарии; `Header` явно `return null` |
| 25d6221 | 5.7a мёртвые CSS-правила: `App.css` −314 класса, `components.css` −113 |
| b2742b4 | 5.7b `App.css` слит в `styles/components.css`, файл удалён |
| c572012 | 5.8 `*New` → без суффикса (16 файлов, `LectureViewNew` → `LectureView`) |

**Размер:** 112 файлов, +4829 / −18687 (в плюсе в основном перенос `App.css` в `components.css`, ~3100 строк; `src` без учёта этого: удалено 75 файлов). `App.tsx` 336 → ~230 строк.

**Остаётся из-за бэклога (по графу импортов, удалять нельзя):** страницы `NotesPage`, `ExamsPage`, `CoursesPage`, `MorePage`, `DeckEditorPage`; от них зависят только они: `components/AddTile`, `ConfirmDialog`, `CourseCard`, `CourseFormTile`, `CourseTile`, `ExamCourseCard`, `InlineEditor`, `KebabMenu`, `LectureTile`; `hooks/useConfirmDialog`, `useCourseForm`; `lib/courseGradient`, `lib/tileActions`. `lib/colors.ts` и `courseService.randomCourseColor` живы и без бэклога (`SubjectFormDialog`). Остались по решению: `Header` (`return null`, тело и микрофон сохранены, комментарий «см. бэклог: голосовой ввод»), `SpeechProvider`, `useSpeech`, `VerifyEmailPage`, `VITE_AUTH_EMAIL`, заготовки волны C (`joinGroupByCode`, `fetchCommonTickets`, `resetInviteCode`, `transferGroup`, маршруты `assign` и `DELETE share-subgroup`), поле `courses.color`, миграции, API-правила.

**Отступления от плана (и почему):**
- `groupService.ts` не удалён целиком: им пользуются живые `AccountDeleteFlow`, `JoinGroupPage`, `searchService`. Удалены только экспорты, которыми пользовался старый экран группы; остались `fetchMyGroups`, `fetchRoster`, `joinByInviteCode`, `fetchGroupPreview`, `GroupPreview`, `resetInviteCode`, `transferGroup`.
- `StepCityUniversity`, `StepPeriods`, `labels`, `steps/*` оказались не нужны новому онбордингу и настройкам: удалены.
- `DesignPage` удалена (dev-страница `/_design` старых `ds-*`, держала `components/ui` и `subjectPalette`).
- Шрифт Inter 700 оставлен: `font-weight: 700/800` используется в редакторе и лекции (`components.css`). Комментарий в `main.tsx` обновлён.
- При слиянии `App.css` в `components.css` из его `:root` убраны 28 переменных, которые `tokens.css` и раньше переопределял (итоговые значения те же); 23 App-only переменные остались. Порядок каскада сохранён (бывший `App.css` идёт первым в файле).

**Проверки (после каждого коммита):** tsc, oxlint (11), vitest 301/301, build, Playwright затронутых спеков; ни один коммит не оставил красных. Финал: tsc чисто, oxlint 11, vitest 301/301, build проходит, **Playwright 125 прошли / 6 fixme / 0 красных**.

**Скриншоты 20 × 2:** `final` против `base3`: 39 из 42 совпадают побайтно. Различаются `d-groupnew`, `m-groupnew` (случайный код приглашения на экране) и `d-lecture` (подпись в шапке «Сохранено» / «Обновлено только что»: зависит от того, успел ли сработать автосейв лекции при съёмке; в промежуточных снимках `mid3`, `css2` на тех же файлах CSS она совпадала). Визуальных расхождений от удаления кода и CSS нет.

**Заключение ревьюера (независимый субагент, правок не вносил): можно принимать, блокеров нет.** Потерянных экспортов, сломанных импортов, осиротевших файлов нет; все файлы из списка «остаётся» на месте и достижимы; из 437 удалённых CSS-классов ни один не используется динамически, правила Tiptap, ProseMirror, excalidraw, math и `cover-*` не затронуты; `var(--x)` без определения нет; в `Header.tsx` тело и микрофон сохранены. Находки, требующие вашего решения или внимания:
- **Потеряно удаление колоды карточек (важно).** `deleteDeck` в `deckService.ts` теперь нигде не вызывается: его вызывал только удалённый `CardLibraryPage` (с подтверждением «Удалить колоду?»). В `CardsPage`, `DeckPage`, `DeckEditorPage` есть только удаление карточки. В макетах и `docs` решения об этом нет (удаление билета, для сравнения, записано в `decisions.md` как открытый вопрос). Нужно решение: вернуть удаление колоды в новый экран или принять потерю.
- **`framer-motion` больше не используется** (его импортировал только удалённый `FlashcardPlayer`). Удаление из `package.json` и lock-файла не делал, нужно ваше слово.
- **Функции без вызывающих после запуска** (кандидаты на уборку в теме 1/10, не удалялись): `setExamMode`, `fetchParticipants`, `addParticipant`, `removeParticipant`, `deleteTicket` (`examService.ts`); `showLectureToGroup`, `hideLectureFromGroup`, `createUnassignedLecture` (`lectureService.ts`); `requestDeletion` (`deletionService.ts`); `lectureOwnerId`, `lectureGroupId`, `groupOwnerId`, `memberUserId`, типы `LectureShare`, `PremiumGrant` (`lib/types.ts`); `transferGroup` и `resetInviteCode` (заготовки волны C, по решению остаются).
- **Поиск похожих групп** (защита от фрагментации потока) исчез вместе со старым экраном; `GroupCreatePage` его не вызывает. Серверный маршрут `/api/groups/search` жив (его вызывает только `tests/group-access.spec.ts`). Осознанная потеря или вернуть в новый экран, решаете вы.
- **Устаревшие комментарии** с именами удалённого (`GlobalSidebar`, `TableOfContents`, `App.css`, `*New.tsx`): `Header.tsx:1-12, 11`, `AppLayout.tsx:34`, `LectureLayout.tsx:14`, `lectureFrame.ts:51`, `uiShellContext.ts:8`, `AppShell.tsx:72, 156`, `useTocScan.ts`, `useProductSearch.ts`, `useLectures.ts`, `tokens.css`, `src/DESIGN.md`, `components.css` (несколько мест), `.clinerules` (почти целиком про удалённый код). Не правились.
- **Легаси-алиасы в `tokens.css:191-215`** («удалить вместе с App.css»): часть не читается нигде (`--brand-1-hover`, `--brand-wash`, `--success-ink`, `--success-soft`, `--warning`, `--warning-ink`, `--warning-soft`), остальные ещё используются. Уборка отдельным шагом.
- `tests/group-mode.spec.ts` обращается к 53 селекторам удалённого экрана группы в fixme-тестах (Д9): при написании новых UI-тестов их переписать, не оживлять.

**Что не удалось проверить:**
- Экраны, которых нет среди 20 маршрутов (квиз, мастер онбординга, сброс пароля, вход по ссылке `/join`, билет, шпаргалка, импорт билетов, плеер карточек, окна форм): только Playwright-спеками, снимков «до/после» нет. CSS для них чистился по `css-unused.mjs` (учитывает шаблонные префиксы и классы из БД), но пиксельной сверки нет.
- Страницы `/schedule` и `/tasks` не покрыты спеками, только скриншотом.
- Прод-значение `VITE_NEW_UI` в Cloudflare не проверялось (A0 закрыт решением владельца: новый UI единственный). Локальный `apps/web/.env` (вне git) по-прежнему содержит `VITE_NEW_UI=true`: переменная больше ничего не читает, её можно удалить.
- Первая пара снимков со старого кода показала расхождение в `/schedule` («0 пар» вместо 13) из-за гонки загрузки при ожидании 700 мс; при ожидании 2,5 с оба кода дают одинаковый результат. Это особенность скрипта съёмки, не кода.

**Нашёл по пути (запуск 4):**
- `Header.tsx`: после явного `return null` остаётся недостижимый код; Firefox пишет предупреждение «unreachable code after return statement» в консоль. На oxlint не влияет (11).
- Зависимости `framer-motion`, `lucide-react` и др. могли остаться без пользователей после удаления старого UI: `package.json` не трогался, проверка в теме 10.
- `docs/design/ia/userflow.json`, `docs/decisions.md` содержат старые имена (`LoginPageNew`, `AppShellNew`, `LectureViewLegacy`, `ExamParticipantsPanel`): документы не правились.
- `/login?invite=` работал только в старом `Login.tsx`; в новом интерфейсе приглашение идёт через `/join/КОД`.
- `scripts/refactor-shots.mjs` и `scripts/css-unused.mjs` не закоммичены (ждут вашего ответа: коммитить или удалить).

### Запуск 5 (28.10): слияние, мелочи, темы 3, 4, 7
**Часть А (слияние и пуш).** `refactor/cleanup-2026-10` была отрезана от `design/c-group` (e45b20b); у веток не было апстрима, основная ветка репозитория `main`. Проверки на конце ветки: tsc, oxlint 11, vitest, build. Файлов, которых в репозитории быть не должно (`*.db`, `pb_data/`, `.env*`, ключи, токены, крупные blob), в 75 новых коммитах нет (`apps/web/.env.example` и `.env.https` — пример и конфиг без секретов, `.env.https` был в репозитории и раньше). Тег `pre-refactor-2026-10` создан на e45b20b. Слияние `git merge --no-ff` в `design/c-group`: коммит 51339c2, конфликтов нет, проверки после слияния зелёные. Запушены только именованные ссылки в `cohorta` (github.com/misha-quartzevsky/cohorta): ветка `design/c-group` (до этого её на remote не было; Cloudflare Pages собирает только preview, прод обновляется слиянием в `main`) и тег `pre-refactor-2026-10`; удалённая копия совпадает с HEAD (51339c2). Первая попытка пуша ветки оборвалась по сети (`connection reset`), вторая прошла. Без `--all`, `--mirror`, `--tags`, `--force`. Дальнейшая работа в ветке `refactor/cleanup-2026-10b`; `refactor/cleanup-2026-10` не удалена.

**Мелочи (шаг 0).** `framer-motion` удалён (импортов не было). `refactor-shots.mjs` перенесён в `apps/web/scripts/dev/` с переносимыми путями (tmpdir и `process.cwd()`, `DEMO_EMAIL`/`DEMO_PASSWORD`), `css-unused.mjs` удалён. `deleteDeck`: действия «Удалить колоду» нет в `Screen-deck`, `Screen-cards`, `Screen-m-deck`, `Screen-m-cards` (и в `decisions.md`, `ia/`): дефекта класса C нет, записано в раздел 9, `deleteDeck` оставлен. Поиск похожих групп не возвращался.

**Коммиты (12, 51339c2..HEAD)** и объём: 61 файл, +1505 / −1177 (в `src`: 51 файл, +1344 / −1068; в плюсе новые тесты и разрезанный `lib/types.ts`).
| Коммит | Что |
|---|---|
| 919448e | `framer-motion` убран |
| c30c214 | `refactor-shots.mjs` в `scripts/dev`, `css-unused.mjs` удалён |
| 9d037ce | отчёт после удаления старого UI (шаг 1) |
| 15f9c63 | тема 3: vitest гоняет каждый тест в UTC и Europe/Moscow (проекты `utc`, `msk`); тесты дат до замены |
| 35dafde | e2e: порты песочницы настраиваются (`E2E_PB_PORT`, `E2E_BASE_URL`, `PB_URL`): на 8090 работал собственный PocketBase владельца, песочница шла на 8091 |
| 6041767 | 3.1: 11 копий `new Date(x.replace(" ", "T"))` → `parsePbDate` |
| aecc101 | 3.2: `formatDayMonth`, `formatLocaleDayMonth` (3 копии `formatDate`), `calendarDaysUntil` (одна «дней до экзамена»), `parsePbDate` понимает дату без времени |
| 2e6b712 | 4.1: `pb.filter` с параметрами (courseService, examService, lectureService, scheduleService, searchService, genericService, useLastVisited, quizService); N+1 в `fetchReadinessQuestions`; `fields` у `fetchReadiness*`; `fetchRecentLectures` через `getList`; `fetchAllLectures({content:false})`, `fetchRecentLectureMeta` |
| 3324309 | 4.2: `loadLectureReadinessRows`, `useReviewSuggestions` без повторных запросов, `useCourseBySlug` вместо `useLectures` в `AppShell` и `LectureLayout`, `useRecentLectureMeta`, защита от устаревшего ответа в `useAsyncData` |
| a4c5290 | 7.1: `lib/types.ts` → `recordTypes.ts`, `fields.ts`, `accessors.ts`, `types.ts` только реэкспортирует (77 имён, потерь нет) |
| 3637997 | 7.2: убраны `as unknown as` (кроме `SpeechProvider`), `globals.d.ts`, типизированный ref Excalidraw вместо `any` |
| 9d75a90 | 7.3: `PanelAnswer`, `QuestionRef`, `AnswerRef`, `LectureOverviewRow`, `SuggestionLecture` через `Pick` и индексированные типы |

**Не менялось намеренно (по правилам):** `examService.fetchUpcomingExam` берёт UTC-день (добавлен `services/examService.test.ts`, фиксирует отличие от `todayStr()` в Europe/Moscow), метки чётности и массивы дней недели (разной формы), округление `floor`/`round` в днях, строковые сравнения дат в `notifyCtx.ts` и `NotifyProvider.tsx` (лексикографическое сравнение ISO-строк, не разбор даты), `SpeechProvider`, схема и миграции.

**Проверки:** после каждого коммита tsc, oxlint (11), vitest, build, затронутые Playwright-спеки. vitest теперь гоняет каждый тест в двух часовых поясах: 301 → 322 теста × 2 проекта = 644 (с тестом входа без зоны 644+2). В конце каждой темы полный Playwright на песочнице (8091): темы 3, 4, 7 — **125 прошли / 6 fixme / 0 красных** каждый раз; скриншоты 20 × 2 до/после каждой темы совпадают побайтно, кроме `d-groupnew`, `m-groupnew` (случайный код приглашения на экране) и, иногда, шапки лекции (индикатор «Сохранено/Обновлено только что» зависит от автосейва при съёмке).

**Заключение ревьюера (независимый субагент, правок не вносил): можно принимать, блокеров и видимых расхождений нет.** Расхождение `parsePbDate` и старой формулы только на входе без зоны со временем (раньше локальное время, теперь UTC; в данных PocketBase не встречается, закреплено тестом) и на мусоре (раньше Invalid Date, теперь `null`, каждое место обрабатывает как раньше). Все `fields` покрывают читаемые поля; `fields=...,expand` отдаёт всё поддерево `expand` (проверено на живом ответе песочницы). `loading` в `useAsyncData` не залипает (в том числе при `enabled` true→false→true и StrictMode).

**Нашёл по пути (запуск 5):**
- `useReviewSuggestions`: «сегодня» фиксируется на момент загрузки данных; страница задач, открытая через полночь, не пересчитает дату до перехода на другой маршрут. Раньше смена dedupe-ключей приводила к новой загрузке. Практически не достижимо.
- `formatLocaleDayMonth` (бывшие три `formatDate`) читает строку через `new Date(dateStr)` без `parsePbDate`: в Safari строка «YYYY-MM-DD hh:mm:ss.000Z» с пробелом даёт Invalid Date, а UTC-полночь в поясах с отрицательным смещением показывает предыдущий день. Унаследовано, не менялось.
- `examDaysLeft` теперь читает дату через `parsePbDate`: в Safari «дней до экзамена» может появиться там, где раньше было `null` (видимое улучшение, формально отличие).
- Осталось ещё несколько склеек значений в фильтрах PocketBase (все на id): `GroupAccessPage.tsx:83`, `courseService.ts:30`, `deckService.ts:46`, `examService.ts:109`, `quizService.ts:64,191`, `scheduleService.ts:53,100`, `lectureService.ts:254-255`; в `quizService.fetchReadinessQuestions` при сбое запроса квизов теперь пропадают все квизы, а не один (сбой общий, на практике не различим).
- `fetchRecentLectures` и `fetchRecentLectureMeta` через `getList` делают лишний запрос подсчёта: можно `skipTotal: true`.
- Необязательные поля, которые на деле обязательны (только пометка, нужна миграция): в создающих миграциях `required: false` у `schedule_slots.week_parity` и `kind`, `quizzes.size`, `quiz_questions.prompt` и `topic`, `quiz_answers.correct`, `attempt`, `answered_at` (клиент их всегда пишет); для `lectures.slug`, `courses.slug`, `decks.slug` создающих миграций в репозитории нет (коллекции появились раньше).
- Тестов на новую логику слоя данных нет (`pb.filter`, N+1, `loadLectureReadinessRows`, счётчик запусков `useAsyncData`): нет React-тестовой среды; ценнее всего был бы тест гонки двух запусков.
- На 8090 у владельца работает собственный PocketBase; `e2e-sandbox.mjs` отказывается там стартовать, песочница идёт на другом порту (см. `docs/design/PROGRESS.md`).

**Не сделано и почему (вопросы к вам):**
1. **Двойная загрузка лекции** (`AppShell` через `useLectureBySlug` и `LectureView`): не делал. Общий источник данных меняет момент появления данных и состояние сохранения в шапке, это видимое поведение. Нужно ли это делать, и с каким допустимым отличием?
2. **Текст лекций в `fetchAllLectures`:** для «Все лекции» оставлен, потому что `DraftsPage` показывает число слов черновика по `content`. Убрать текст можно, только если счётчик слов брать иначе (видимое изменение либо серверный счётчик). Решение за вами.
3. Остальное из тем 3, 4 и 7 выполнено; темы 6, 8, 9, 10 не начинались.

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
- **Удаление колоды карточек (запуск 5, проверено).** `deckService.deleteDeck` ни из одного экрана не вызывается: его вызывал только удалённый `CardLibraryPage` (с подтверждением «Удалить колоду?»). В макетах `Screen-deck`, `Screen-cards`, `Screen-m-deck`, `Screen-m-cards` действия «Удалить колоду» нет (поиск «удал» по ним, по `docs/decisions.md` и `docs/design/ia` пуст), значит дефекта класса C нет: это осознанная или забытая потеря. Решение владельца нужно, только если удаление колоды требуется; `deleteDeck` оставлен.
- **Поиск похожих групп** (защита от фрагментации потока) исчез вместе со старым экраном группы; серверный маршрут `/api/groups/search` жив (его вызывает только `tests/group-access.spec.ts`). По решению владельца не возвращается.
- `tests/group-mode.spec.ts` в fixme-тестах (Д9) использует 53 селектора удалённого экрана группы: при написании новых UI-тестов переписать, не оживлять.
