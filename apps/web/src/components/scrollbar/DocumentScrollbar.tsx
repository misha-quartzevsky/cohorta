/**
 * ============================================
 *  DocumentScrollbar.tsx — JS-drawn main scrollbar
 * ============================================
 *
 * The document keeps scrolling with the NATIVE window scroll (so sticky
 * headers, `scrollIntoView`, IntersectionObserver-based TOC and `window.scrollTo`
 * all keep working unchanged). This component only overlays a slim rounded,
 * semi-transparent pill on the right edge of the viewport that mirrors the
 * window's scroll progress — identical look in Chrome, Edge, Safari, Firefox.
 */

import { useEffect, useRef } from "react";

export default function DocumentScrollbar() {
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const thumb = thumbRef.current;
    const track = trackRef.current;
    if (!thumb || !track) return;

    let raf = 0;

    const paint = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      const trackH = track.clientHeight;
      if (scrollable <= 0) {
        thumb.style.opacity = "0";
        track.classList.remove("active");
        raf = 0;
        return;
      }
      const thumbH = Math.max(24, (window.innerHeight / doc.scrollHeight) * trackH);
      const top = (window.scrollY / scrollable) * (trackH - thumbH);
      thumb.style.height = `${thumbH}px`;
      thumb.style.transform = `translateY(${top}px)`;
      thumb.style.opacity = "0.6";
      track.classList.add("active");
      raf = 0;
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // Re-paint when content grows/shrinks (renders, images loading, etc.).
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(schedule);
      ro.observe(document.body);
    }
    let mo: MutationObserver | undefined;
    if (typeof MutationObserver !== "undefined") {
      mo = new MutationObserver(schedule);
      mo.observe(document.body, { childList: true, subtree: true });
    }

    paint();

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      ro?.disconnect();
      mo?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={trackRef} className="doc-scroll-track">
      <div ref={thumbRef} className="doc-scroll-thumb" />
    </div>
  );
}
