import type { Locale } from "@/components/esp32/i18n/locales";
import { applyOverlay, type TextPolicy } from "@/components/esp32/i18n/overlay";

// Translations of the long-form content, laid over the English source when a track, the
// phrasebook or the tours load. Which fields count as text: ./text-policies.ts.
// English only for now, so there is no overlay yet.

/** A language's translation of one content catalogue; undefined when it has none. */
export async function loadOverlay(_locale: Locale, _name: string): Promise<unknown> {
  return undefined;
}

/** Loads a content catalogue's translation and lays it over the source. */
export async function localize<T>(
  source: T,
  locale: Locale,
  name: string,
  policy: TextPolicy,
): Promise<T> {
  return applyOverlay(source, await loadOverlay(locale, name), policy);
}
