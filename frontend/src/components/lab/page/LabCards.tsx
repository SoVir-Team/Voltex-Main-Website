import { CircuitBoard, Cpu, Wifi } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { ButtonLink } from "@/components/ui/Button";

type Lab = {
  href: string;
  name: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tag: string;
  forWhom: string;
  does: string[];
};

const LABS: Lab[] = [
  {
    href: "/student-lab/pcb",
    name: "PCB Lab",
    icon: CircuitBoard,
    tag: "Circuit simulation",
    forWhom: "For anyone starting with circuits and board design.",
    does: ["Place 48 real parts and edit their values", "Route copper on two layers", "Check the design, then power it on", "Send a clean board to the factory"],
  },
  {
    href: "/student-lab/mcu",
    name: "Microcontroller Lab",
    icon: Cpu,
    tag: "Runs your real code",
    forWhom: "For students learning Arduino, embedded C++ or MicroPython.",
    does: ["Program an Arduino Uno or Raspberry Pi Pico", "Wire LEDs, buttons, sensors, servos and displays", "Your compiled program runs on an emulated chip", "Read the serial monitor, plotter and pin table"],
  },
  {
    href: "/student-lab/esp32",
    name: "ESP32 Labs",
    icon: Wifi,
    tag: "Guided projects",
    forWhom: "For students building connected projects on the ESP32-S3.",
    does: ["Displays, buttons, Wi-Fi, RFID/NFC, Bluetooth LE and sound", "Wiring, pins and steps for each lab", "Read the real firmware line by line", "Repeat each lab on a real board"],
  },
];

/** The three labs on the Student Lab hub. */
export function LabCards() {
  return (
    <section id="labs" aria-labelledby="labs-title" className="scroll-mt-20 bg-ink-deep text-on-ink">
      <div className="frame section-gap">
        <div className="grid-12 gap-y-4">
          <h2 id="labs-title" className="col-span-12 display text-[clamp(2.2rem,1.4rem+3vw,4.2rem)] lg:col-span-6">
            Pick a lab
          </h2>
          <p className="col-span-12 max-w-[36rem] self-end text-on-ink-muted lg:col-span-6">
            Each lab opens in its own page and saves your work on this device. No sign-up, nothing to install.
          </p>
        </div>
        <ul className="mt-12 grid gap-[clamp(1rem,2vw,1.5rem)] lg:grid-cols-3">
          {LABS.map((lab) => (
            <li key={lab.href} className="flex flex-col bg-white p-7 text-ink">
              <div className="flex items-center justify-between gap-4">
                <span className="inline-flex h-12 w-12 items-center justify-center bg-surface text-signal">
                  <lab.icon aria-hidden className="h-6 w-6" />
                </span>
                <span className="bg-surface px-2.5 py-1 text-[0.8rem] font-semibold text-muted">{lab.tag}</span>
              </div>
              <h3 className="mt-6 text-[1.6rem] font-bold">{lab.name}</h3>
              <p className="mt-2 text-muted">{lab.forWhom}</p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {lab.does.map((d) => (
                  <li key={d} className="flex gap-3 text-[0.95rem]">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 bg-bolt" />
                    {d}
                  </li>
                ))}
              </ul>
              <ButtonLink href={lab.href} variant="primary" arrow className="mt-8 w-full">
                Open the {lab.name}
              </ButtonLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
