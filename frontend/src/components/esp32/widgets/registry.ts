import { bleWidgets } from "@/components/esp32/labs/ble/widgets";
import { displayWidgets } from "@/components/esp32/labs/display/widgets";
import { introWidgets } from "@/components/esp32/labs/intro/widgets";
import { rfidWidgets } from "@/components/esp32/labs/rfid/widgets";
import { soundWidgets } from "@/components/esp32/labs/sound/widgets";
import { wifiWidgets } from "@/components/esp32/labs/wifi/widgets";

// Content names widgets by id; this table resolves an id to its (lazy) component. Each track
// owns its own map, so adding a simulator never touches another track. Ids must be unique
// across tracks (registry.test.ts checks it), or one would silently shadow another.
export const WIDGETS = {
  ...introWidgets,
  ...displayWidgets,
  ...wifiWidgets,
  ...rfidWidgets,
  ...bleWidgets,
  ...soundWidgets,
} as const;

export type WidgetId = keyof typeof WIDGETS;
