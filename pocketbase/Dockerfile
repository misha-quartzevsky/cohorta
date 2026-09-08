# ============================================================
#  PocketBase для Amvera (или любого Docker-хостинга)
# ============================================================
#
#  Кладёт в образ бинарь PocketBase + ВСЕ миграции (pb_migrations/)
#  и хуки (pb_hooks/). При старте PB сам накатывает все pending-
#  миграции — так на чистом инстансе создаётся вся схема
#  (courses, lectures, semesters, groups, universities, …) и
#  прогоняются сиды.
#
#  Данные (pb_data) лежат в /data — это персистентный том Amvera.
#  Порт 8080 — стандартный containerPort Amvera.
#
#  Локальная проверка:
#    docker build -t cohorta-pb ./pocketbase
#    docker run -p 8080:8080 -v $(pwd)/pb_data_docker:/data cohorta-pb
#    open http://127.0.0.1:8080/_/
# ============================================================

FROM alpine:3.20

ARG PB_VERSION=0.25.9

RUN apk add --no-cache ca-certificates unzip wget \
  && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" -O /tmp/pb.zip \
  && unzip /tmp/pb.zip -d /app \
  && rm /tmp/pb.zip \
  && apk del unzip wget

WORKDIR /app

# Миграции и хуки — из репозитория. Меняются часто, поэтому в самом низу.
COPY pb_migrations/ /app/pb_migrations/
COPY pb_hooks/ /app/pb_hooks/

EXPOSE 8080

# --dir указывает и на pb_data, и на pb_migrations/pb_hooks относительно себя,
# поэтому задаём их явно, чтобы данные жили в персистентном /data, а
# миграции/хуки — в образе.
CMD ["/app/pocketbase", "serve", \
     "--http=0.0.0.0:8080", \
     "--dir=/data/pb_data", \
     "--migrationsDir=/app/pb_migrations", \
     "--hooksDir=/app/pb_hooks"]
