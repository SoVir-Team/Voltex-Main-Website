import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { PHOTOS_4K } from "@/lib/credits";
import { CORE_CAPABILITIES, MISSION, VISION, WHO_WE_ARE } from "@/lib/site";

/** Who we are: a maker, not a middleman. Text from the brand profile beside a finished board. */
export function WhoWeAre() {
  const photo = PHOTOS_4K.stackup;
  return (
    <Reveal as="section" aria-labelledby="who-title" className="frame grid-12 section-gap items-center gap-y-14">
      <div className="col-span-12 lg:col-span-6">
        <h2 id="who-title" data-reveal className="display text-[clamp(2.4rem,1.4rem+3.4vw,4.75rem)]">
          We design it.
          <br />
          We make it.
        </h2>
        <p data-reveal className="mt-8 max-w-[36rem] text-lead text-ink">
          {WHO_WE_ARE[0]}
        </p>
        <div className="mt-6 max-w-[36rem] space-y-4 text-[1.0625rem] text-muted">
          {WHO_WE_ARE.slice(1).map((p, i) => (
            <p key={i} data-reveal>
              {p}
            </p>
          ))}
        </div>
        <p data-reveal className="mt-8">
          <Link href="/about" className="link font-semibold">
            More about VOLTEX
          </Link>
        </p>
      </div>
      <figure data-reveal className="col-span-12 lg:col-span-6">
        <div className="relative aspect-[5/4] bg-ground">
          <Image src={photo.src} alt={photo.alt} fill quality={85} sizes="(max-width: 1024px) 100vw, 50vw" className="object-contain" />
        </div>
      </figure>
    </Reveal>
  );
}

/** Vision and mission, word for word from the brand profile, on a navy field. */
export function VisionMission() {
  return (
    <Reveal as="section" aria-labelledby="vision-title" className="bg-ink text-on-ink">
      <div className="frame grid-12 section-gap gap-y-16">
        <div className="col-span-12 lg:col-span-6">
          <h2 id="vision-title" data-reveal className="text-heading font-bold text-bolt">
            Our vision
          </h2>
          <p data-reveal className="mt-6 max-w-[34rem] text-[clamp(1.35rem,1.05rem+0.9vw,1.85rem)] font-medium leading-snug">
            {VISION}
          </p>
        </div>
        <div className="col-span-12 lg:col-span-5 lg:col-start-8">
          <h2 data-reveal className="text-heading font-bold text-bolt">
            Our mission
          </h2>
          {MISSION.map((m, i) => (
            <p key={i} data-reveal className={i === 0 ? "mt-6 text-lead text-on-ink" : "mt-5 text-[1.0625rem] text-on-ink-muted"}>
              {m}
            </p>
          ))}
        </div>
      </div>
    </Reveal>
  );
}

/** The seven core capabilities from the brand profile, beside a 4K flat-lay of the parts we build with. */
export function CoreCapabilities() {
  const photo = PHOTOS_4K.components;
  return (
    <Reveal as="section" aria-labelledby="core-title" className="frame grid-12 section-gap items-start gap-y-14">
      <figure data-reveal className="col-span-12 lg:sticky lg:top-28 lg:col-span-5">
        <div className="relative aspect-[4/3] overflow-hidden bg-ground">
          <Image src={photo.src} alt={photo.alt} fill quality={85} sizes="(max-width: 1024px) 100vw, 42vw" className="object-cover" />
        </div>
      </figure>
      <div className="col-span-12 lg:col-span-6 lg:col-start-7">
        <h2 id="core-title" data-reveal className="display text-[clamp(2.4rem,1.4rem+3.4vw,4.75rem)]">
          Core capabilities
        </h2>
        <p data-reveal className="mt-6 max-w-[34rem] text-lead text-muted">
          Everything an electronic product needs, built under one roof.
        </p>
        <dl className="mt-10">
          {CORE_CAPABILITIES.map((c) => (
            <div key={c.name} data-reveal className="group py-5 transition-colors">
              <dt className="flex items-baseline gap-4 text-[1.25rem] font-bold leading-snug">
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 translate-y-[-0.15em] bg-bolt transition-transform duration-300 group-hover:scale-150" />
                {c.name}
              </dt>
              <dd className="mt-1.5 pl-[1.625rem] text-[1.0625rem] text-muted">{c.detail}</dd>
            </div>
          ))}
        </dl>
        <p data-reveal className="mt-6">
          <Link href="/capabilities" className="link font-semibold">
            See all capabilities
          </Link>
        </p>
      </div>
    </Reveal>
  );
}

/** The brand promise over a 4K panel of fabricated boards. */
export function PromiseBand() {
  const photo = PHOTOS_4K.panel;
  return (
    <section aria-labelledby="promise-title" className="relative isolate overflow-hidden bg-ink-deep text-on-ink">
      <div className="absolute inset-0 -z-10">
        <Image src={photo.src} alt={photo.alt} fill quality={85} sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-ink-deep/72" />
      </div>
      <Reveal className="frame flex min-h-[80svh] flex-col justify-center py-[clamp(5rem,10vw,9rem)]">
        <h2 id="promise-title" data-reveal className="text-heading font-bold text-bolt">
          Our promise
        </h2>
        <p data-reveal className="display mt-8 text-[clamp(1.6rem,5.4vw,5.5rem)] leading-[1]">
          <span className="block whitespace-nowrap">From concept to circuit.</span>
          <span className="block whitespace-nowrap">From design to reality.</span>
        </p>
        <p data-reveal className="mt-10 max-w-[40rem] text-lead text-on-ink-muted">
          Every great electronic product begins with a well-engineered circuit. We bring together design, technology and manufacturing
          to turn ideas into dependable electronic products.
        </p>
      </Reveal>
    </section>
  );
}
