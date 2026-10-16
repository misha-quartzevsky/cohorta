# Разведка: расписание, задачи, квиз

Дата: 2026-10-16. Выполнена в ходе планирования по `spec-schedule-tasks-quiz.md`.

## Коллекции PocketBase

| Спек называет | Реальное имя | Поля (ключевые) |
|---|---|---|
| `subjects` / предметы | **`courses`** | `id`, `name`, `color`, `slug`, `owner`, `semesters` (relation) |
| `lectures` | **`lectures`** | `id`, `title`, `content` (HTML, type editor), `field` (relation → courses), `slug`, `file`, `owner`, `group` |
| `semesters` / периоды | **`semesters`** | `id`, `slug`, `label`, `order`, `type`, `is_current`, `user` |
| `tickets` / билеты | **`exam_tickets`** | `id`, `exam`, `number`, `question`, `answer` (HTML), `status`, `sources` (multi-relation → lectures, max 999), `author` |
| — | **`exams`** | `id`, `course`, `title`, `exam_date`, `owner`, `mode` |

**Нет** в базе:
- `schedule_settings`, `schedule_slots`, `tasks`, `quizzes`, `quiz_questions`, `quiz_answers` — всё создавать миграциями.
- Поля `slot`, `lecture_date`, `number` в `lectures` — добавить миграцией.
- `start_date`, `end_date` в `semesters` — **не добавляем сейчас**, используем флаг `is_current`.

## Текст лекции

Хранится как **HTML** в поле `content` типа `editor` (PocketBase richtext). Tiptap на клиенте выдаёт HTML, который сохраняется напрямую. Для извлечения plain text клиент стрипает теги через `DOMParser`. CF Function принимает уже готовый plain text.

## Стили

- Один большой файл `apps/web/src/App.css` (~6100 строк). CSS-токены — в `:root {}` в начале файла.
- Существующие токены: `--ink`, `--ink-2`, `--ink-3`, `--bg`, `--surface`, `--border`, `--border-strong`, `--brand-1`, `--brand-gradient`, `--success`, `--danger`, `--radius-sm`, `--radius`, `--radius-lg`, `--shadow-sm/md/lg`, `--space-xs/sm/md/lg/xl/2xl`.
- Новые токены добавляются в отдельный файл `src/styles/tokens.css` (аддитивно).
- Стили новых компонентов — в `src/styles/components.css`, не в `App.css`.

## Шрифт

Только **Inter** (Google Fonts CDN в `App.css`). Нет `@font-face` в index.html, нет шрифтовых npm-пакетов.

## Библиотека иконок

`lucide-react` v1.31+. Единственная, уже используется везде.

## PocketBase клиент

- Синглтон `pb` в `src/lib/pocketbase.ts`.
- Сервисный слой: `src/services/*.ts` (по одному файлу на коллекцию).
- Хуки: `src/hooks/use*.ts`.
- Типы: `src/lib/types.ts` (интерфейсы + объект `FIELDS`).

## Роутинг

React Router v7, `BrowserRouter`. Все защищённые роуты под `<ProtectedRoute>` + `<AppLayout>`. Семестро-зависимые роуты: `/s/:semesterSlug/...`. Глобальные: `/notes`, `/decks`, `/decks/:slug`. Новые `/schedule` и `/tasks` будут глобальными.

## Существующие компоненты (переиспользовать)

- `KebabMenu` — выпадающее меню «…»
- `ConfirmDialog` — модальное подтверждение (без `window.confirm`)
- `SaveIndicator` — индикатор автосохранения
- `LoadingState` — полноэкранный лоадер (временно, до Skeleton)
- `ErrorBanner` — баннер ошибки
- `SlashMenu` — слэш-меню Tiptap (не трогать)

## Навигация

- `GlobalSidebar.tsx`: логотип, переключатель семестра (кнопка с иконкой `Calendar`), поиск, пункты «Рабочий стол», «Все заметки», «Карточки», «Экзамены», дерево курсов, профиль.
- **Нет** пункта «Календарь» — `Calendar`-иконка занята кнопкой семестра.
- Мобильной нижней панели вкладок **нет** — создавать с нуля.
- Текущие медиа-запросы: только `max-width: 1180px` и `max-width: 560px`.

## Тестирование

Playwright E2E в `apps/web/tests/`. Vitest **нет** — добавить как devDependency для unit-тестов чистых функций.

## Cloudflare Pages деплой

**Ручной**, без CI/CD и GitHub Actions. Папки `functions/` нет. Перед Релизом B нужно:
1. Настроить Git-интеграцию или прямой upload с папкой `apps/web` как root directory.
2. Добавить переменные окружения в Pages dashboard.

## Связь билет → лекция (секция 8)

`exam_tickets.sources` — multi-relation → lectures, max 999, уже в схеме. `updateTicket` в `examService.ts` умеет записывать `sources`. UI (поле в редакторе билета + плашка в лекции) не реализован. Новой миграции не нужно.
