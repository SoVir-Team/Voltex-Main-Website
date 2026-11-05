"use client";

import { useEffect, useRef, type ElementType, type ReactNode, type CSSProperties } from "react";

/**
 * Staggered entrance for the parts of a section. Children marked with data-reveal rise and fade in once as the
 * section enters the viewport. Without JS, or with reduced motion, content is simply visible (see globals.css).
 */
export function Reveal({ as: Tag = "div", className, children, style }: { as?: ElementType; className?: string; children: ReactNode; style?: CSSProperties }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    items.forEach((el, i) => el.style.setProperty("--reveal-i", String(i % 8)));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={className} style={style}>
      {children}
    </Tag>
  );
}
