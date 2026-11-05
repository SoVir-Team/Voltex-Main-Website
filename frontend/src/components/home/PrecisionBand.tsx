"use client";

import { useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { PHOTOS_4K } from "@/lib/credits";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** A flat navy panel with the claim, beside a full-height 4K detail of an RF board that drifts against the scroll. */
export function PrecisionBand() {
  const root = useRef<HTMLElement>(null);
  const photo = PHOTOS_4K.rf;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          "[data-parallax]",
          { yPercent: -8 },
          { yPercent: 8, ease: "none", scrollTrigger: { trigger: root.current, start: "top bottom", end: "bottom top", scrub: true } },
        );
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} aria-labelledby="precision-title" className="grid bg-ink-deep text-on-ink lg:min-h-[88svh] lg:grid-cols-[5fr_7fr]">
      <div className="flex flex-col justify-end px-[clamp(1.25rem,3vw,2.5rem)] py-[clamp(4rem,9vw,7rem)]">
        <h2 id="precision-title" className="display text-[clamp(2.4rem,1.4rem+3.6vw,5rem)]">
          Precise to the trace.
        </h2>
        <p className="mt-6 max-w-[28rem] text-lead text-on-ink-muted">
          Trace widths, clearances and layer stack-ups decide whether a board works first time. We design them for the factory.
        </p>
        <p className="mt-10 text-small text-on-ink-muted">Gold microstrip traces on a radio-frequency receiver board</p>
      </div>
      <div className="relative min-h-[60svh] overflow-hidden">
        <div data-parallax className="absolute -inset-y-[10%] inset-x-0">
          <Image src={photo.src} alt={photo.alt} fill quality={85} sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover" />
        </div>
      </div>
    </section>
  );
}
