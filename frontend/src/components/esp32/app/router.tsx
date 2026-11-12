import { createBrowserRouter, data } from "react-router";
import { queryClient } from "./query-client";
import { Esp32Layout } from "./Esp32Layout";
import { RouteError } from "./RouteError";
import type { RouteErrorReason } from "./route-errors";
import { HomeRoute, homeLoader } from "./routes/home-route";
import { LessonRoute, lessonLoader, trackLoader } from "./routes/lesson-route";

// The ESP32 Labs routes, under /student-lab/esp32: the labs map, a track's next lesson, a lesson and its code, the
// datasheet pages (chip, pins, peripheral atlas, inside), the parts library and the reader settings.
export const BASENAME = "/student-lab/esp32";

export const createRouter = () =>
  createBrowserRouter(
    [
      {
        path: "/",
        Component: Esp32Layout,
        ErrorBoundary: RouteError,
        HydrateFallback: () => null,
        children: [
          {
            ErrorBoundary: RouteError,
            children: [
              { index: true, loader: homeLoader(queryClient), Component: HomeRoute },
              { path: "lessons", loader: homeLoader(queryClient), Component: HomeRoute },
              { path: "tracks/:trackId", loader: trackLoader(queryClient) },
              { path: "lessons/:lessonId", loader: lessonLoader(queryClient), Component: LessonRoute },
              {
                path: "lessons/:lessonId/code",
                loader: lessonLoader(queryClient),
                lazy: async () => ({ Component: (await import("./routes/code-route")).Component }),
              },
              {
                path: "datasheet",
                lazy: async () => ({ Component: (await import("./routes/chip/chip-layout-route")).Component }),
                children: [
                  { index: true, lazy: async () => ({ Component: (await import("./routes/chip/chip-home-route")).Component }) },
                  { path: "pins", lazy: async () => ({ Component: (await import("./routes/chip/chip-pins-route")).Component }) },
                  { path: "blocks", lazy: async () => ({ Component: (await import("./routes/chip/chip-atlas-route")).Component }) },
                  {
                    path: "blocks/:blockId",
                    lazy: async () => {
                      const route = await import("./routes/chip/chip-block-route");
                      return { loader: route.blockLoader(queryClient), Component: route.Component };
                    },
                  },
                  { path: "inside", lazy: async () => ({ Component: (await import("./routes/chip/chip-inside-route")).Component }) },
                ],
              },
              { path: "settings", lazy: async () => ({ Component: (await import("./routes/settings-route")).Component }) },
              { path: "parts", lazy: async () => ({ Component: (await import("./routes/parts-route")).Component }) },
              {
                path: "*",
                loader: () => {
                  throw data({ reason: "noPage" } satisfies RouteErrorReason, { status: 404 });
                },
                Component: () => null,
              },
            ],
          },
        ],
      },
    ],
    { basename: BASENAME },
  );
