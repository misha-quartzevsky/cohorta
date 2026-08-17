# Cohorta

Локальная разработка edtech PWA для записи и хранения лекций.

## Что уже есть

- **Frontend:** Vite + React + TypeScript (`apps/web`)
- **Backend:** PocketBase — один бинарник, auth + БД + файлы, без Docker
- Всё крутится на твоём компьютере, **0 ₽**

## Требования

- Node.js 20+ (у тебя уже установлен)
- PowerShell (Windows)

Docker **не нужен**.

## Быстрый старт

### 1. Установить PocketBase (один раз)

```powershell
cd C:\Users\Rita\Projects\cohorta
npm run setup:pocketbase
```

### 2. Запустить backend (терминал 1)

```powershell
npm run pocketbase
```

При первом запуске открой http://127.0.0.1:8090/_/ и создай admin-аккаунт.

### 3. Запустить frontend (терминал 2)

```powershell
npm run dev
```

Открой http://localhost:5173 — если PocketBase запущен, увидишь зелёный статус.

## Структура проекта

```
cohorta/
├── apps/web/          # React PWA (интерфейс)
├── pocketbase/        # backend (exe + данные, не в git)
├── scripts/           # скрипты установки и запуска
└── package.json       # команды из корня
```

## PocketBase: коллекции для фазы 1

Создай в админке (http://127.0.0.1:8090/_/) вручную:

**courses**
| Поле | Тип |
|------|-----|
| name | Text |
| color | Text (опционально) |

**lectures**
| Поле | Тип |
|------|-----|
| title | Text |
| course | Relation → courses |
| notes | Text |
| audio | File (mp3, webm, m4a) |
| file | File (pdf, doc, ppt) |

Правила доступа на старте: только авторизованный пользователь видит свои записи.

## Когда будешь готов к релизу

Локальный стек **переносится 1:1** на VPS в РФ:

1. Тот же `pocketbase serve` на сервере
2. `npm run build` → статика на nginx или CDN
3. Домен + SSL
4. Политика ПДн и уведомление в РКН

Менять стек не придётся — только место, где крутится бинарник.

## Полезные команды

| Команда | Что делает |
|---------|------------|
| `npm run dev` | Frontend на :5173 |
| `npm run pocketbase` | Backend на :8090 |
| `npm run build` | Сборка для продакшена |
| `npm run setup:pocketbase` | Скачать PocketBase |
