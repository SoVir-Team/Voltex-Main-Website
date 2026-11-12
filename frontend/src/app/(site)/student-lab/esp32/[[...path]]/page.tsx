import type { Metadata } from "next";
import Link from "next/link";
import { Esp32Loader } from "@/components/esp32/Esp32Loader";

export const metadata: Metadata = {
  title: "ESP32 Labs · Student Lab",
  description:
    "A guided ESP32-S3 bench course: displays and buttons, Wi-Fi, RFID and NFC, Bluetooth Low Energy and sound. Wire each lab from the pinout, follow the steps, try the simulator and read the firmware line by line.",
  alternates: { canonical: "/student-lab/esp32" },
};

// One page for every ESP32 Labs address (/student-lab/esp32, …/lessons/R3, …/lessons/R3/code): the labs app routes
// inside it, so a lesson link can be shared and reloaded.
export default function Esp32LabsPage() {
  return (
    <>
      <section aria-labelledby="esp32-labs" className="bg-ink-deep text-on-ink">
        <div className="frame pt-[clamp(2rem,4vw,3.5rem)] pb-[clamp(1.5rem,3vw,2.5rem)]">
          <p className="text-small text-on-ink-muted">
            <Link href="/student-lab" className="underline underline-offset-4 hover:text-on-ink">
              Student Lab
            </Link>{" "}
            / ESP32 Labs
          </p>
          <div className="mt-4 grid-12 gap-y-4">
            <h1 id="esp32-labs" className="col-span-12 display text-[clamp(2.2rem,1.4rem+3vw,4.2rem)] lg:col-span-6">
              ESP32 Labs
            </h1>
            <p className="col-span-12 max-w-[36rem] self-end text-on-ink-muted lg:col-span-6">
              A bench course for the ESP32-S3 DevKitC-1 in five tracks. Each lab has the wiring, the steps, a guided
              simulation of what the firmware does and the real firmware to read line by line. To run your own code on
              an emulated chip, use the Microcontroller Lab.
            </p>
          </div>
        </div>
      </section>
      <Esp32Loader />
    </>
  );
}
