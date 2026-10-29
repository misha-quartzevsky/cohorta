# Заголовки безопасности фронтенда

Аудит безопасности 2026-10, находка C-6 / D-8. Эти заголовки нужны на каждой странице фронтенда (apps/web). На Cloudflare Pages их отдаёт файл `dist/_headers`, который собирает `npm run build`. Если фронтенд переезжает на nginx или Apache, нужно повторить те же значения в конфиге сервера: `_headers` работает только на Cloudflare Pages.

Единый источник значений: [apps/web/security-headers.ts](../../apps/web/security-headers.ts). Если политика меняется, правят этот файл, затем сборку и конфиги ниже.

## Что и зачем

| Заголовок | Значение | Что закрывает |
|---|---|---|
| `Content-Security-Policy` | см. ниже | Исполнение чужого скрипта, вывод токена на сторонний сайт, подмена форм, встраивание в чужую страницу |
| `X-Frame-Options` | `DENY` | Показ приложения во фрейме чужого сайта (clickjacking); дублирует `frame-ancestors 'none'` для старых браузеров |
| `X-Content-Type-Options` | `nosniff` | Угадывание типа файла браузером |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Утечка адресов страниц (с id лекций и групп) на внешние сайты |
| `Permissions-Policy` | `microphone=(self), camera=(), geolocation=(), payment=(), usb=()` | Доступ к устройствам; микрофон нужен только самому приложению (запись лекции) |

## Content-Security-Policy

Подставьте вместо `PB_ORIGIN` адрес PocketBase **без пути** (например `https://api.example.com`). Если API отдаётся с того же адреса, что и фронтенд, уберите `PB_ORIGIN` из трёх мест.

```
default-src 'self';
script-src 'self' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: PB_ORIGIN;
media-src 'self' blob: PB_ORIGIN;
font-src 'self' data:;
connect-src 'self' PB_ORIGIN;
worker-src 'self' blob:;
manifest-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none'
```

Почему именно так:

- **Скрипты без `'unsafe-inline'` и без `'unsafe-eval'`.** Это главная защита от хранимого XSS. Приложение не использует inline-скрипты и `eval`.
- **`'wasm-unsafe-eval'`**: Excalidraw собирает подмножества шрифтов через WebAssembly. Это не `eval`, исполнять строки как код политика по-прежнему не позволяет.
- **`style-src 'unsafe-inline'`**: React ставит атрибуты `style` у многих компонентов, Tiptap, Excalidraw и MathLive добавляют стили в рантайме. Убрать это без переписывания интерфейса нельзя. Риск ограничен: CSS не выполняет код, а скрипты закрыты.
- **`img-src data: blob:`**: картинки из буфера обмена (`data:`) и предпросмотр загрузки (`blob:`).
- **`media-src blob:`**: аудиозаписи лекций.
- **`font-src`**: все шрифты свои (`@fontsource`, MathLive, `public/excalidraw-fonts`). Excalidraw к каждому шрифту добавляет запасной адрес на `https://esm.sh`; политика его не пускает, и в консоли при открытии схемы появляются сообщения о блокировке. На работу не влияет (шрифты берутся локальные). Если сообщения мешают, есть два пути: разрешить `https://esm.sh` в `font-src` (сторонний хост, только шрифты) или положить недостающие файлы (CJK-шрифт Xiaolai, 13 МБ) в `apps/web/public/excalidraw-fonts/fonts/`.

## Cloudflare Pages

Ничего настраивать не нужно: `npm run build` кладёт `dist/_headers` из `VITE_PB_URL` (или `VITE_POCKETBASE_URL`), который задан для сборки. Проверка после выкатки: `curl -sI https://<домен>/ | grep -i -E "content-security|x-frame|nosniff|referrer|permissions"`.

Запасной вариант, если плагин сборки по какой-то причине не сработал: положить файл `apps/web/public/_headers` с тем же содержимым вручную (формат: строка `/*`, ниже заголовки с отступом в два пробела).

Заголовки из `_headers` не применяются к ответам Pages Functions (`/api/quiz/generate`): они возвращают JSON и не открываются как страницы.

## nginx

Фронтенд отдаётся как набор статических файлов, неизвестные пути возвращают `index.html` (SPA).

```nginx
server {
    listen 443 ssl;
    server_name app.example.com;
    root /var/www/cohorta;            # содержимое apps/web/dist
    index index.html;

    # Заголовки повторяются в каждом location, где есть свой add_header:
    # директива add_header в location отменяет унаследованные. Здесь один location.
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://api.example.com; media-src 'self' blob: https://api.example.com; font-src 'self' data:; connect-src 'self' https://api.example.com; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "microphone=(self), camera=(), geolocation=(), payment=(), usb=()" always;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Сборка Vite кладёт файлы с хэшем в имени: их можно кешировать надолго.
    # Если здесь добавляется свой add_header (Cache-Control), повторите в этом блоке все заголовки выше.
    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://api.example.com; media-src 'self' blob: https://api.example.com; font-src 'self' data:; connect-src 'self' https://api.example.com; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" always;
        add_header X-Content-Type-Options "nosniff" always;
    }
}
```

Проверка конфига: `nginx -t`, затем `curl -sI https://app.example.com/ | grep -i -E "content-security|x-frame|nosniff|referrer|permissions"`.

## Apache (mod_headers, mod_rewrite)

```apache
<VirtualHost *:443>
    ServerName app.example.com
    DocumentRoot /var/www/cohorta

    <Directory /var/www/cohorta>
        Require all granted
        # SPA: неизвестные пути возвращают index.html
        RewriteEngine On
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule ^ /index.html [L]
    </Directory>

    Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://api.example.com; media-src 'self' blob: https://api.example.com; font-src 'self' data:; connect-src 'self' https://api.example.com; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
    Header always set X-Frame-Options "DENY"
    Header always set X-Content-Type-Options "nosniff"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    Header always set Permissions-Policy "microphone=(self), camera=(), geolocation=(), payment=(), usb=()"
</VirtualHost>
```

Проверка: `apachectl configtest`, затем тот же `curl -sI`.

## Как проверить политику в браузере

1. Собрать фронтенд с адресом тестового PocketBase: `VITE_PB_URL=http://127.0.0.1:8091 VITE_POCKETBASE_URL=http://127.0.0.1:8091 npx vite build --outDir dist/csp-check`.
2. Раздать сборку вместе с `_headers`: `node scripts/dev/serve-dist.mjs dist/csp-check 5176`.
3. Прогнать `CSP_BASE_URL=http://localhost:5176 PB_URL=http://127.0.0.1:8091 npx playwright test tests/security-csp.spec.ts` (23 экрана, редактор с формулой MathLive, схема Excalidraw, загрузка картинки, квиз: ноль нарушений CSP, кроме запасных адресов шрифтов Excalidraw на esm.sh, см. выше).

`vite preview` для проверки не годится, если в среде стоят расширения, дописывающие скрипт в HTML (например Console Ninja): их inline-скрипт блокирует политика, и тест видит чужое нарушение.

## Что делать при изменениях

- Новый внешний сервис (аналитика, шрифты, платёжный виджет): добавить его адрес в нужную директиву в `security-headers.ts` и в конфиги выше, не ослаблять `script-src` и `default-src`.
- Перенос PocketBase на другой адрес: поменять `VITE_PB_URL` на сборке (для Cloudflare Pages `_headers` перегенерируется сам) и `PB_ORIGIN` в nginx/Apache.
- Режим `npm run dev:https` (прокси через Vite) проверяется без CSP: dev-сервер заголовков не отдаёт.
