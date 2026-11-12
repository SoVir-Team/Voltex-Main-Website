import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "@/components/motion/Reveal";
import { ClosingCta } from "@/components/home/ClosingCta";
import { Faq } from "@/components/home/Faq";
import { HeroCircuit } from "@/components/lab/page/HeroCircuit";
import { LabCards } from "@/components/lab/page/LabCards";
import { LedCalculator, OhmCalculator, TraceCalculator } from "@/components/lab/page/Calculators";
import { BoardStage, type Stage } from "@/components/lab/page/BoardStages";

export const metadata: Metadata = {
  title: "Student Lab",
  description:
    "Free electronics labs for engineering, diploma and college students: design circuit boards, program Arduino and Raspberry Pi Pico boards that run your real code, and work through guided ESP32 labs, all in the browser.",
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
  { q: "How real is the simulation?", a: "The PCB Lab solves the circuit with the same nodal analysis method SPICE uses, with real models for LEDs, diodes and transistors. In the Microcontroller Lab your program is compiled and run instruction by instruction on an emulated chip, and its pins drive that same circuit solver. The ESP32 Labs are guided lessons: their simulators are models of what each lab's firmware does, and we label them that way." },
  { q: "Which boards can I program?", a: "Arduino Uno in Arduino C++, and Raspberry Pi Pico in Arduino C++ or MicroPython. The ESP32 Labs follow the ESP32-S3 DevKitC-1, so you can repeat them on a real board." },
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
              Build real electronics. Break them safely.
            </h1>
            <p className="rise-in mt-8 max-w-[30rem] text-lead text-on-ink-muted" style={{ ["--d" as string]: 2 }}>
              Free labs for engineering, diploma and college students. Design a circuit board, program a microcontroller that runs your real code, or work through guided ESP32 projects. Everything runs in your browser.
            </p>
            <div className="rise-in mt-10 flex flex-col gap-3 sm:flex-row" style={{ ["--d" as string]: 3 }}>
              <ButtonLink href="#labs" variant="bolt" arrow className="min-h-14 px-8">
                Choose a lab
              </ButtonLink>
              <ButtonLink href="/student-lab/pcb" variant="light" className="min-h-14 px-8">
                Open the PCB Lab
              </ButtonLink>
            </div>
          </div>
          <div className="col-span-12 h-[clamp(20rem,48vw,40rem)] lg:col-span-7">
            <HeroCircuit />
          </div>
        </div>
      </section>

      <LabCards />

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
