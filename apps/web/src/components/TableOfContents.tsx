/**
 * ============================================
 *  TableOfContents.tsx — live document outline
 * ============================================
 *
 * Scans h1–h3 inside the content container, highlights the
 * section currently in view and smooth-scrolls on click.
 */

import { useTocScan } from "../hooks/useTocScan";

interface Props {
  containerRef: { current: HTMLElement | null };
  /** Any change (e.g. editor content) triggers a re-scan. */
  version: unknown;
  /** Hide the built-in "Оглавление" title (e.g. when embedded in a
   *  section of GlobalSidebar that already renders its own heading). */
  hideTitle?: boolean;
}

export default function TableOfContents({
  containerRef,
  version,
  hideTitle = false,
}: Props) {
  const { items, activeIndex, scrollTo } = useTocScan(containerRef, version);

  return (
    <nav className="toc">
      {!hideTitle && <p className="toc-title">Оглавление</p>}
      {items.length === 0 ? (
        <p className="toc-empty">Заголовков пока нет</p>
      ) : (
        <ul className="toc-list">
          {items.map((item, index) => (
            <li key={`${item.level}-${item.text}-${index}`}>
              <button
                type="button"
                className={`toc-item lvl-${item.level}${
                  index === activeIndex ? " active" : ""
                }`}
                onClick={() => scrollTo(item)}
              >
                {item.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}