import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "@/components/motion/Reveal";
import { ClosingCta } from "@/components/home/ClosingCta";
import { Faq } from "@/components/home/Faq";
import { HeroCircuit } from "@/components/lab/page/HeroCircuit";
import { LabLoader } from "@/components/lab/page/LabLoader";
import { LedCalculator, OhmCalculator, TraceCalculator } from "@/components/lab/page/Calculators";
import { BoardStage, type Stage } from "@/components/lab/page/BoardStages";
import { MISSIONS } from "@/components/lab/engine/missions";
import { PROJECTS } from "@/components/lab/engine/projects";
import { PALETTE } from "@/components/lab/engine/parts";

export const metadata: Metadata = {
  title: "Student Lab",
  description:
    "A free PCB simulator for engineering, diploma and college students. Place real parts, route copper, run a live circuit simulation and pass a design-rule check, with Volta, your lab partner, correcting mistakes as you go.",
  alternates: { canonical: "/student-lab" },
};

const STAGES: { stage: Stage; name: string; text: string }[] = [
  { stage: "schematic", name: "Schematic", text: "The circuit as symbols: what connects to what, before anything has a size or a place." },
  { stage: "layout", name: "Layout", text: "Parts get real footprints and positions. Copper traces replace the schematic's lines." },
  { stage: "copper", name: "Copper", text: "The factory etches away every bit of copper that is not a trace or a pad." },
  { stage: "mask", name: "Solder mask", text: "A green coating protects the copper and leaves only the pads exposed for soldering." },
  { stage: "silk", name: "Silkscreen", text: "White ink prints the outlines and labels you use to place and repair parts." },
  { stage: "assembled", name: "Assembly", text: "Parts are placed and soldered, and the board is tested. Then it does its job." },
];

const STUDENT_FAQ = [
  { q: "Do I need to install anything?", a: "No. The lab runs in your browser and saves your boards on this device. A laptop or tablet works best; a phone works for the missions." },
  { q: "How real is the simulation?", a: "It solves the circuit with the same nodal analysis method SPICE uses, with real models for LEDs, diodes and transistors and a timing model for the 555. Values match hand calculations, so the maths you learn in class applies." },
  { q: "Is it free?", a: "Yes, for every student. There is no sign-up and nothing to buy." },
  { q: "Can Voltex make the board I designed?", a: "Yes. When your design passes its checks and you want it made for a project or a competition, send us your idea and an engineer will reply within one working day." },
  { q: "I'm a teacher. Can I use it in class?", a: "Please do. Each mission takes ten to twenty minutes and ends with a clear checklist, which works well for lab sessions." },
];

