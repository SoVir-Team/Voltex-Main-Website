import Image from "next/image";
import { ChevronDown, Cpu, Factory, Layers, ShieldCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { PHOTOS_4K } from "@/lib/credits";

const PILLARS = [
  { icon: Cpu, label: "Circuit design" },
  { icon: Layers, label: "PCB fabrication" },
  { icon: ShieldCheck, label: "Assembly and testing" },
  { icon: Factory, label: "Manufacturing" },
];

/**
 * Full-bleed hero: a 4K photograph from inside a surface-mount production machine, pushed in slowly,
 * under a flat navy scrim so the headline reads at AA contrast.
 */
export function HeroBanner() {
  const photo = PHOTOS_4K.smtHero;
  return (
    <section aria-labelledby="hero-title" className="relative isolate flex min-h-[calc(100svh-4.5rem)] flex-col overflow-hidden bg-ink-deep text-on-ink">
      <div className="absolute inset-0 -z-10">
        <Image src={photo.src} alt={photo.alt} fill priority quality={85} sizes="100vw" className="push-in object-cover object-[60%_50%]" />
        <div className="absolute inset-0 bg-ink-deep/70" />
      </div>

      <div className="frame grid-12 flex-1 content-center gap-y-10 py-[clamp(4rem,10vh,8rem)]">
        <div className="col-span-12 lg:col-span-9">
          <p className="rise-in text-lead font-semibold text-bolt" style={{ ["--d" as string]: 0 }}>
            Electronics design and manufacturing
          </p>
          <h1 id="hero-title" className="monument mt-6 text-[clamp(2.6rem,9.2vw,9rem)] leading-[0.9]">
            <span className="rise-in block whitespace-nowrap" style={{ ["--d" as string]: 1 }}>
              You dream it.
            </span>
            <span className="rise-in block whitespace-nowrap" style={{ ["--d" as string]: 2 }}>
              We build it.
            </span>
          </h1>
          <p className="rise-in mt-8 max-w-[38rem] text-lead text-on-ink" style={{ ["--d" as string]: 4 }}>
            VOLTEX designs, engineers and manufactures electronics: circuits, printed circuit boards and finished products,
            from your first idea to full production.
          </p>
          <div className="rise-in mt-10 flex flex-wrap gap-3" style={{ ["--d" as string]: 5 }}>
            <ButtonLink href="/bring-your-idea" variant="bolt" arrow className="min-h-14 px-8">
              Bring your idea
            </ButtonLink>
            <ButtonLink href="/capabilities" variant="light" className="min-h-14 px-8">
              Explore capabilities
            </ButtonLink>
          </div>
        </div>
      </div>

      <div className="bg-ink-deep/85">
        <ul className="frame grid grid-cols-2 gap-x-6 gap-y-4 py-6 lg:grid-cols-4">
          {PILLARS.map(({ icon: Icon, label }, i) => (
            <li key={label} className="rise-in flex items-center gap-3 text-[1.0625rem] font-semibold" style={{ ["--d" as string]: 6 + i }}>
              <Icon aria-hidden className="h-6 w-6 shrink-0 text-bolt" strokeWidth={1.75} />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <a href="#who-title" className="cue absolute bottom-24 right-[clamp(1.25rem,3vw,2.5rem)] hidden items-center gap-2 text-small font-medium text-on-ink-muted hover:text-on-ink lg:flex">
        Scroll <ChevronDown aria-hidden className="h-4 w-4" />
      </a>
    </section>
  );
}
