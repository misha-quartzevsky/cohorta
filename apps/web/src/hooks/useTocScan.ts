import { useEffect, useRef, useState } from "react";

export interface ScannedTocItem {
  level: number;
  text: string;
  el: HTMLElement;
}

/**
 * Сканирует h1–h3 внутри `containerRef`, подсвечивает раздел во вьюпорте,
 * прокручивает к заголовку по клику. Вынесено из TableOfContents.tsx —
 * общая логика для старого сайдбара (components/TableOfContents.tsx) и
 * новой левой колонки редактора (ui/LectureToc, B1).
 */
export function useTocScan(
  containerRef: { current: HTMLElement | null },
  version: unknown
) {
  const [items, setItems] = useState<ScannedTocItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const observerRef = useRef<IntersectionObserver | null>(null);

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

    const ensureAttached = () => {
      const container = containerRef.current;
      if (!container || disposed) return;
      if (attachedEl === container) return;
      observer?.disconnect();
      observer = new MutationObserver(schedule);
      observer.observe(container, { childList: true, subtree: true });
      attachedEl = container;
      schedule();
    };

    ensureAttached();
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
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActiveIndex(items.findIndex((item) => item.el === visible[0].target));
        }
      },
      { rootMargin: "-64px 0px -70% 0px", threshold: 0 }
    );
    items.forEach((item) => observer.observe(item.el));
    observerRef.current = observer;
    return () => observer.disconnect();
  }, [items]);

  const scrollTo = (item: ScannedTocItem) => {
    item.el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return { items, activeIndex, scrollTo };
}