export default function StudentLabPage() {
  return (
    <>
      <section aria-labelledby="lab-title" className="bg-ink text-on-ink">
        <div className="frame grid-12 gap-y-10 pt-[clamp(3rem,6vw,6rem)] pb-[clamp(3rem,5vw,5rem)] lg:min-h-[78svh] lg:items-center">
          <div className="col-span-12 lg:col-span-5">
            <h1 id="lab-title" className="display rise-in text-[clamp(3rem,1.4rem+5.2vw,6.8rem)]">
              Design your first PCB. Break it safely.
            </h1>
            <p className="rise-in mt-8 max-w-[30rem] text-lead text-on-ink-muted" style={{ ["--d" as string]: 2 }}>
              A free circuit-board lab for engineering, diploma and college students. Place real parts, route copper, power it on and watch the current flow. Volta tells you when something is about to burn.
            </p>
            <div className="rise-in mt-10 flex flex-col gap-3 sm:flex-row" style={{ ["--d" as string]: 3 }}>
              <ButtonLink href="#lab" variant="bolt" arrow className="min-h-14 px-8">
                Start building
              </ButtonLink>
              <ButtonLink href="#builds" variant="light" className="min-h-14 px-8">
                See what you can build
              </ButtonLink>
            </div>
          </div>
          <div className="col-span-12 h-[clamp(20rem,48vw,40rem)] lg:col-span-7">
            <HeroCircuit />
          </div>
        </div>
      </section>

      <section id="lab" aria-labelledby="the-lab" className="scroll-mt-20 bg-ink-deep text-on-ink">
        <div className="frame pt-[clamp(3rem,6vw,5rem)] pb-6">
          <div className="grid-12 gap-y-4">
            <h2 id="the-lab" className="col-span-12 display text-[clamp(2.2rem,1.4rem+3vw,4.2rem)] lg:col-span-6">
              The lab
            </h2>
            <p className="col-span-12 max-w-[36rem] self-end text-on-ink-muted lg:col-span-6">
              Pick a part, click to place it, then route traces between pads with the trace tool. Flip the power switch to simulate. Shortcuts: T trace, V via while routing, L layer, R rotate, P probe, F fab view.
            </p>
          </div>
        </div>
        <div className="frame pb-[clamp(3rem,6vw,5rem)]">
          <LabLoader />
        </div>
      </section>

      <Reveal as="section" className="frame section-gap">
        <div id="builds" className="grid-12 scroll-mt-24 gap-y-6">
          <h2 data-reveal className="col-span-12 display text-[clamp(2.4rem,1.4rem+3.6vw,5rem)] lg:col-span-7">
            {MISSIONS.length + PROJECTS.length} things to build
          </h2>
          <p data-reveal className="col-span-12 max-w-[30rem] self-end text-lead text-muted lg:col-span-4 lg:col-start-9">
            Start with the missions, then pick anything from the project library. Free build unlocks all {PALETTE.length} parts.
          </p>
        </div>
        <div className="grid-12 mt-16 gap-y-14">
          <div className="col-span-12 lg:col-span-5">
            <h3 data-reveal className="text-heading font-bold">
              Missions
            </h3>
            <ol className="mt-6">
              {MISSIONS.map((m) => (
                <li key={m.id} data-reveal className="flex items-baseline justify-between gap-6 bg-surface px-5 py-4 even:bg-ground">
                  <span className="text-[1.15rem] font-bold text-ink">{m.title}</span>
                  <span className="text-right text-small text-muted">{m.skill}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="col-span-12 lg:col-span-6 lg:col-start-7">
            <h3 data-reveal className="text-heading font-bold">
              Project library
            </h3>
            <ul className="mt-6 columns-1 gap-x-8 sm:columns-2">
              {PROJECTS.map((p) => (
                <li key={p.id} data-reveal className="mb-6 break-inside-avoid">
                  <span className="block text-[1.15rem] font-bold text-ink">{p.title}</span>
                  <span className="block text-muted">{p.brief.split(". ")[0]}.</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>

      <Reveal as="section" className="bg-surface">
        <div className="frame section-gap">
          <div className="grid-12 gap-y-6">
            <h2 data-reveal className="col-span-12 display text-[clamp(2.4rem,1.4rem+3.6vw,5rem)] lg:col-span-8">
              From a sketch to a board you can hold
            </h2>
          </div>
          <ol className="mt-16 grid gap-x-[clamp(1rem,2vw,2rem)] gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {STAGES.map((s) => (
              <li key={s.stage} data-reveal>
                <div className="aspect-[10/9] bg-ground">
                  <BoardStage stage={s.stage} />
                </div>
                <h3 className="mt-5 text-[1.3rem] font-bold text-ink">{s.name}</h3>
                <p className="mt-2 max-w-[34ch] text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
          <p data-reveal className="mt-16 max-w-[40rem] text-lead text-ink">
            Voltex does every one of these steps in-house, from layout to fabrication and assembly.{" "}
            <a href="/capabilities" className="link">
              See our capabilities
            </a>
          </p>
        </div>
      </Reveal>

      <Reveal as="section" className="frame section-gap">
        <h2 data-reveal className="display max-w-[16ch] text-[clamp(2.4rem,1.4rem+3.6vw,5rem)]">
          The maths behind every board
        </h2>
        <div className="mt-16 space-y-20">
          <div data-reveal className="grid-12 gap-y-6">
            <div className="col-span-12 lg:col-span-4">
              <h3 className="text-heading font-bold">LED resistor</h3>
              <p className="mt-3 text-muted">R = (supply − LED voltage) ÷ current. Too small and the LED burns; too big and it is dim.</p>
            </div>
            <div className="col-span-12 lg:col-span-7 lg:col-start-6">
              <LedCalculator />
            </div>
          </div>
          <div data-reveal className="grid-12 gap-y-6">
            <div className="col-span-12 lg:col-span-4">
              <h3 className="text-heading font-bold">Ohm&apos;s law</h3>
              <p className="mt-3 text-muted">I = V ÷ R. Every current in the lab comes from this one rule, applied at every node at once.</p>
            </div>
            <div className="col-span-12 lg:col-span-7 lg:col-start-6">
              <OhmCalculator />
            </div>
          </div>
          <div data-reveal className="grid-12 gap-y-6">
            <div className="col-span-12 lg:col-span-4">
              <h3 className="text-heading font-bold">Trace width</h3>
              <p className="mt-3 text-muted">More current needs more copper, or the trace heats up. Board designers size every power trace like this.</p>
            </div>
            <div className="col-span-12 lg:col-span-7 lg:col-start-6">
              <TraceCalculator />
            </div>
          </div>
        </div>
      </Reveal>

      <Faq items={STUDENT_FAQ} />

      <ClosingCta title="Got a final-year project? Let's make it real." body="Send us your design or your idea. We lay out, fabricate and assemble boards for student projects and competitions." action="Bring your idea" />
    </>
  );
}
