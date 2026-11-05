import type { Metadata } from "next";
import Image from "next/image";
import { PageHead } from "@/components/layout/PageHead";
import { Reveal } from "@/components/motion/Reveal";
import { ClosingCta } from "@/components/home/ClosingCta";
import { PhotoBand } from "@/components/home/PhotoBand";
import { PHOTOS, VIDEOS } from "@/lib/credits";
import { CAPABILITY_GROUPS } from "@/lib/site";

export const metadata: Metadata = {
  title: "Capabilities",
  description:
    "Electronic circuit design, PCB layout, PCB fabrication and printing, single, double and multilayer boards, prototyping, embedded systems, assembly and testing.",
  alternates: { canonical: "/capabilities" },
};

const GROUP_PHOTOS = [PHOTOS.circuitBoard, PHOTOS.pickPlace, PHOTOS.oscilloscope];

export default function CapabilitiesPage() {
  return (
    <>
      <PageHead
        title="Capabilities"
        lead="Circuit design, PCB layout, fabrication, prototyping, embedded systems, assembly and testing, under one roof."
      />

      {CAPABILITY_GROUPS.map((g, gi) => {
        const photo = GROUP_PHOTOS[gi];
        const flip = gi % 2 === 1;
        return (
          <Reveal key={g.group} as="section" aria-labelledby={`cap-${gi}`} className={gi === 1 ? "bg-surface" : ""}>
            <div className="frame grid-12 section-gap items-start gap-y-12">
              <figure data-reveal className={`col-span-12 lg:col-span-5 ${flip ? "lg:order-2 lg:col-start-8" : ""}`}>
                <div className="relative aspect-[4/5] overflow-hidden bg-surface-2">
                  <Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 1024px) 100vw, 40vw" className="object-cover" />
                </div>
              </figure>
              <div className={`col-span-12 lg:col-span-6 ${flip ? "lg:order-1" : "lg:col-start-7"}`}>
                <h2 id={`cap-${gi}`} data-reveal className="display text-[clamp(2.6rem,1.4rem+4vw,5.5rem)]">
                  {g.group}
                </h2>
                <p data-reveal className="mt-6 max-w-[32rem] text-lead text-ink">
                  {g.summary}
                </p>
                <dl className="mt-12 space-y-8">
                  {g.items.map((it) => (
                    <div key={it.name} data-reveal className="grid gap-2 sm:grid-cols-[14rem_1fr] sm:gap-8">
                      <dt className="text-[1.0625rem] font-bold">{it.name}</dt>
                      <dd className="max-w-[36rem] text-[1.0625rem] text-muted">{it.detail}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </Reveal>
        );
      })}

      <Reveal as="section" aria-labelledby="boards-title" className="bg-ink text-on-ink">
        <div className="frame grid-12 section-gap gap-y-10">
          <h2 id="boards-title" data-reveal className="col-span-12 text-heading font-bold lg:col-span-4">
            Boards we make
          </h2>
          <ul className="col-span-12 lg:col-span-8">
            {[
              ["Single-layer", "Simple, cost-effective boards for power, lighting and control."],
              ["Double-layer", "Routing room for mixed-signal and microcontroller designs."],
              ["Multilayer", "Dense designs with dedicated power and ground planes."],
            ].map(([t, d]) => (
              <li key={t} data-reveal className="flex flex-col justify-between gap-2 py-5 sm:flex-row sm:items-baseline">
                <span className="display text-[clamp(2.2rem,1.4rem+3vw,4.5rem)]">{t}</span>
                <span className="max-w-[24rem] text-on-ink-muted sm:text-right">{d}</span>
              </li>
            ))}
          </ul>
          <p data-reveal className="col-span-12 max-w-[40rem] text-small text-on-ink-muted lg:col-span-8 lg:col-start-5">
            Layer counts, materials and tolerances are subject to production capability. Send your requirements and we will confirm.
          </p>
        </div>
      </Reveal>

      <PhotoBand video={VIDEOS.smtLine} caption="A surface-mount line placing components, the assembly stage of every production run." />

      <Reveal as="section" aria-labelledby="tools-title" className="frame section-gap">
        <h2 id="tools-title" data-reveal className="text-heading font-bold">
          From reel to finished board
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-[2fr_1fr]">
          <figure data-reveal className="relative aspect-[16/7] overflow-hidden bg-surface md:aspect-auto">
            <Image src={PHOTOS.feeder.src} alt={PHOTOS.feeder.alt} fill sizes="(max-width: 768px) 100vw, 66vw" className="object-cover" />
          </figure>
          <figure data-reveal className="relative aspect-[3/4] overflow-hidden bg-surface">
            <Image src={PHOTOS.pickPlaceBangalore.src} alt={PHOTOS.pickPlaceBangalore.alt} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
          </figure>
        </div>
      </Reveal>

      <ClosingCta title="Send us your design." body="Schematics, Gerbers, a bill of materials or just a sketch: we will review it and reply." />
    </>
  );
}
