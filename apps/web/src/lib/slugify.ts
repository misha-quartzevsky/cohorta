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
 *
 * Slugs share the URL namespace with static route
 * segments, so `RESERVED_SLUGS` keeps a record from
 * claiming a word the router already owns.
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
 * Words the router owns, so no record may take them as a slug.
 *
 * A slug sits in the same URL position as a static segment:
 * `/s/:sem/:course/exam` and `/s/:sem/:course/:lectureSlug`
 * are the same shape, and React Router ranks the static one
 * higher. A lecture slugged "exam" would therefore exist but
 * be unreachable forever. Same for a course slugged "courses",
 * which collides with `/s/:sem/courses`.
 *
 * Cyrillic titles are safe — «Экзамен» transliterates to
 * "ekzamen". Only a latin title can hit this.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "exam",
  "exams",
  "cheatsheet",
  "import",
  "courses",
  "decks",
  "notes",
  "note",
  "group",
  "login",
  "new",
  "edit",
  "s",
]);

/**
 * Returns `base` if it is free, otherwise appends the smallest
 * numeric suffix that is not taken: `base-1`, `base-2`, …
 *
 * Reserved words count as taken, so a lecture titled "Exam"
 * becomes "exam-1" instead of shadowing the exam route.
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
  const isFree = (s: string) => !occupied.has(s) && !RESERVED_SLUGS.has(s);
  if (isFree(base)) return base;
  let i = 1;
  while (!isFree(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
