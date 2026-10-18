# Разведка перед миграцией дизайна (волна A0)

Дата: 2026-10-18. Ничего в коде не менялось — это только сбор фактов перед волной A1.
Пути указаны от корня репозитория. Персональные данные не собирались и не приводятся — только схема, правила и код.

## 1. Роутинг

React Router v6 (`BrowserRouter`), без файлового роутинга. Дерево маршрутов — в `apps/web/src/App.tsx`, обёрнуто провайдерами `ModeProvider > UndoProvider > SpeechProvider > SemesterProvider > ToastProvider`. `ProtectedRoute` закрывает всё, кроме `/login` и `/privacy`.

Большинство маршрутов рендерятся внутри `AppLayout` (боковое меню/шапка); `/onboarding` и `/quiz/:lectureId` — полноэкранные, вне `AppLayout`.

Основные маршруты:
- `/login` → `Login.tsx`, `/privacy` → `PrivacyPage.tsx`
- `/onboarding` → `features/onboarding/OnboardingWizard.tsx`
- `/quiz/:lectureId` → `pages/QuizPage.tsx` (полноэкранный)
- `/` → `HomeRedirect` (инлайн в `App.tsx`) → редирект на последний/первый семестр или `/onboarding`
- `/s/:semesterSlug` → `Dashboard.tsx`
- `/s/:semesterSlug/courses` → `CoursesPage.tsx`
- `/s/:semesterSlug/exams` → `ExamsPage.tsx` (статичный сегмент, выше `:courseSlug`)
- `/s/:semesterSlug/group` → `GroupPage.tsx` (статичный сегмент)
- `/s/:semesterSlug/:courseSlug` → `LecturesPage.tsx`
- `/notes`, `/note/new` → `NotesPage.tsx`, `NoteCreate.tsx`
- внутри `LectureLayout`: `/s/:semesterSlug/:courseSlug/:lectureSlug`(`/edit`) и `/note/:lectureSlug`(`/edit`) → `LectureView.tsx` (единая поверхность, инлайн-редактор)
- `/s/:semesterSlug/:courseSlug/exam` → `ExamHubPage.tsx`
- `/s/:semesterSlug/:courseSlug/exam/import` → `ExamImportPage.tsx`
- `/s/:semesterSlug/:courseSlug/exam/cheatsheet` → `CheatsheetPage.tsx`
- `/s/:semesterSlug/:courseSlug/exam/:number`(`/edit`) → `TicketView.tsx` / `TicketEdit.tsx`
- `/decks`, `/decks/new`, `/decks/:slug`, `/decks/:slug/edit` → `CardLibraryPage.tsx`, `DeckEditorPage.tsx`, `CardStudyPage.tsx`, `DeckEditorPage.tsx`
- `/schedule` → `SchedulePage.tsx`; `/tasks` → `TasksPage.tsx`
- `/_design` → `DesignPage.tsx` (только `import.meta.env.DEV`)
- `*` → редирект на `/`

Виджеты дашборда: `apps/web/src/pages/dashboard/` (`HeroSection`, `PriorityHero`, `TodayWidget`, `ActivityTimeline`, `CoursesWidget`, `DayDetailPopover`, `QuickActionsBar`, `ReviewBlock`, `StudyWeekStrip`).

**Важно для раздела IA:** в коде курс называется `course`/`:courseSlug`, а в новой терминологии это «предмет». Переименование потребует аккуратной сверки (раздел 9 инструкции: «не переименовывать термины» — здесь переименование наоборот обязательно, т.к. слово `course` в коде ≠ слово «курс» в смысле учебного года).

## 2. Как сейчас устроены стили

Обычный глобальный CSS, без CSS-модулей, styled-components и Tailwind. Иногда инлайн `style={{}}` (например `HomeRedirect` в `App.tsx`, `SubjectCover.tsx`).

