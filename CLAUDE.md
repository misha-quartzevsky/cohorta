# CLAUDE.md

В начале сессии читай `docs/design/PROGRESS.md`. В конце сессии обновляй его: что сделано, что осталось, какие решения приняты.

# cohorta
Монорепо. apps/web: React 19, Vite, TypeScript, Tiptap 3, Excalidraw. pocketbase/: PocketBase 0.25.9 (pb_hooks, pb_migrations, Go/SQLite). apps/web/functions: Cloudflare Pages Functions (/api/quiz/generate). Один разработчик, реальных пользователей пока нет, закрытая бета впереди. Владелица пишет по-русски; итог кратко, подробности в файл.

## Проверки (после каждого коммита)
cd apps/web && npx tsc -b --noEmit && npx oxlint && npx vitest run && npm run build
oxlint: не больше 11 предупреждений (текущий уровень). Playwright: node scripts/e2e-sandbox.mjs (песочница на копии pb_data, порт через E2E_PB_PORT, E2E_BASE_URL, PB_URL). Мутации хуков: node scripts/c-mutations.mjs (ожидается 54 из 54). Допустимы только 2 test.fixme: микрофон (Д11), «Готовность подгруппы».
Порт 8090 занят PocketBase владелицы: не запускай на нём, не убивай чужие процессы pocketbase.exe.

## Git
Пушить только именованную ветку. Никогда --all, --mirror, --tags, --force и не пушить в main/master без явного разрешения (прод Cloudflare обновляется слиянием в main). В локальной истории есть служебные refs/cline/* с базами данных и фото: массовый пуш опубликует их. Репозиторий публичный. Перед пушем проверяй разницу на *.db, *.sqlite, pb_data/, storage/, .env*, *.log, ключи. Слияния через --no-ff. Тег отката pre-refactor-2026-10. Не используй git worktree remove --force там, где node_modules подключён junction (Windows): это стирает node_modules.

## PocketBase
Хуки подхватываются только после перезапуска PocketBase. В JSVM функции-обработчики не видят переменные верхнего уровня файла: общий код подключай через require внутри обработчика; внутри lib_*.js require относительный, абсолютный с __hooks даёт Invalid module. Прод отстаёт от репозитория (старые миграции и хуки): при выкатке старые файлы groups_access.pb.js, group_access.pb.js, exam_groups.pb.js нужно удалить, иначе маршруты регистрируются дважды и PocketBase не запускается. Список файлов и порядок выкатки: runbook и docs/design/prod-access-hotfix-plan.md.

## Продукт и дизайн
Макет (docs/design/screens, userflow) источник истины. Расхождение с макетом — дефект класса C: описать (шаги, макет, серьёзность), не чинить без разрешения. Термин «groups», не «cohorts». Новый интерфейс единственный. Не трогать без разрешения: страницы старой вёрстки (NotesPage, ExamsPage, CoursesPage, MorePage, DeckEditorPage), Header/SpeechProvider/useSpeech (Д11), заготовки волны C (joinGroupByCode, fetchCommonTickets, resetInviteCode, assign, DELETE share-subgroup), VerifyEmailPage. Поиск похожих групп снят осознанно (вступление только по коду).

## Рамки изменений
Схему, миграции, API-правила, деплой-конфиги, секреты менять только по явному запросу. Прод не трогать: без записей, без входа, без проверки паролей. Тесты фиксируют текущее поведение. Поведение не менять при рефакторинге; исключения оговариваются отдельно. Попутные находки не чинить, а записывать в docs/review/refactor-2026-10.md («Нашёл по пути»). Отдельный ревьюер (субагент, не писавший правки) смотрит дифф перед итогом.
