import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import chip from "../locales/en/chip.json";
import code from "../locales/en/code.json";
import common from "../locales/en/common.json";
import home from "../locales/en/home.json";
import labsBle from "../locales/en/labs-ble.json";
import labsDisplay from "../locales/en/labs-display.json";
import labsIntro from "../locales/en/labs-intro.json";
import labsRfid from "../locales/en/labs-rfid.json";
import labsShared from "../locales/en/labs-shared.json";
import labsSound from "../locales/en/labs-sound.json";
import labsWifi from "../locales/en/labs-wifi.json";
import lesson from "../locales/en/lesson.json";
import parts from "../locales/en/parts.json";
import settings from "../locales/en/settings.json";
import { type Locale, SOURCE_LOCALE } from "./locales";
import { DEFAULT_NAMESPACE } from "./namespaces";

// The interface text, in English, bundled and ready before the first render, so nothing suspends on a language.

export const i18n = i18next.createInstance();

void i18n.use(initReactI18next).init({
  lng: SOURCE_LOCALE,
  fallbackLng: SOURCE_LOCALE,
  supportedLngs: [SOURCE_LOCALE],
  resources: {
    en: {
      common,
      home,
      lesson,
      code,
      parts,
      settings,
      chip,
      "labs-shared": labsShared,
      "labs-intro": labsIntro,
      "labs-display": labsDisplay,
      "labs-wifi": labsWifi,
      "labs-rfid": labsRfid,
      "labs-ble": labsBle,
      "labs-sound": labsSound,
    },
  },
  defaultNS: DEFAULT_NAMESPACE,
  initAsync: false,
  // React escapes what it renders; RichText parses the few tags lesson text may carry.
  interpolation: { escapeValue: false },
  returnNull: false,
  react: { useSuspense: false },
});

/** The language on screen now. */
export const currentLocale = (): Locale => SOURCE_LOCALE;
