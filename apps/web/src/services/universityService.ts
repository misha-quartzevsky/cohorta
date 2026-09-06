/**
 * ============================================
 *  universityService.ts — Universities directory
 * ============================================
 *
 * Справочник вузов для онбординга (коллекция `universities`,
 * read-only для обычных пользователей). Каскадные поля экрана 2:
 * сначала выбираем город из `DISTINCT city`, затем вуз внутри города.
 */

import { pb } from "../lib/pocketbase";
import type { University } from "../lib/types";
import { FIELDS } from "../lib/types";
import { withTimeout } from "../lib/withTimeout";

/** Загрузить весь справочник (объём небольшой — десятки строк). */
async function fetchAll(): Promise<University[]> {
  return withTimeout(
    pb
      .collection("universities")
      .getFullList<University>({ sort: `${FIELDS.universityCity},${FIELDS.universityName}` }),
    "справочник вузов"
  );
}

/** Уникальные города из справочника, отсортированные по алфавиту. */
export async function fetchCities(): Promise<string[]> {
  const rows = await fetchAll();
  const seen = new Set<string>();
  for (const row of rows) {
    const city = String(row.city ?? "").trim();
    if (city) seen.add(city);
  }
  return [...seen].sort((a, b) => a.localeCompare(b, "ru"));
}

/** Вузы выбранного города. */
export async function fetchUniversitiesByCity(city: string): Promise<University[]> {
  const value = city.trim();
  if (!value) return [];
  return withTimeout(
    pb.collection("universities").getFullList<University>({
      filter: pb.filter(`${FIELDS.universityCity} = {:city}`, { city: value }),
      sort: FIELDS.universityName,
    }),
    "список вузов города"
  );
}
