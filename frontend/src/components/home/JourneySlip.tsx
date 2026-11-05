"use client";

import { useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { Reveal } from "@/components/motion/Reveal";
import { JOURNEY } from "@/lib/site";

const STARTS = [
  { label: "An idea", from: 0 },
  { label: "A design", from: 2 },
  { label: "A prototype", from: 3 },
] as const;

/**
 * The live thing on the page: tell us what you have, and the itinerary reprints from that point.
 * Printed as a work slip: the order is carried by the phases, the result by the inverted last row.
 */
export function JourneySlip() {
  const [start, setStart] = useState<number>(0);
  const from = STARTS[start].from;
  const phases = JOURNEY.slice(from);

  return (
    <Reveal as="section" aria-labelledby="journey-title" className="bg-ink">
      <div className="frame grid-12 section-gap items-start gap-y-14">
        <div className="col-span-12 text-on-ink lg:col-span-5">
          <h2 id="journey-title" data-reveal className="text-statement display">
            From idea to product
          </h2>
          <p data-reveal className="mt-8 max-w-[30rem] text-lead text-on-ink-muted">
            Anyone with an idea can come to VOLTEX. We design it, build it, make it work and manufacture it. Tell us
            where you are today.
          </p>
          <fieldset data-reveal className="mt-10">
            <legend className="text-[0.95rem] font-semibold text-on-ink">I already have</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {STARTS.map((s, i) => (
                <label
                  key={s.label}
                  className={clsx(
                    "cursor-pointer select-none px-5 py-3 text-[0.95rem] font-semibold transition-colors duration-150",
                    "has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-bolt",
                    start === i ? "bg-bolt text-ink-deep" : "bg-ink-deep text-on-ink hover:bg-[#25254d]",
                  )}
                >
                  <input type="radio" name="journey-start" className="sr-only" checked={start === i} onChange={() => setStart(i)} />
                  {s.label}
                </label>
              ))}
            </div>
          </fieldset>
          <p data-reveal className="mt-10">
            <Link href="/bring-your-idea" className="font-semibold text-bolt underline underline-offset-4 hover:text-on-ink">
              Start with a free consultation
            </Link>
          </p>
        </div>

        <div data-reveal className="col-span-12 lg:col-span-6 lg:col-start-7">
          <div
            className="mx-auto max-w-[30rem] bg-ground px-7 pt-8 pb-14 text-ink sm:px-9"
            style={{ clipPath: "polygon(0 0,100% 0,100% calc(100% - 14px),95% 100%,90% calc(100% - 14px),85% 100%,80% calc(100% - 14px),75% 100%,70% calc(100% - 14px),65% 100%,60% calc(100% - 14px),55% 100%,50% calc(100% - 14px),45% 100%,40% calc(100% - 14px),35% 100%,30% calc(100% - 14px),25% 100%,20% calc(100% - 14px),15% 100%,10% calc(100% - 14px),5% 100%,0 calc(100% - 14px))" }}
          >
            <p className="flex items-center justify-between text-[0.95rem]">
              <span className="font-bold">VOLTEX work slip</span>
              <span className="tabular text-muted">Typical timeline</span>
            </p>
            <div aria-live="polite">
              {phases.map((p) => (
                <div key={p.phase} className="mt-7">
                  <p className="font-bold">{p.phase}</p>
                  <ul className="mt-2 space-y-2">
                    {p.steps.map((s) => (
                      <li key={s.what} className="flex items-baseline gap-2 text-[1rem]">
                        <span>{s.what}</span>
                        <span aria-hidden className="mb-1 min-w-6 flex-1 border-b-[3px] border-dotted border-[#b8bdd6]" />
                        <span className="tabular whitespace-nowrap text-muted">{s.time}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="-mx-7 mt-8 flex min-h-11 items-center justify-between bg-ink px-7 font-semibold text-on-ink sm:-mx-9 sm:px-9">
              <span>Your product, manufactured</span>
              <span aria-hidden>→</span>
            </p>
            <p className="mt-4 text-small text-muted">
              Timelines are indicative and depend on complexity. We confirm yours after the first review.
            </p>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
