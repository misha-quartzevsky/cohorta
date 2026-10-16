/**
 * Палитры обложек предметов (spec 1A.6) — единственное место градиента.
 * Три-четыре радиальных пятна по приглушённому базовому тону.
 * Ключ палитры хранится в данных (course.color), CSS не храним.
 * Если ключа нет — назначаем детерминированно по id.
 */

export const SUBJECT_PALETTES = {
  civil:
    "radial-gradient(circle at 25% 80%,rgba(232,96,28,.6),transparent 60%),radial-gradient(circle at 80% 20%,rgba(242,193,78,.85),transparent 55%),radial-gradient(circle at 75% 90%,rgba(217,165,184,.7),transparent 50%),#F6D9B8",
  mkt: "radial-gradient(circle at 20% 20%,rgba(240,138,93,.7),transparent 60%),radial-gradient(circle at 85% 70%,rgba(201,181,217,.7),transparent 55%),radial-gradient(circle at 50% 95%,rgba(245,201,168,.8),transparent 45%),#F7E3D3",
  stat: "radial-gradient(circle at 20% 70%,rgba(143,169,160,.75),transparent 60%),radial-gradient(circle at 80% 25%,rgba(242,217,139,.85),transparent 50%),radial-gradient(circle at 60% 90%,rgba(217,199,176,.8),transparent 45%),#E9E4D6",
  phil: "radial-gradient(circle at 30% 30%,rgba(127,163,199,.75),transparent 60%),radial-gradient(circle at 80% 80%,rgba(232,198,208,.8),transparent 55%),radial-gradient(circle at 90% 20%,rgba(244,226,184,.8),transparent 40%),#E4E9EE",
  /* Дополнительные четыре (spec: разные базовые тона, та же насыщенность) */
  green:
    "radial-gradient(circle at 25% 75%,rgba(126,176,132,.7),transparent 60%),radial-gradient(circle at 80% 25%,rgba(210,224,160,.8),transparent 55%),radial-gradient(circle at 70% 90%,rgba(190,210,185,.7),transparent 45%),#E2EADB",
  lilac:
    "radial-gradient(circle at 30% 30%,rgba(176,156,214,.7),transparent 60%),radial-gradient(circle at 80% 75%,rgba(224,196,220,.8),transparent 55%),radial-gradient(circle at 85% 20%,rgba(214,206,232,.7),transparent 45%),#E9E3EF",
  sand: "radial-gradient(circle at 25% 80%,rgba(224,186,140,.7),transparent 60%),radial-gradient(circle at 80% 30%,rgba(238,214,170,.85),transparent 55%),radial-gradient(circle at 60% 90%,rgba(220,200,172,.75),transparent 45%),#F0E6D5",
  sky: "radial-gradient(circle at 25% 70%,rgba(140,186,214,.7),transparent 60%),radial-gradient(circle at 80% 25%,rgba(196,222,236,.85),transparent 55%),radial-gradient(circle at 65% 90%,rgba(184,206,222,.7),transparent 45%),#E2EBF0",
} as const;

export type SubjectPaletteKey = keyof typeof SUBJECT_PALETTES;

const KEYS = Object.keys(SUBJECT_PALETTES) as SubjectPaletteKey[];

/** Детерминированный ключ палитры по id предмета. */
export function paletteForId(id: string): SubjectPaletteKey {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return KEYS[Math.abs(hash) % KEYS.length];
}

/**
 * Разрешить палитру: сохранённый ключ (если валиден), иначе по id.
 * Принимает «старое» значение course.color — если это ключ палитры, берём его.
 */
export function resolvePalette(
  id: string,
  stored?: string | null
): SubjectPaletteKey {
  if (stored && stored in SUBJECT_PALETTES) {
    return stored as SubjectPaletteKey;
  }
  return paletteForId(id);
}

export function paletteGradient(key: SubjectPaletteKey): string {
  return SUBJECT_PALETTES[key];
}
