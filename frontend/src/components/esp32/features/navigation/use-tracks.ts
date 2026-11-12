import { useQueries } from "@tanstack/react-query";
import { trackLessonsQuery } from "@/components/esp32/content/queries";
import { TRACKS } from "@/components/esp32/content/tracks";
import type { LessonEntry } from "@/components/esp32/domain/lesson";
import type { Track } from "@/components/esp32/domain/track";
import { useLocale } from "@/components/esp32/i18n/use-locale";

export interface TrackContent {
  readonly track: Track;
  /** Undefined while that track's chunk is still loading. */
  readonly lessons?: readonly LessonEntry[];
}

/**
 * Every track with its lessons. Each track's content is one small chunk; the ones not on screen
 * load in the background, so a row fills in a moment after the page appears.
 */
export function useTracks(): TrackContent[] {
  const locale = useLocale();
  const results = useQueries({ queries: TRACKS.map((t) => trackLessonsQuery(t.id, locale)) });
  return TRACKS.map((track, i) => ({ track, lessons: results[i]?.data }));
}
