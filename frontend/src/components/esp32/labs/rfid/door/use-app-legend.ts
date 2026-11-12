import type { LegendItem } from "@/components/esp32/ui/sequence/types";
import { useRfidText } from "../text/use-rfid-text";

/** Legend shared by the R7 and R8 app flows. */
export function useAppLegend(): readonly LegendItem[] {
  const { t } = useRfidText();
  return [
    { kind: "msg", label: t("doorSeq.legend.msg") },
    { kind: "wait", label: t("doorSeq.legend.wait") },
  ];
}
