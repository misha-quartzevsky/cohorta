/**
 * ============================================
 *  TableOfContents.tsx — live document outline
 * ============================================
 *
 * Scans h1–h3 inside the content container, highlights the
 * section currently in view and smooth-scrolls on click.
 */

import { useEffect, useRef, useState } from "react";

interface TocItem {
  level: number;
  text: string;
  el: HTMLElement;
}

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
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Re-scan headings (slightly debounced — `version` changes on every
  // keystroke while editing).
  //
  // The shared `containerRef.current` is a MUTABLE ref that is reassigned to a
  // NEW node on view↔edit switches and SPA lecture navigation — usually WITHOUT
  // a matching `version` bump (the sidebar TOC passes an almost-constant
  // `tocVersion`). A MutationObserver attached to the OLD node would therefore
  // stay silent and the outline would freeze. So we keep a lightweight poll
  // that re-attaches the observer whenever the ref's node *identity* changes.
  useEffect(() => {
    let disposed = false;
    let attachedEl: HTMLElement | null = null;
    let observer: MutationObserver | null = null;
    let timer = 0;
    let poll = 0;

    const scan = () => {
      const container = containerRef.current;
      if (!container || disposed) return;
      const headings = Array.from(
        container.querySelectorAll<HTMLElement>("h1, h2, h3")
      );
      setItems(
        headings.map((el) => ({
          level: Number(el.tagName.charAt(1)),
          text: el.textContent?.trim() || "",
          el,
        }))
      );
    };

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(scan, 150);
    };

    // Watch whatever node the ref currently points to. When the container isn't
    // mounted yet (content loads async) this is a no-op; when the ref later
    // points at a DIFFERENT node we detach from the old one and re-attach.
    const ensureAttached = () => {
      const container = containerRef.current;
      if (!container || disposed) return;
      if (attachedEl === container) return; // already watching this node
      observer?.disconnect();
      observer = new MutationObserver(schedule);
      observer.observe(container, { childList: true, subtree: true });
      attachedEl = container;
      schedule();
    };

    ensureAttached();

    // Poll the ref: covers both "container mounts late" and "container replaced"
    // (no version change) without depending on a `version` bump.
    poll = window.setInterval(() => {
      if (disposed) return;
      ensureAttached();
    }, 150);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      window.clearInterval(poll);
      observer?.disconnect();
    };
  }, [containerRef, version]);

  // Scroll-spy: highlight the heading currently in view.
  useEffect(() => {
    observerRef.current?.disconnect();
    if (items.length === 0) {
      setActiveIndex(-1);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top
          );
        if (visible[0]) {
          setActiveIndex(
            items.findIndex((item) => item.el === visible[0].target)
          );
        }
      },
      { rootMargin: "-64px 0px -70% 0px", threshold: 0 }
    );
    items.forEach((item) => observer.observe(item.el));
    observerRef.current = observer;
    return () => observer.disconnect();
  }, [items]);

  const scrollTo = (item: TocItem) => {
    item.el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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