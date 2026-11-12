import { useSuspenseQuery } from "@tanstack/react-query";
import { chipContentQuery } from "@/components/esp32/content/queries";
import { useLocale } from "@/components/esp32/i18n/use-locale";

/** The chip content in the language on screen, from the query cache (suspends on first load). */
export function useChipContent() {
  return useSuspenseQuery(chipContentQuery(useLocale())).data;
}
