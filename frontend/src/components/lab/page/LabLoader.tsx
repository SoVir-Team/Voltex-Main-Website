"use client";

import dynamic from "next/dynamic";

/** The simulator only makes sense in the browser, so it loads client-side behind a placeholder of the same size. */
const Lab = dynamic(() => import("../ui/Lab.tsx"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[min(86svh,860px)] min-h-[640px] items-center justify-center bg-white text-muted" role="status">
      Loading the lab…
    </div>
  ),
});

export function LabLoader() {
  return <Lab />;
}
