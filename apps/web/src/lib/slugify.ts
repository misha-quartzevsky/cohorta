/**
 * ============================================
 *  slugify.ts — URL-friendly slug generator
 * ============================================
 *
 * Converts arbitrary text (mostly Cyrillic titles)
 * into lowercase latin slugs suitable for URLs:
 *
 *   "История Права" → "istoria-prava"
 *
 * Also provides `uniqueSlug` to append a numeric
 * suffix when a slug is already taken
 * (e.g. "filosofia" → "filosofia-1").
 */

/** Cyrillic → latin transliteration map. */
const TRANSLIT: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

/**
 * Transliterates Cyrillic, lowercases everything, replaces
 * any run of non [a-z0-9] characters with a single dash and
 * trims leading/trailing dashes.
 *
 * @param text — source string (course/lecture title)
 * @returns lowercase latin slug, or "" when nothing usable remains
 */
export function slugify(text: string): string {
  const lower = text.trim().toLowerCase();
  let out = "";
  for (const ch of lower) {
    out += TRANSLIT[ch] ?? ch;
  }
  return out
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Returns `base` if it is free, otherwise appends the smallest
 * numeric suffix that is not taken: `base-1`, `base-2`, …
 *
 * @param base  — desired slug (already slugified)
 * @param taken — slugs that are already occupied
 * @returns a unique slug
 */
export function uniqueSlug(
  base: string,
  taken: ReadonlySet<string> | string[]
): string {
  const occupied = taken instanceof Set ? taken : new Set(taken);
  if (!occupied.has(base)) return base;
  let i = 1;
  while (occupied.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
