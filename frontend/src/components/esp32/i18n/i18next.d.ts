// Types the interface catalogues from their English source, so t("key") is checked: a typo or
// a removed key fails the build. Other languages must have the same keys (catalogues.test.ts).
import "i18next";
import type common from "@/components/esp32/locales/en/common.json";
import type home from "@/components/esp32/locales/en/home.json";
import type lesson from "@/components/esp32/locales/en/lesson.json";
import type code from "@/components/esp32/locales/en/code.json";
import type settings from "@/components/esp32/locales/en/settings.json";
import type chip from "@/components/esp32/locales/en/chip.json";
import type parts from "@/components/esp32/locales/en/parts.json";
import type labsShared from "@/components/esp32/locales/en/labs-shared.json";
import type labsIntro from "@/components/esp32/locales/en/labs-intro.json";
import type labsDisplay from "@/components/esp32/locales/en/labs-display.json";
import type labsWifi from "@/components/esp32/locales/en/labs-wifi.json";
import type labsRfid from "@/components/esp32/locales/en/labs-rfid.json";
import type labsBle from "@/components/esp32/locales/en/labs-ble.json";
import type labsSound from "@/components/esp32/locales/en/labs-sound.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    returnNull: false;
    resources: {
      common: typeof common;
      home: typeof home;
      lesson: typeof lesson;
      code: typeof code;
      settings: typeof settings;
      parts: typeof parts;
      chip: typeof chip;
      "labs-shared": typeof labsShared;
      "labs-intro": typeof labsIntro;
      "labs-display": typeof labsDisplay;
      "labs-wifi": typeof labsWifi;
      "labs-rfid": typeof labsRfid;
      "labs-ble": typeof labsBle;
      "labs-sound": typeof labsSound;
    };
  }
}
