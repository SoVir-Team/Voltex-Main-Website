import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { McuLoader } from "@/components/mcu/McuLoader";
import { EXAMPLES } from "@/components/mcu/ui/examples";

export const metadata: Metadata = {
  title: "Microcontroller Lab · Student Lab",
  description:
    "Write Arduino C++ or MicroPython, wire LEDs, buttons, knobs, servos and buzzers to an Arduino Uno or Raspberry Pi Pico, and watch your real compiled program run on an emulated chip.",
  alternates: { canonical: "/student-lab/mcu" },
};

const FACTS = [
  { title: "Real chips, emulated", body: "Your code is compiled with the same arduino-cli toolchain as the Arduino IDE, then runs instruction by instruction on an emulated ATmega328P (16 MHz) or RP2040. delay(500) takes 500 ms." },
  { title: "Real electrical limits", body: "Every pin drives the circuit through its datasheet output resistance. An LED without a resistor pulls too much current and the run stops, as a real chip would be damaged." },
  { title: "Real instruments", body: "Serial monitor and plotter, a pin table that measures duty and frequency from the chip's own pin edges, and the multimeter probe on any wire." },
];

export default function McuLabPage() {
  return (
    <>
      <section aria-labelledby="mcu-lab" className="bg-ink-deep text-on-ink">
        <div className="frame pt-[clamp(2rem,4vw,3.5rem)] pb-6">
          <p className="text-small text-on-ink-muted">
            <Link href="/student-lab" className="underline underline-offset-4 hover:text-on-ink">
              Student Lab
            </Link>{" "}
            / Microcontroller Lab
          </p>
          <div className="mt-4 grid-12 gap-y-4">
            <h1 id="mcu-lab" className="col-span-12 display text-[clamp(2.2rem,1.4rem+3vw,4.2rem)] lg:col-span-6">
              Microcontroller Lab
            </h1>
            <p className="col-span-12 max-w-[36rem] self-end text-on-ink-muted lg:col-span-6">
              Pick an example or write your own code, wire parts to the board with the wire tool, press Check, then Run. Hold a button or drag a knob in the inspector while the program runs. Shortcuts: W wire, S select, P probe, R rotate.
            </p>
          </div>
        </div>
        <div className="frame pb-[clamp(3rem,6vw,5rem)]">
          <McuLoader />
        </div>
      </section>

      <Reveal as="section" className="frame section-gap">
        <div className="grid-12 gap-y-6">
          <h2 data-reveal className="col-span-12 display text-[clamp(2.4rem,1.4rem+3.6vw,5rem)] lg:col-span-7">
            How real is it?
          </h2>
        </div>
        <div className="grid-12 mt-12 gap-y-10">
          {FACTS.map((f) => (
            <div key={f.title} data-reveal className="col-span-12 md:col-span-4">
              <h3 className="text-heading font-bold">{f.title}</h3>
              <p className="mt-3 text-muted">{f.body}</p>
            </div>
          ))}
        </div>
        <h3 data-reveal className="mt-20 text-heading font-bold">
          {EXAMPLES.length} examples to start from
        </h3>
        <ul className="mt-6 columns-1 gap-x-8 sm:columns-2">
          {EXAMPLES.map((x) => (
            <li key={x.id} data-reveal className="mb-6 break-inside-avoid">
              <span className="block text-[1.15rem] font-bold text-ink">
                {x.title} <span className="text-small font-semibold text-muted">· {x.board === "uno" ? "Arduino Uno, C++" : "Raspberry Pi Pico, MicroPython"}</span>
              </span>
              <span className="block text-muted">{x.summary}</span>
            </li>
          ))}
        </ul>
        <p data-reveal className="mt-10 max-w-[44rem] text-small text-muted">
          Emulation by avr8js and rp2040js (MIT). MicroPython firmware © the MicroPython project (MIT). See the third-party notices.
        </p>
      </Reveal>
    </>
  );
}
