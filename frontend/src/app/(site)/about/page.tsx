import type { Metadata } from "next";
import Image from "next/image";
import { ArrowUpRight, CircuitBoard, Focus, Layers3 } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { ClosingCta } from "@/components/home/ClosingCta";
import { ButtonLink } from "@/components/ui/Button";
import { PHOTOS, PHOTOS_4K } from "@/lib/credits";
import { MISSION, PERSONALITY, SITE, VISION, WHO_WE_ARE } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: "Meet VOLTEX Electronics: our engineering philosophy, commitment to precision, and connected approach to circuit design, PCB development and electronics manufacturing.",
  alternates: { canonical: "/about" },
};

const PRINCIPLES = [
  {
    icon: Focus,
    title: "Purpose before complexity.",
    body: "The best design starts with a clear understanding of the problem. We consider what a product must do, where it will operate and how it will be built before shaping the electronics inside it.",
  },
  {
    icon: CircuitBoard,
    title: "Precision in the details.",
    body: "Component choices, circuit behaviour and PCB layout all influence the finished product. Our approach brings these decisions together, with attention to practical performance, reliability and manufacture.",
  },
  {
    icon: Layers3,
    title: "Think beyond the prototype.",
    body: "A working board is an important milestone. We also consider assembly, testing and future revisions, helping a promising concept progress towards a product that can be made again.",
  },
] as const;

const DEVELOPMENT_STAGES = [
  { title: "Understand the ambition", body: "Start with the application, operating conditions and project priorities. Turn the initial idea into a clear set of engineering requirements.", output: "Requirements & feasibility" },
  { title: "Engineer the foundation", body: "Connect circuit design, component selection, PCB layout and embedded development around the needs of the product.", output: "Schematics & board design" },
  { title: "Build, test, refine", body: "Bring the design into the physical world. Use prototype testing to examine behaviour, identify improvements and guide the next revision.", output: "Prototypes & design feedback" },
  { title: "Prepare for production", body: "Bring fabrication, assembly and functional testing into focus, with production requirements and acceptance criteria agreed for the project.", output: "Manufacturing & testing plan" },
] as const;

