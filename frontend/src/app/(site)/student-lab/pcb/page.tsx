import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { LabLoader } from "@/components/lab/page/LabLoader";
import { MISSIONS } from "@/components/lab/engine/missions";
import { PROJECTS } from "@/components/lab/engine/projects";
import { PALETTE } from "@/components/lab/engine/parts";

export const metadata: Metadata = {
  title: "PCB Lab · Student Lab",
  description:
    "Place real parts, route copper, run a live circuit simulation and pass a design-rule check, with Volta, your lab partner, correcting mistakes as you go.",
  alternates: { canonical: "/student-lab/pcb" },
};

export default function PcbLabPage() {
  return (
    <>
      <section id="lab" aria-labelledby="the-lab" className="scroll-mt-20 bg-ink-deep text-on-ink">
        <div className="frame pt-[clamp(2rem,4vw,3.5rem)] pb-6">
          <p className="text-small text-on-ink-muted">
            <Link href="/student-lab" className="underline underline-offset-4 hover:text-on-ink">
              Student Lab
            </Link>{" "}
            / PCB Lab
          </p>
          <div className="mt-4 grid-12 gap-y-4">
            <h1 id="the-lab" className="col-span-12 display text-[clamp(2.2rem,1.4rem+3vw,4.2rem)] lg:col-span-6">
              PCB Lab
            </h1>
            <p className="col-span-12 max-w-[36rem] self-end text-on-ink-muted lg:col-span-6">
              Pick a part, click to place it, then route traces between pads with the trace tool. Press Check, then flip the power switch to simulate. Shortcuts: T trace, V via while routing, L layer, R rotate, P probe, F fab view.
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
    </>
  );
}
