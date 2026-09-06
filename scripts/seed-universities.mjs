/**
 * seed-universities.mjs — автономный сид справочника `universities`.
 *
 * Источник правды — миграция `pocketbase/pb_migrations/1787641000_seed_universities.js`
 * (применяется на рестарте PB). Этот скрипт — для пополнения БЕЗ рестарта:
 * читает тот же `scripts/universities.json` и делает upsert по (name, city).
 *
 * Правила коллекции закрыты на запись, поэтому нужен суперюзер:
 *   PB_ADMIN_EMAIL=... PB_ADMIN_PASSWORD=... node scripts/seed-universities.mjs
 *
 * Переменные:
 *   PB_URL             — адрес PocketBase (по умолчанию http://127.0.0.1:8090)
 *   PB_ADMIN_EMAIL     — email суперюзера (обязательно)
 *   PB_ADMIN_PASSWORD  — пароль суперюзера (обязательно)
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import PocketBase from "pocketbase";

const PB_URL = process.env.PB_URL ?? "http://127.0.0.1:8090";
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error(
      "PB_ADMIN_EMAIL и PB_ADMIN_PASSWORD обязательны (запись в `universities` — только суперюзер)."
    );
    process.exit(1);
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const list = JSON.parse(await readFile(join(here, "universities.json"), "utf8"));

  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  await pb.collection("_superusers").authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

  let created = 0;
  let skipped = 0;
  for (const uni of list) {
    const existing = await pb.collection("universities").getFullList({
      filter: pb.filter("name = {:name} && city = {:city}", uni),
      fields: "id",
    });
    if (existing.length > 0) {
      skipped += 1;
      continue;
    }
    await pb.collection("universities").create({ name: uni.name, city: uni.city });
    created += 1;
  }

  console.log(`universities: ${created} создано, ${skipped} уже было (всего ${list.length}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
