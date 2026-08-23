/**
 * ============================================
 *  courseGradient.ts — цвет курса по DESIGN.md §1.2
 * ============================================
 *
 * Единственная точка, которая превращает курс в градиент. Палитра курируемая:
 * ровно шесть градиентов на одной насыщенности, чтобы соседние карточки не
 * спорили друг с другом.
 *
 * Легаси-записи в базе хранят произвольный hex (старый color-picker давал
 * пять случайных цветов вне палитры). Такой цвет НЕ рисуется как есть —
 * он «примагничивается» к ближайшему пресету: экран остаётся в системе без
 * миграции данных.
 */

/** Курируемая палитра: [тёмный конец, светлый конец]. */
export const COURSE_GRADIENTS: ReadonlyArray<readonly [string, string]> = [
  ["#5843F6", "#B5CBFA"], // violet (brand)
  ["#FF6B4A", "#FFB199"], // coral
  ["#2F80ED", "#A5D8FF"], // blue
  ["#C239B3", "#F4A6E0"], // magenta
  ["#0F9D77", "#A8E6C9"], // green
  ["#F5A623", "#FFE1A8"], // amber
];

/** hex → [r, g, b]; null для мусора. */
function rgb(hex: string): [number, number, number] | null {
  let h = hex.trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Тон в градусах (0–360) и насыщенность (0–1). */
function hue(color: string): { h: number; s: number } | null {
  const c = rgb(color);
  if (!c) return null;
  const [r, g, b] = c.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return { h: 0, s: 0 };
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : d / max };
}

/**
 * Индекс ближайшего пресета — по ТОНУ, а не по RGB-расстоянию.
 * RGB-метрика ошибалась на близких по светлоте цветах: сиреневый #9C8FE2 и
 * голубой #5199FC приезжали в один пресет, и два курса становились
 * одного цвета. Тон различает «семейство цвета» так же, как это делает глаз.
 */
function nearestPreset(color: string): number | null {
  const target = hue(color);
  if (!target) return null;
  // Почти серый цвет тоном не описывается — отдаём бренд-градиент.
  if (target.s < 0.12) return 0;
  let best = 0;
  let bestDist = Infinity;
  COURSE_GRADIENTS.forEach(([dark], i) => {
    const p = hue(dark);
    if (!p) return;
    const raw = Math.abs(p.h - target.h);
    const d = Math.min(raw, 360 - raw); // тон замкнут в круг
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

/**
 * CSS-градиент курса.
 *
 * @param color — цвет из базы (может быть пустым или вне палитры)
 * @param index — позиция в списке; используется, когда цвета нет
 */
export function courseGradient(color?: string, index: number = 0): string {
  const preset =
    (color ? nearestPreset(color) : null) ??
    Math.abs(index) % COURSE_GRADIENTS.length;
  const [dark, light] = COURSE_GRADIENTS[preset];
  return `linear-gradient(135deg, ${dark}, ${light})`;
}

/** Тёмный конец градиента — для точек-индикаторов и однотонных акцентов. */
export function courseAccent(color?: string, index: number = 0): string {
  const preset =
    (color ? nearestPreset(color) : null) ??
    Math.abs(index) % COURSE_GRADIENTS.length;
  return COURSE_GRADIENTS[preset][0];
}
