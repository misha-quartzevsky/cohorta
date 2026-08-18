/**
 * ============================================
 *  renderLatex.ts — статичный рендер LaTeX через `<math-div>`
 * ============================================
 *
 * Используется и в NodeView редактора, и при пост-обработке просмотра
 * лекции: создаёт кастомный элемент `<math-div>` MathLive и кладёт в него
 * LaTeX-код. Элемент рендерит математику лениво — по мере появления на
 * экране (IntersectionObserver) — и не трогает DOM ProseMirror.
 *
 * Хардфиксы (фаза 6):
 *  - ждём `document.fonts.ready` и пере-рендерим после загрузки шрифтов
 *    (могли отрисоваться с «нулевой» метрикой / невидимо в режиме чтения);
 *  - если `<math-div>` ещё не зарегистрирован — ждём `customElements.whenDefined`;
 *  - ошибки больше не глотаются молча — пишем warning в консоль.
 */

/** Дожидаемся готовности шрифтов документа (KaTeX подгрузился). */
function whenFontsReady(): Promise<unknown> {
  if (typeof document === "undefined" || !("fonts" in document)) {
    return Promise.resolve();
  }
  return Promise.resolve(document.fonts.ready).catch(() => undefined);
}

/** Вставляет отрисованную формулу внутрь `container` (заменяя содержимое). */
export async function renderLatexInto(
  container: HTMLElement,
  latex: string
): Promise<void> {
  const value = (latex || "").trim();
  container.innerHTML = "";
  if (!value) return;

  const host = document.createElement("math-div");
  (host as unknown as { textContent: string }).textContent = value;
  host.className = "math-render";
  container.appendChild(host);

  const render = () => {
    try {
      (host as unknown as { render?: () => void }).render?.();
    } catch (error) {
      console.warn("[renderLatex] render failed:", error);
    }
  };

  // Если кастомный элемент ещё не зарегистрирован — дожидаемся его,
  // прежде чем дергать ленивый рендер.
  const el = host as unknown as { render?: () => void };
  if (!el.render && typeof customElements !== "undefined") {
    try {
      await customElements.whenDefined("math-div");
    } catch {
      /* браузер без Custom Elements — рендерим как есть */
    }
  }

  // Принудительно запрашиваем ленивый рендер, если он не подхватился сам.
  render();

  // Если шрифты KaTeX ещё грузятся — пере-рендерим после `fonts.ready`.
  await whenFontsReady();
  render();
}
