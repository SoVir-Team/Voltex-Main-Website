"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { I18nextProvider } from "react-i18next";
import { RouterProvider } from "react-router/dom";
import { i18n } from "@/components/esp32/i18n/i18n";
import { initMotion } from "@/components/esp32/lib/motion";
import "@/components/esp32/esp32.css";
import { queryClient } from "./query-client";
import { createRouter } from "./router";

let started = false;

/** The ESP32 Labs app, mounted client-side by the page. */
export default function Esp32App() {
  const [router] = useState(() => {
    if (!started) {
      initMotion();
      started = true;
    }
    return createRouter();
  });
  return (
    <div className="esp32">
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </I18nextProvider>
    </div>
  );
}
