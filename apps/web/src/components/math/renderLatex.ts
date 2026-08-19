/**
 * ============================================
 *  renderLatex.ts — MathLive static render
 * ============================================
 *
 * Renders LaTeX formulas using MathLive's `<math-div>` custom element.
 * The element renders math lazily via IntersectionObserver and doesn't touch DOM.
 *
 * Called by LectureView (post-process content) and MathBlockView (NodeView).
 *
 * ВАЖНО: импортировать `mathlive/static.css` в main.tsx (стили `.ML__*`).
 */

/**
 * Вставляет формулу через `<math-div>` MathLive (заменяя содержимое контейнера).
 * Асинхронная: ждёт регистрации кастомного элемента `math-div` и повторно
 * пере-рендерит после `document.fonts.ready` (иначе формула может отрисоваться
 * с нулевой метрикой до загрузки KaTeX-шрифтов).
 */
export async function renderLatexInto(
  container: HTMLElement,
  latex: string
): Promise<void> {
  const value = (latex || "").trim();
  if (!value) return;

  try {
    // Кастомный элемент `math-div` регистрируется mathlive. На самом первом
    // рендере он может оказаться ещё не готовым (особенно при hard-reload,
    // когда модули отдаются из кеша service worker). Ждём его регистрации,
    // но не бесконечно: если через 1.5 с элемент так и не определился,
    // создаём `<math-div>` как обычный элемент — когда mathlive зарегистрирует
    // его, браузер автоматически «апгрейднет» уже существующий узел.
    if (!window.customElements.get("math-div")) {
      await Promise.race([
        window.customElements.whenDefined("math-div"),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
    }

        const renderOnce = () => {
      if (!container.isConnected) return;
      // Идемпотентность: если формула с тем же LaTeX уже отрендерена
      // (например, при повторном запуске эффекта/observer/retry), не трогаем.
      const existing = container.querySelector("math-div.math-render");
      if (existing && existing.textContent === value) return;

      container.innerHTML = "";
      const host = document.createElement("math-div");
      (host as unknown as { textContent: string }).textContent = value;
      host.className = "math-render";
      container.appendChild(host);
    };

    renderOnce();

    // KaTeX-шрифты могут грузиться после первого рендера — формула могла бы
    // отрисоваться с нулевой метрикой. Пере-рендерим после загрузки шрифтов.
    if (typeof document !== "undefined" && "fonts" in document) {
      try {
        await document.fonts.ready;
      } catch {
        // FontFaceSet.load может отклониться в некоторых окружениях — это
        // не критично, формула уже отрендерена выше.
      }
      renderOnce();
    }
  } catch (error) {
    console.warn("[renderLatex] failed to render math:", latex, error);
  }
}
