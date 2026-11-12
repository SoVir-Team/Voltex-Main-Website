import { useTranslation } from "react-i18next";
import { Caption } from "@/components/esp32/ui/Caption";
import type { WidgetProps } from "@/components/esp32/widgets/types";
import { BLE_LABS } from "./screens";

/** B1-B8 preview: the lab's screen, its buttons and its serial monitor (example data). */
export function SimBle({ lesson }: WidgetProps) {
  const { t } = useTranslation("labs-ble");
  const lab = BLE_LABS[lesson.id];
  if (!lab) return <Caption>{t("kit.previewComing")}</Caption>;
  return lab.preview(lesson);
}
