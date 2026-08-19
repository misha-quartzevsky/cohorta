/**
 * ============================================
 *  ScrollBar.tsx — JS-drawn scrollbar for inner containers
 * ============================================
 *
 * The host container keeps scrolling natively (wheel/keyboard/programmatic),
 * but its native thumb is hidden via CSS. This component renders a slim,
 * rounded, semi-transparent pill that mirrors the container's scroll progress.
 *
 * Usage: give the scroll container a `ref` and render this as a SIBLING inside
 * it (the host must be `position: relative/fixed/sticky`):
 *
 *   <div ref={ref} className="some-scrollable">
 *     {...content}
 *     <ScrollBar scrollRef={ref} />
 *   </div>
 *
 * Appearance is identical in Chrome, Edge, Safari and Firefox.
 */

import { useEffect, useRef, type CSSProperties, type RefObject } from "react";

interface ScrollBarProps {
  /** Ref to the scroll container this bar mirrors. */
  scrollRef: RefObject<HTMLElement | null>;
  /** Optional inline style for the bar (e.g. to inset it from edges). */
  style?: CSSProperties;
}

export default function ScrollBar({ scrollRef, style }: ScrollBarProps) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    const bar = barRef.current;
    const thumb = thumbRef.current;
    if (!el || !bar || !thumb) return;

    let raf = 0;

    const paint = () => {
      const scrollable = el.scrollHeight - el.clientHeight;
      const trackH = bar.clientHeight;
      if (scrollable <= 0) {
        thumb.style.opacity = "0";
        raf = 0;
        return;
      }
      const thumbH = Math.max(24, (el.clientHeight / el.scrollHeight) * trackH);
      const top = (el.scrollTop / scrollable) * (trackH - thumbH);
      thumb.style.height = `${thumbH}px`;
      thumb.style.transform = `translateY(${top}px)`;
      thumb.style.opacity = "0.6";
      // The bar is a child of the scroll container, so it naturally scrolls
      // away with the content. Counter the scroll offset so it stays pinned to
      // the visible viewport's right edge.
      bar.style.transform = `translateY(${el.scrollTop}px)`;
      raf = 0;
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };

    el.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    let mo: MutationObserver | undefined;
    let ro: ResizeObserver | undefined;
    if (typeof MutationObserver !== "undefined") {
      mo = new MutationObserver(schedule);
      mo.observe(el, { childList: true, subtree: true, characterData: true });
    }
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(schedule);
      ro.observe(el);
    }

    paint();

    return () => {
      el.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      mo?.disconnect();
      ro?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrollRef]);

  return (
    <div ref={barRef} className="scroll-bar" style={style}>
      <div ref={thumbRef} className="scroll-bar-thumb" />
    </div>
  );
}

