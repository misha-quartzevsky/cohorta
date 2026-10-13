# Деплой PocketBase на голый VPS (reg.ru и аналоги)

В отличие от Amvera (PaaS с git-деплоем), reg.ru Cloud/VPS даёт просто
сервер — Docker и всё остальное настраиваете сами. Ниже — минимальный
путь через `docker-compose.yml` + `Caddyfile` из этого каталога
(автоматический HTTPS, без ручной возни с сертификатами).

## 0. Что понадобится

- VPS на reg.ru с Ubuntu/Debian (минимально: 1 vCPU / 1-2 ГБ RAM —
  PocketBase лёгкий; берите с запасом под рост).
- Домен/поддомен, A-запись которого указывает на IP VPS —
  например `api.cohorta.ru`. Купить домен можно там же на reg.ru.
- SSH-доступ к серверу.

## 1. Поднять Docker на сервере

```bash
ssh root@<IP_VPS>
curl -fsSL https://get.docker.com | sh
```

## 2. Залить код

Самый простой способ — клонировать репозиторий целиком (или только
скопировать каталог `pocketbase/`):

```bash
git clone https://github.com/misha-quartzevsky/cohorta.git
cd cohorta/pocketbase
```

## 3. Настроить домен

Открыть `Caddyfile` и заменить `api.cohorta.ru` на свой домен/поддомен.
Убедиться, что его A-запись уже смотрит на IP этого VPS (иначе Let's
Encrypt не выпустит сертификат).

## 4. Запустить

```bash
docker compose up -d --build
```

При старте PocketBase сам накатит ВСЮ цепочку `pb_migrations/`
(создаст `courses`/`lectures`/`semesters`/`groups`/`universities`/…,
засеет справочник вузов). Caddy сам получит HTTPS-сертификат на
указанный домен — через 10-20 секунд сайт должен открыться по
`https://ваш-домен/_/` (админка PocketBase).

Проверка:
```bash
curl https://ваш-домен/api/health
curl https://ваш-домен/api/collections/universities/records?perPage=1
```

## 5. Создать суперюзера

```bash
docker compose exec pocketbase /app/pocketbase superuser create you@example.com "пароль-посложнее"
```

## 6. Прописать фронтенду новый адрес

Cloudflare Pages → проект → Settings → Environment variables:

```
VITE_PB_URL = https://ваш-домен
```

→ Retry deployment.

## Обновления в будущем

- Новый код/миграции: `git pull && docker compose up -d --build`
  (данные в томе `pb_data` не теряются).
- Бэкапы: папка тома `pb_data` — это весь `pb_data/` PocketBase
  (SQLite + загруженные файлы). Регулярно снимайте снапшот диска VPS
  в панели reg.ru, либо `docker compose exec pocketbase tar czf -
  -C /data pb_data > backup.tar.gz` и скачивайте наружу.
- Пополнение справочника вузов без передеплоя — см. корень
  [DEPLOY.md](./DEPLOY.md) (`scripts/seed-universities.mjs`).