export default function AboutPage() {
  return (
    <>
      <section aria-labelledby="page-title" className="relative isolate flex min-h-[clamp(26rem,70svh,46rem)] items-end overflow-hidden bg-ink-deep text-on-ink">
        <div className="absolute inset-0 -z-10">
          <Image src={PHOTOS_4K.panel.src} alt={PHOTOS_4K.panel.alt} fill priority quality={85} sizes="100vw" className="push-in object-cover" />
          <div className="absolute inset-0 bg-ink-deep/70" />
        </div>
        <div className="frame grid-12 gap-y-8 pt-[clamp(6rem,14vw,10rem)] pb-[clamp(3rem,6vw,5rem)]">
          <h1 id="page-title" className="display rise-in col-span-12 text-[clamp(3rem,1.4rem+6vw,7.5rem)] lg:col-span-8">
            Engineering intelligence
          </h1>
          <div className="col-span-12 self-end lg:col-span-4">
            <p className="rise-in max-w-[30rem] text-lead text-on-ink" style={{ ["--d" as string]: 2 }}>
              {SITE.tagline}
            </p>
          </div>
        </div>
      </section>

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

      <Reveal as="section" aria-labelledby="principles-title" className="bg-surface">
        <div className="frame section-gap">
          <div className="grid-12 gap-y-6">
            <p data-reveal className="col-span-12 text-small font-semibold uppercase tracking-[0.16em] text-signal lg:col-span-4">The VOLTEX perspective</p>
            <div className="col-span-12 lg:col-span-7 lg:col-start-6">
              <h2 id="principles-title" data-reveal className="display text-statement">Good engineering.<br />Considered at every level.</h2>
              <p data-reveal className="mt-6 max-w-[38rem] text-lead text-muted">Our standard is shaped by the decisions behind the design: purposeful thinking, careful execution and a clear path to what comes next.</p>
            </div>
          </div>
          <div className="mt-16 grid gap-10 md:grid-cols-3 md:gap-8">
            {PRINCIPLES.map(({ icon: Icon, title, body }, i) => (
              <article key={title} data-reveal className="border-t border-ink/20 pt-6">
                <div className="flex items-center justify-between">
                  <Icon aria-hidden size={30} strokeWidth={1.4} className="text-signal" />
                  <span className="tabular text-small text-muted">0{i + 1}</span>
                </div>
                <h3 className="mt-8 text-[1.5rem] font-bold leading-tight">{title}</h3>
                <p className="mt-4 text-body text-muted">{body}</p>
              </article>
            ))}
          </div>
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
          <span className="block">From concept to circuit.</span>
          <span className="block">From design to reality.</span>
        </p>
        <div className="grid-12 mt-10 gap-y-8">
          <div className="col-span-12 space-y-6 lg:col-span-7">
            <p data-reveal className="max-w-[44rem] text-lead text-muted">
              At VOLTEX, we believe every great electronic product begins with a well-engineered circuit. We bring together design,
              technology and manufacturing to help turn innovative ideas into dependable electronic solutions.
            </p>
            <p data-reveal className="max-w-[42rem] text-body text-muted">
              Our promise is to treat your idea with the care its potential deserves. That means understanding the application,
              asking the right questions and making engineering decisions that balance performance, practicality and the demands
              of production. Every schematic, component and board layout is part of that responsibility.
            </p>
          </div>
          <aside data-reveal className="col-span-12 border-l-2 border-bolt pl-6 lg:col-span-4 lg:col-start-9 lg:self-center">
            <p className="text-small font-semibold uppercase tracking-[0.16em] text-signal">The commitment behind the circuit</p>
            <p className="mt-4 text-[clamp(1.5rem,1.1rem+1vw,2.25rem)] font-semibold leading-tight tracking-tight">
              Thoughtful in design.<br />Precise in execution.<br />Focused on your product.
            </p>
          </aside>
        </div>
        <div className="mt-14 grid gap-8 md:grid-cols-3 md:gap-10">
          {[
            {
              title: "Clarity at every step",
              body: "We believe good collaboration starts with clear expectations. Requirements, technical trade-offs and the next development milestone should be understood together, so each decision moves your project forward with purpose.",
            },
            {
              title: "Confidence through testing",
              body: "A design earns confidence when its behaviour is measured. Prototyping, review and functional testing help us examine how the electronics perform against agreed requirements and where refinement is needed.",
            },
            {
              title: "Care beyond the first board",
              body: "We look ahead to how your electronics will be assembled, manufactured and improved. From an early prototype to a repeat production run, our focus stays on making the next stage practical and considered.",
            },
          ].map(({ title, body }, i) => (
            <article key={title} data-reveal className="border-t border-ink/20 pt-6">
              <span className="tabular text-small font-semibold text-signal">0{i + 1}</span>
              <h3 className="mt-4 text-[1.375rem] font-bold leading-tight">{title}</h3>
              <p className="mt-4 text-body text-muted">{body}</p>
            </article>
          ))}
        </div>
      </Reveal>

      <Reveal as="section" aria-labelledby="development-title" className="border-y border-ink/15">
        <div className="frame grid-12 section-gap gap-y-12">
          <div className="col-span-12 lg:col-span-4">
            <p data-reveal className="text-small font-semibold uppercase tracking-[0.16em] text-signal">A connected approach</p>
            <h2 id="development-title" data-reveal className="display mt-6 text-statement">One idea.<br />A considered path forward.</h2>
            <p data-reveal className="mt-6 text-body text-muted">Design and manufacturing influence each other. Bringing them into the same conversation helps keep the product, and the purpose behind it, in view.</p>
            <div data-reveal className="mt-8">
              <ButtonLink href="/capabilities" variant="ghost">Explore our capabilities <ArrowUpRight aria-hidden size={18} /></ButtonLink>
            </div>
          </div>
          <ol className="col-span-12 lg:col-span-7 lg:col-start-6">
            {DEVELOPMENT_STAGES.map((stage, i) => (
              <li key={stage.title} data-reveal className="grid grid-cols-[2rem_1fr] gap-4 border-t border-ink/20 py-8 first:pt-0 first:border-t-0 sm:grid-cols-[3rem_1fr] sm:gap-6">
                <span aria-hidden className="tabular pt-1 text-small font-semibold text-signal">0{i + 1}</span>
                <div>
                  <h3 className="text-[1.5rem] font-bold leading-tight">{stage.title}</h3>
                  <p className="mt-3 text-body text-muted">{stage.body}</p>
                  <p className="mt-4 text-small font-semibold text-signal">{stage.output}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
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

      <Reveal as="section" aria-labelledby="partners-title" className="bg-ink-deep text-on-ink">
        <div className="frame section-gap">
          <div className="grid-12 gap-y-8">
            <div className="col-span-12 lg:col-span-6">
              <p data-reveal className="text-small font-semibold uppercase tracking-[0.16em] text-on-ink-muted">Built around your ambition</p>
              <h2 id="partners-title" data-reveal className="display mt-6 text-statement">Your product deserves<br />an engineering partner.</h2>
            </div>
            <p data-reveal className="col-span-12 self-end text-lead text-on-ink-muted lg:col-span-5 lg:col-start-8">Whether you are defining your first product or refining an existing board, VOLTEX brings design thinking and practical electronics expertise to the next step.</p>
          </div>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {[
              { title: "For startups", body: "Give an early idea a practical direction, with feasibility discussions, prototype development and engineering support as the concept takes shape." },
              { title: "For product developers", body: "Connect circuit design, PCB engineering and embedded systems to move from a product requirement to electronics you can build and evaluate." },
              { title: "For industry & business", body: "Develop customised boards for industrial and commercial applications, with fabrication, assembly and testing considered around the project requirements." },
            ].map(({ title, body }) => (
              <article key={title} data-reveal className="border-t border-on-ink/25 pt-6">
                <h3 className="text-[1.375rem] font-bold">{title}</h3>
                <p className="mt-4 text-body text-on-ink-muted">{body}</p>
              </article>
            ))}
          </div>
          <div data-reveal className="mt-12 flex flex-wrap items-center gap-6">
            <ButtonLink href="/bring-your-idea" variant="light">Tell us what you are building <ArrowUpRight aria-hidden size={18} /></ButtonLink>
            <p className="max-w-[28rem] text-small text-on-ink-muted">Start with a concept, a schematic or an existing design. We will help define the next step.</p>
          </div>
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
