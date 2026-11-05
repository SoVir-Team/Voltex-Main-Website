import type { Metadata } from "next";
import Image from "next/image";
import { PageHead } from "@/components/layout/PageHead";
import { Reveal } from "@/components/motion/Reveal";
import { ClosingCta } from "@/components/home/ClosingCta";
import { PHOTOS } from "@/lib/credits";
import { MISSION, PERSONALITY, SITE, VISION, WHO_WE_ARE } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: "VOLTEX is an electronics engineering, design and manufacturing company. Our vision, mission and promise.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <PageHead title="Engineering intelligence" lead={SITE.tagline} />

      <figure className="relative h-[clamp(18rem,52vw,44rem)] overflow-hidden bg-surface">
        <Image src={PHOTOS.pickPlaceBangalore.src} alt={PHOTOS.pickPlaceBangalore.alt} fill priority sizes="100vw" className="object-cover object-[50%_30%]" />
      </figure>

      <Reveal as="section" aria-labelledby="who-title" className="frame grid-12 section-gap gap-y-10">
        <h2 id="who-title" data-reveal className="col-span-12 text-heading font-bold lg:col-span-4">
          Who we are
        </h2>
        <div className="col-span-12 space-y-6 lg:col-span-7 lg:col-start-6">
          {WHO_WE_ARE.map((p, i) => (
            <p key={i} data-reveal className={i === 0 ? "text-lead text-ink" : "text-[1.0625rem] text-muted"}>
              {p}
            </p>
          ))}
        </div>
      </Reveal>

      <Reveal as="section" aria-labelledby="vision-title" className="bg-ink text-on-ink">
        <div className="frame grid-12 section-gap gap-y-16">
          <div className="col-span-12 lg:col-span-6">
            <h2 id="vision-title" data-reveal className="text-heading font-bold text-bolt">
              Vision
            </h2>
            <p data-reveal className="mt-6 max-w-[34rem] text-lead font-medium leading-snug">
              {VISION}
            </p>
          </div>
          <div className="col-span-12 lg:col-span-5 lg:col-start-8">
            <h2 data-reveal className="text-heading font-bold text-bolt">
              Mission
            </h2>
            {MISSION.map((m, i) => (
              <p key={i} data-reveal className="mt-6 text-[1.0625rem] text-on-ink-muted first-of-type:text-on-ink">
                {m}
              </p>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal as="section" aria-labelledby="promise-title" className="frame section-gap">
        <h2 id="promise-title" data-reveal className="text-heading font-bold">
          Our promise
        </h2>
        <p data-reveal className="display mt-10 text-[clamp(1.35rem,5.2vw,4.75rem)] leading-[1]">
          <span className="block whitespace-nowrap">From concept to circuit.</span>
          <span className="block whitespace-nowrap">From design to reality.</span>
        </p>
        <p data-reveal className="mt-10 max-w-[44rem] text-lead text-muted">
          At VOLTEX, we believe every great electronic product begins with a well-engineered circuit. We bring together design,
          technology and manufacturing to help turn innovative ideas into dependable electronic solutions.
        </p>
      </Reveal>

      <Reveal as="section" aria-labelledby="character-title" className="bg-surface">
        <div className="frame grid-12 section-gap items-center gap-y-12">
          <div className="col-span-12 lg:col-span-5">
            <h2 id="character-title" data-reveal className="text-heading font-bold">
              How we work
            </h2>
            <ul className="mt-8">
              {PERSONALITY.map((t) => (
                <li key={t} data-reveal className="display text-[clamp(2rem,1.2rem+2.6vw,3.6rem)] text-ink">
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <figure data-reveal className="col-span-12 lg:col-span-6 lg:col-start-7">
            <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
              <Image src={PHOTOS.smtLine.src} alt={PHOTOS.smtLine.alt} fill sizes="(max-width: 1024px) 100vw, 48vw" className="object-cover" />
            </div>
          </figure>
        </div>
      </Reveal>

      <Reveal as="section" aria-labelledby="world-title" className="frame section-gap">
        <h2 id="world-title" data-reveal className="text-heading font-bold">
          The craft we practise
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {[PHOTOS.oscilloscope, PHOTOS.capacitors].map((p) => (
            <figure key={p.src} data-reveal>
              <div className="relative aspect-[4/3] overflow-hidden bg-surface">
                <Image src={p.src} alt={p.alt} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
              </div>
            </figure>
          ))}
        </div>
      </Reveal>

      <ClosingCta title="Let’s engineer it together." body="Startups, product developers, industries and businesses: tell us what you are building." />
    </>
  );
}