Глобальные таблицы стилей:
- `apps/web/src/App.css` — основной/легаси файл (~6000+ строк). Строка 1 — `@import` Google Fonts Inter. Строки 3–77 — токены дизайн-системы v1 («Light Craft»), дальше стили всех компонентов.
- `apps/web/src/index.css` — только сброс (margin/padding html/body/#root, button inherit).
- `apps/web/src/styles/tokens.css` — **второй, более новый набор токенов** («дизайн-основа»), по комментарию в начале файла предназначен только для новых компонентов (`src/components/ui/*`) и новых экранов (расписание, задачи, квиз, обновлённый дашборд); старые экраны остаются на токенах `App.css`.
- `apps/web/src/styles/components.css` — компонентный CSS, использующий токены v2 (`.ds-cover`, `.ds-page` и т.д.).
- `apps/web/src/DESIGN.md` — человекочитаемый свод правил дизайна, который сейчас описывает токены v1.

**Вывод: в репозитории уже есть две параллельные, не до конца согласованные дизайн-системы.** Новую миграцию (токены из `docs/design/design-system/tokens.json`) нужно явно объявить третьей/финальной и заменить обе, а не добавлять поверх.

### Токены v1 (`App.css`, строки 3–77)
```
--brand-1 #5843F6 / --brand-1-hover #4A37E0 / --brand-2 #B5CBFA
--brand-gradient: linear-gradient(120deg, var(--brand-1), var(--brand-2))
--brand-wash rgba(88,67,246,.08) / --brand-ring rgba(88,67,246,.12)
--ink #1C1C22 / --ink-2 #5B5B66 / --ink-3 #72727D
--bg #F7F7F9 / --surface #FFFFFF / --border #EAEAEF / --border-strong #DFDFE6
--success #0F9D77 / --danger #E24B4A / --warning #F5A623
--radius-sm 8 / --radius(md) 12 / --radius-lg 16
--space-xs..2xl (8/12/16/24/32/40px)
Палитра курсов (6 градиентов, DESIGN.md §1.2):
  --course-violet  #5843F6→#B5CBFA (= brand)
  --course-coral   #FF6B4A→#FFB199
  --course-blue    #2F80ED→#A5D8FF
  --course-magenta #C239B3→#F4A6E0
  --course-green   #0F9D77→#A8E6C9
  --course-amber   #F5A623→#FFE1A8
Легаси-алиасы: --c-black→--ink, --c-lilac→--brand-1, --c-bg→--bg, --c-surface→--surface, --c-muted→--ink-3
```

### Токены v2 (`styles/tokens.css`, весь файл)
Другая, тёплая нейтральная палитра: `--color-canvas #f2eee8`, `--color-surface #faf8f5`, `--color-card #fff`, `--color-ink #1b1916`, `--color-accent #e8601c` (оранжевый, НЕ фиолетовый), `--color-success #2e7a4d`, `--color-danger #bf3b2f`, полная типографическая шкала (`--text-display` … `--text-tab`), отступы `--space-1..7`, радиусы `--radius-sm/md/lg/xl/pill`, `--shadow-pop`, токены движения, фокус-ринги, layout-токены (`--sidebar-width`, `--content-max`), шрифтовый стек `--font-ui: "Inter","Segoe UI",system-ui,sans-serif`. Есть зарезервированный пустой блок под тёмную тему.

**Важно:** v2 уже использует оранжевый акцент (#e8601c), но это **другой оттенок**, чем новый бренд-токен `accent` #E86800 из `tokens.json`. Раздел 7 инструкции прямо требует убрать из кода цвет #E8601C — он попадёт под чистку волны D вместе с индиго.

## 3. Где используется индиго/фиолетовый

`apps/web/src/DESIGN.md:13` явно запрещает дефолтный Tailwind `indigo-500`/`#6366F1` как «AI-дефолтный» акцент — то есть нынешний фиолетовый (`#5843F6`) заявлен как осознанный бренд-цвет, не шаблонный. Для переноса это не меняет задачу: индиго/фиолетовый убирается полностью по новой инструкции, независимо от того, что он был «осознанным».

Найденные hex-значения фиолетовой/сиреневой семьи и места использования:
- `#5843F6` (brand-1) — `App.css:5,63` (`--brand-1`, начало градиента `--course-violet`), `lib/colors.ts:13` (`COURSE_COLORS[0]`), `lib/courseGradient.ts:18` (`COURSE_GRADIENTS[0]`), `components/TagBadges.tsx:40` и `TagEditor.tsx:78` (цвет тега по умолчанию), `public/manifest.json:8` (`theme_color`), `index.html:7` (`<meta name="theme-color">`).
- `#B5CBFA` (brand-2) — `App.css:7,63`, `lib/courseGradient.ts:18`.
- `#4A37E0` (`--brand-1-hover`) — `App.css:6`.
- `rgba(88,67,246,…)` (brand-wash/ring/shadow-brand) — `App.css:9,10,52` и блок карточек-флешкард `App.css` ~L3822–3850 (`.flash-exit`).
- `#C239B3` (магента, курс-палитра №4) — `App.css:66`, `colors.ts:16`, `courseGradient.ts:21` — смежный оттенок, не чистый индиго, но из той же системы «цвет курса».

Где именно фиолетовый градиент бросается в глаза:
- **Баннер «Продолжить»** — `.resume-block` в `App.css:4446–4451` (`background: var(--brand-gradient)`, тень `rgba(88,67,246,.28)`), рендерится `pages/dashboard/PriorityHero.tsx` (подпись «Продолжить» — строка 92). Пустое состояние тоже использует градиент: `App.css:4489–4494` (`.resume-empty .resume-cta`). Это ровно тот баннер, который по инструкции (п.2.1) нужно сделать плоской карточкой.
- **Прогресс-бар карточек/колод**: `.flash-progress-fill { background: var(--brand-gradient); }`, секция «FLASHCARDS MODULE (Decks) — Light Craft» в `App.css` (~L3822+, заливка ~L3892).
- Кнопка выхода из флешкард использует rgba-оттенок бренда (не сам градиент): `.flash-exit` (~L3845–3853).
- `public/manifest.json`: `"theme_color": "#5843f6"`, `"background_color": "#f5f4fb"` (светлый оттенок с фиолетовым подтоном) — то есть системная PWA-хром сама окрашена в фиолетовый.
- `index.html:7` `<meta name="theme-color" content="#5843f6">`.

Буквальных строковых идентификаторов "indigo"/"purple"/"violet" в коде почти нет, кроме имени токена `--course-violet` и комментариев на русском/английском («violet (brand)») — переименование точечное, не разбросанное по десяткам файлов.

## 4. Обложки предметов

- `apps/web/src/components/ui/SubjectCover.tsx` (49 строк) — текущий компонент обложки. Рендерит `<div className="ds-cover">` (или `.ds-cover--wide`) с инлайновым `style={{ background }}`; картинок нет, только CSS-градиент.
- Источник цвета — `apps/web/src/lib/subjectPalette.ts`: `SUBJECT_PALETTES` (8 ключей: `civil, mkt, stat, phil, green, lilac, sand, sky`), каждый — многослойный radial-gradient («блотч»-дизайн), не простой линейный. `resolvePalette(id, stored)` берёт сохранённый `course.color`, если он совпадает с известным ключом палитры, иначе детерминированно хеширует id предмета (`paletteForId`) — отдельного поля-сида нет.
- **Поля `cover_seed` в PocketBase нет.** Коллекция `courses` (`pocketbase/pb_migrations/1786618598_created_courses.js` + `1786713487_updated_courses.js`) содержит только свободный текстовый `color`, добавленный позже. Генерация обложки сейчас полностью клиентская и детерминированная от `id` + опционального `color`.
- Отдельно есть **вторая, другая** система цвета курса: `apps/web/src/lib/courseGradient.ts` + `lib/colors.ts` — 6 кураторских линейных градиентов, снэппинг произвольного легаси-hex к ближайшему пресету (`nearestPreset()`), используется в карточках курса/дашборде (другой код-путь, не связан с `SubjectCover`/`subjectPalette.ts`).

**Для волны A3:** нужно (1) добавить миграцию `subjects.cover_seed` (0–359) по инструкции, (2) решить, что заменяет обе существующие системы — `subjectPalette.ts` и `courseGradient.ts`/`colors.ts` — одной функцией/классом `SubjectCover`/`.c-cover` из дизайн-системы, и прямо сообщить Маргарите, что заменяется (по п. 2.3 инструкции).

## 5. Шрифты

Inter — единственный шрифт, используется везде.
- Подключается через Google Fonts `@import` в `App.css:1`: `@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");`.
- `styles/tokens.css:46` ссылается на тот же шрифт (`--font-ui: "Inter", "Segoe UI", system-ui, sans-serif;`) без повторной загрузки — зависит от того, что Inter уже подключён в `App.css`.
- В `index.html` тегов `<link>` для шрифтов нет — загрузка только через CSS `@import`.
- `@fontsource/*` не используется, `@font-face` в коде нет. По новой инструкции (п. «Основа») нужно перейти на `@fontsource/inter` (400/500/600, кириллица) вместо внешнего CDN.
- Неиспользуемый актив: `apps/web/public/fonts/` содержит локальные `Golos-UI_*.ttf` (Regular/Medium/Bold/VF) + файлы лицензии. `App.css:4873` указывает `font-family: "Golos UI"` для одного селектора (`.exam-cheatsheet-question`), но `@font-face` для «Golos UI» нигде не объявлен — правило молча откатывается на Inter. Файлы фактически мёртвые, можно убрать при уборке (волна D) или явно подключить, если она когда-то нужна была для билетов/шпаргалки — решение за Маргаритой, самостоятельно не подключать.
- Шрифты Excalidraw (`apps/web/public/excalidraw-fonts/`) относятся к встроенному скетч-компоненту (`components/sketch/`), не к типографике интерфейса — не трогать.

## 6. Манифест и иконки

`apps/web/public/manifest.json` (весь файл):
```json
{
  "name": "Cohorta — Умные конспекты и заметки для студентов",
  "short_name": "Cohorta",
  "description": "SaaS-сервис для студентов: конспекты, заметки и управление курсами в формате Notion",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f5f4fb",
  "theme_color": "#5843f6",
  "orientation": "portrait-primary-preference",
  "icons": [
    { "src": "/cohorta-black.svg", "sizes": "192x192", "type": "image/svg+xml", "purpose": "maskable any" },
    { "src": "/cohorta-black.svg", "sizes": "512x512", "type": "image/svg+xml", "purpose": "maskable any" }
  ]
}
```
- Подключён из `index.html:8` (`<link rel="manifest" href="/manifest.json" />`); favicon — `index.html:5` (`<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`).
- `apple-touch-icon` нигде не объявлен и файла нет.
- Прочие файлы в `apps/web/public/`: `favicon.svg`, `cohorta-black.svg` (единственная PWA-иконка, одна и та же SVG и для 192, и для 512 — растровых версий нет), `icons.svg` (спрайт интерфейсных иконок, не манифестная иконка).
- Файла `manifest.webmanifest` нет — только `manifest.json`. Имя «Cohorta» в манифесте — с прописной, по новой инструкции название нужно переписать строчными («cohorta») и переименовать поле `name`/`short_name`, добавить растровые иконки (16/32/48/180/192/512/maskable 512), поменять `theme_color`/`background_color` на бренд-токены.

## 7. Что уже есть для квиза, карточек, экзамена

Все три модуля уже полностью реализованы — это не greenfield, а «переодеть существующее»:

**Квиз** — `apps/web/src/pages/QuizPage.tsx` (полноэкранный маршрут `/quiz/:lectureId`, без бокового меню и нижней панели, см. комментарий в `App.tsx` «spec 6.3»). Коллекции PocketBase `quizzes`/`quiz_questions`/`quiz_answers` (см. п.8) — поля `model`/`source_hash` указывают на генерацию через LLM из содержимого лекции. Отдельного `services/quiz*.ts` файла по имени не найдено — логика, по-видимому, в самой странице; требует более внимательного чтения перед волной B5.

**Карточки/колоды** — полностью собранный модуль: `CardLibraryPage.tsx`, `CardStudyPage.tsx`, `DeckEditorPage.tsx`, компоненты `components/cards/FlashcardPlayer.tsx` и `RichCardFace.tsx`, отдельная секция CSS «FLASHCARDS MODULE (Decks)» в `App.css` (~L3822+). Коллекции `decks`/`deck_cards` (слаг, `is_public`, порядок позиций, богатый фронт/бэк + вложения).

**Экзамен/билеты** — полностью собран: `ExamHubPage.tsx`, `ExamImportPage.tsx`, `ExamsPage.tsx`, `TicketView.tsx`, `TicketEdit.tsx`, `CheatsheetPage.tsx`, секция CSS «EXAM ENGINE MODULE — Solo Mode» в `App.css` (~L4744+, упоминает «Карта билетов» как характерный элемент — см. DESIGN.md §6). Коллекции `exams`/`exam_tickets`/`exam_participants`, позже дополненные правилами доступа по группе.

**Группы** — `GroupPage.tsx`, коллекции `groups`/`group_members`, плюс `lecture_shares` и `lecture_previews` (не изучены глубоко, но существуют) — групповой доступ уже частично подключён к правилам экзамена.

Для волн B4/B5/C: ничего из этого не создаётся с нуля, задача — перенести на новые токены/компоненты и, где нужно по разделу 6 инструкции, расширить схему (`tickets.lectures`, членство с `preview`, подгруппы), не дублируя то, что уже есть.

## 8. Схема PocketBase (только структура и правила, без значений)

MCP использовался только на чтение (миграции `pocketbase/pb_migrations/*.js`), личные данные не запрашивались.

- **courses** («курс» в коде = «предмет» в новой терминологии): `name`, `color` (свободный текст, добавлен позже). Правила владельца подтянуты позже (`1787615000_tighten_owner_rules.js`).
- **lectures**: поле контента переименовано `content`→`richtext` (`1787200000_rename_lecture_content_to_richtext.js`); поля расписания добавлены позже (`1790000200_lectures_schedule_fields.js`); доступ — владелец, позже ужесточён.
- **notes**: отдельная коллекция заметок без лекции.
- **tags**: несколько итераций полей.
- **decks**: `title`, `color`, затем (`1787300000_decks_upgrade.js`) добавлены `slug`, `description`, `is_public`. В просмотренных миграциях правила (`listRule`/`viewRule`/`createRule`/`updateRule`/`deleteRule`) стояли как `""` (публично) — **не подтверждено ужесточение в более поздней миграции среди просмотренных файлов — это нужно перепроверить отдельно**, прежде чем опираться на «decks приватны» при написании правил волны C.
- **deck_cards**: `front`, `back`, `deck` (связь), `position` (добавлено `1787500000_deck_cards_position.js`); в `decks_upgrade` добавлены более богатые front/back + `attachments`. Правила изначально такие же открытые, как у `decks`.
- **exams**: `course` (связь), `title`, `exam_date`, `owner`, `mode`. Правила: `createRule`/`updateRule`/`deleteRule`/`listRule`/`viewRule` = `"owner = @request.auth.id"`; позже расширено для доступа участников группы (`1787617000_exams_group_access.js`, константа `EXAM_READ` — включает `exam.owner = @request.auth.id` плюс подзапрос по `exam_participants`).
- **exam_tickets**: `exam` (связь), `number`, `question`, `answer`, `attachments`, `status`, `sources`, `author`. Правила — через `exam.owner = @request.auth.id`; позже пара `TICKET_READ`/`TICKET_WRITE` для доступа по группе.
- **exam_participants**: `exam`, `user`. `listRule`/`viewRule`: `"exam.owner = @request.auth.id || user = @request.auth.id"`; `updateRule: null`; создание/удаление — только владелец.
- **quizzes**: `owner`, `lecture` (связь), `source_hash`, `size`, `model`. Все правила CRUD: `owner = @request.auth.id`.
- **quiz_questions**: `owner`, `quiz` (связь), `lecture` (связь), `position`, `type` (select), `topic`, `prompt`, `options` (json), `correct_index`, `answer`, `explanation`, `quote`, `flagged` (bool), `hidden` (bool). Правила — как у `quizzes`.
- **quiz_answers**: `owner`, `question` (связь), `lecture` (связь), `correct` (bool), `answered_at`, `attempt`. Правила — как у `quizzes`.
- **groups**: `name`, `slug`, `owner`, `invite_code`. `listRule`/`viewRule`: `"@request.auth.id != \"\""` (любой авторизованный пользователь может видеть список/запись); создание/изменение/удаление — только владелец.
- **group_members**: `group` (связь), `user` (связь), `joined_at`, `preview_enabled`. `createRule`: пользователь вступает только за себя. `listRule`/`viewRule`: сам участник, или владелец группы, или другой участник той же группы (подзапрос по `group_members`). `deleteRule`: сам участник или владелец группы.
- **lecture_previews**, **lecture_shares**: созданы позже (`1787613000`, `1787614000`), не изучены глубоко, относятся к функциям общего доступа.
- **premium_grants**, **deletion_requests**: биллинг/жизненный цикл аккаунта, к миграции интерфейса не относятся.
- **universities**: создана и заполнена справочными данными (`1787640000`, `1787641000`) — для онбординга.
- **semesters**: несколько обновлений полей (`1787642000_semesters_periods_fields.js` — периоды).
- **users** (auth-коллекция): поля онбординга добавлены в `1787643000_users_onboarding_fields.js`: `username`, `city`, `university`, `university_custom`, `degree_level`, `degree_level_custom`, `course`, `onboarding_completed`. Поле `referral` добавлено отдельно (`1787620000_users_referral.js`); открытая регистрация включена (`1787600000_users_open_registration.js`). `viewRule` в итоге — `"@request.auth.id != \"\""` (любой авторизованный видит любую запись пользователя — нужно для списков одногруппников), `listRule` остался `id = @request.auth.id` (только свой).
- **tasks**: `owner`, `title`, `subject`, `lecture`, `due`, `done_at`, `source`, `dedupe_key`, `dismissed`. Правила — только владелец.
- **schedule_settings**: `owner`, `pair_times`, `odd_week_anchor`, `show_saturday`. Только владелец.
- **schedule_slots**: `owner`, `semester`, `subject`, `weekday`, `pair_number`, `week_parity`, `kind`, `room`, `teacher`, `date_from`, `date_to`. Только владелец.

**Общий паттерн:** почти всё в схеме приватно по умолчанию (`owner = @request.auth.id`), с тремя осознанными исключениями — `users` (просмотр для ростера), `groups`/`group_members` (вступление по коду) и `exams`/`exam_tickets` (доступ участников группы через `EXAM_READ`/`TICKET_READ`/`TICKET_WRITE`). `decks`/`deck_cards`, похоже, остались публичными по умолчанию — это нужно перепроверить перед волной C, прежде чем писать новые правила доступа по разделу 5 инструкции. Названия будущих коллекций для членства/подгрупп/доступа группы (раздел 6 таблицы инструкции, строка «определить в разведке») в текущей схеме не найдены — их придётся создавать с нуля и согласовать имена с Маргаритой, как и требует раздел 9 инструкции («не доверять названиям коллекций из документов»).

## 9. Флаг VITE_NEW_UI

Не найден нигде в `apps/web` (поиск по всему каталогу — ноль совпадений). Флага сейчас не существует, его нужно будет завести с нуля (`import.meta.env.VITE_NEW_UI`) на волне A. Единственный существующий прецедент переключения по окружению — маршрут `/_design`, закрытый `import.meta.env.DEV` (не то же самое, обычный dev-гейт, не кастомный `VITE_`-флаг).

## Сквозной вывод для плана миграции

В репозитории уже есть:
- **две параллельные, не завершённые дизайн-системы** токенов (`App.css` v1 «Light Craft», фиолетовый бренд; `styles/tokens.css` v2 «дизайн-основа», оранжевый акцент #E8601C — другой оттенок, чем новый бренд-токен #E86800);
- **две параллельные системы цвета предмета** (`subjectPalette.ts` — радиальные «блотчи»; `courseGradient.ts`/`colors.ts` — 6 линейных градиентов).

Новую миграцию нужно явно объявить финальной заменой обеих пар систем, а не третьим слоем поверх. Термин `course` в коде всюду означает «предмет» в новой терминологии — переименование `course`→`subject` (как минимум на уровне текста интерфейса, возможно и в части кода/роутов) нужно учесть в плане волны A–B, согласовав с Маргаритой объём переименования в коде (URL-слаги трогать аккуратно, чтобы не сломать ссылки).

Открытые вопросы, которые стоит решить до или во время волны A, не выбирая самостоятельно:
1. Правила `decks`/`deck_cards` похожи на публичные по умолчанию — подтвердить до написания новых правил доступа группы (раздел 5 инструкции).
2. Что делать с «висящими» файлами шрифта Golos UI (`public/fonts/`) — удалить или это был незавершённый перенос шрифта для билетов/шпаргалки.
3. Объём переименования `course`→`subject` в коде (слаги, названия переменных, таблиц) — только тексты интерфейса или глубже.
