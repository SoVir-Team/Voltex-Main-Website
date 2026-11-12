"use client";

import dynamic from "next/dynamic";

/** The emulators run only in the browser, so the lab loads client-side behind a placeholder of the same size. */
const McuLab = dynamic(() => import("./ui/McuLab.tsx"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[min(88svh,900px)] min-h-[660px] items-center justify-center bg-white text-muted" role="status">
      Loading the Microcontroller Lab…
    </div>
  ),
});

export function McuLoader() {
  return <McuLab />;
}
