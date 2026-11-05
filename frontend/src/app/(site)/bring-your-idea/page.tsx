import type { Metadata } from "next";
import Image from "next/image";
import { PageHead } from "@/components/layout/PageHead";
import { Reveal } from "@/components/motion/Reveal";
import { IdeaForm } from "@/components/forms/IdeaForm";
import { JourneySlip } from "@/components/home/JourneySlip";
import { Faq } from "@/components/home/Faq";
import { PHOTOS } from "@/lib/credits";
import { FAQ } from "@/lib/site";

export const metadata: Metadata = {
  title: "Bring your idea",
  description:
    "Have an idea for an electronic product? VOLTEX designs it, builds it, makes it work and manufactures it, from first sketch to production.",
  alternates: { canonical: "/bring-your-idea" },
};

const WHO = [
  { who: "Startups", what: "Turn a pitch into a working prototype you can put in front of users and investors." },
  { who: "Product developers", what: "Add an electronics team for the circuit, the board and the firmware." },
  { who: "Industries", what: "Custom controllers, sensor boards and retrofits for machines and plants." },
  { who: "Businesses", what: "Branded electronic products designed and manufactured to your specification." },
];

export default function BringYourIdeaPage() {
  return (
    <>
      <PageHead
        title="Bring your idea"
        lead="Anyone, or any company, with an idea can come to VOLTEX. We design it, implement it, make it work and manufacture it."
      />

      <Reveal as="section" aria-labelledby="for-title" className="frame grid-12 gap-y-12 pb-[clamp(5rem,10vw,9rem)]">
        <figure data-reveal className="col-span-12 lg:col-span-6">
          <div className="relative aspect-[4/3] overflow-hidden bg-surface">
            <Image src={PHOTOS.soldering.src} alt={PHOTOS.soldering.alt} fill priority sizes="(max-width: 1024px) 100vw, 48vw" className="object-cover" />
          </div>
        </figure>
        <div className="col-span-12 lg:col-span-5 lg:col-start-8">
          <figure data-reveal className="relative mb-10 aspect-[16/9] overflow-hidden bg-surface">
            <Image src={PHOTOS.pickPlace.src} alt={PHOTOS.pickPlace.alt} fill sizes="(max-width: 1024px) 100vw, 40vw" className="object-cover" />
          </figure>
          <h2 id="for-title" data-reveal className="text-heading font-bold">
            Who comes to us
          </h2>
          <dl className="mt-8 space-y-7">
            {WHO.map((w) => (
              <div key={w.who} data-reveal>
                <dt className="text-[1.25rem] font-bold">{w.who}</dt>
                <dd className="mt-1 text-muted">{w.what}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Reveal>

      <JourneySlip />

      <Reveal as="section" aria-labelledby="form-title" className="frame grid-12 section-gap items-start gap-y-12">
        <div className="col-span-12 lg:sticky lg:top-24 lg:col-span-4">
          <h2 id="form-title" data-reveal className="display text-[clamp(2.4rem,1.4rem+3.4vw,4.75rem)]">
            Tell us your idea
          </h2>
          <p data-reveal className="mt-6 max-w-[26rem] text-lead text-muted">
            A few lines are enough to start. An engineer, not a salesperson, reads every submission.
          </p>
          <ul data-reveal className="mt-10 space-y-3 text-[1.0625rem]">
            <li>Free first consultation</li>
            <li>Mutual NDA on request</li>
            <li>A clear plan before any cost</li>
          </ul>
          <figure data-reveal className="relative mt-10 hidden aspect-[4/3] overflow-hidden bg-surface lg:block">
            <Image src={PHOTOS.circuitBoard.src} alt={PHOTOS.circuitBoard.alt} fill sizes="30vw" className="object-cover" />
          </figure>
        </div>
        <div id="idea-form" data-reveal className="col-span-12 scroll-mt-24 lg:col-span-7 lg:col-start-6">
          <IdeaForm />
        </div>
      </Reveal>

      <Faq items={FAQ.slice(0, 5)} />
    </>
  );
}
