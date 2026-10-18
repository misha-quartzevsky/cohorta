# Дизайн cohorta: материалы для Claude Code

Собрано 18 октября 2026. Всё, что нужно, чтобы обновить продукт по новому дизайну.

## С чего начать

Читать `instructions/migration-instruction-for-claude-code.md`. Это главный документ: порядок работ (волны A–D), правила, что считается «готово». Остальное его дополняет.

Если документы расходятся, побеждает тот, что выше в списке:

1. `instructions/brand-color-2026-10-18.md` и `instructions/logo-usage-rules.md`: цвет, логотип, название.
2. `design-system/`: токены (`tokens.json`, `tokens.css`), компоненты (`components/bundle.css` и README у каждого), иконки, словарь.
3. `screens/` и `screens-png/`: макеты 59 экранов.
4. `ia/`: информационная архитектура (карта, объекты, навигация, сценарии, доступ, словарь).
5. `instructions/ia-decisions-2026-10-18.md`, `subject-cover-generator.md`, `spec-schedule-tasks-quiz.md`.

## Что где лежит

| папка | что |
|---|---|
| `instructions/` | инструкция и решения (markdown) |
| `design-system/` | токены, CSS компонентов, README компонентов, иконки, словарь. `tokens.css` собран из `tokens.json`, значения не править руками |
| `screens/` | 59 макетов в HTML, по одному файлу на экран, открываются в браузере. `Screen-m-…` и `Foundation-mobile` это телефон 390 px, остальные десктоп 1440 px. Стили в макетах заданы прямо в атрибутах: разметку не копировать, брать токены и компоненты |
| `screens-png/` | те же экраны скриншотами, чтобы смотреть как картинки |
| `ia/` | 6 досок информационной архитектуры |

## Что учесть

- Раздел 1A.2–1A.7 в `spec-schedule-tasks-quiz.md` устарел (цвета, шрифты). Список устаревшего в разделе 1 инструкции. Пути вида `docs/design/Home-daily.dc.html` в спецификации теперь читать как `docs/design/screens/…`; старые экраны вроде `Home-daily` заменены на `Screen-dashboard`.
- Файлов логотипа здесь нет. Архив `cohorta-logo-kit.zip` лежит в корне в `public/brand/` (см. раздел 2.2 инструкции). Без него логотип не рисовать.
- Тёмной темы нет, она отложена.

## Первое сообщение для Claude Code

> Прочитай docs/design/README.md и docs/design/instructions/migration-instruction-for-claude-code.md. Начни с волны A0 (разведка): ничего не меняй, запиши результат в docs/recon-cohorta-ui.md и покажи мне.
