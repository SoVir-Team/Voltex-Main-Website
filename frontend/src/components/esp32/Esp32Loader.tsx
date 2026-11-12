"use client";

import dynamic from "next/dynamic";

/** The labs read the browser's storage and draw on canvases, so they load client-side behind a placeholder. */
const Esp32App = dynamic(() => import("./app/Esp32App"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[60svh] items-center justify-center text-muted" role="status">
      Loading the ESP32 Labs…
    </div>
  ),
});

export function Esp32Loader() {
  return <Esp32App />;
}
