import { Link as PageLink, Outlet, ScrollRestoration, useLocation, useNavigation } from "react-router";
import { useTranslation } from "react-i18next";
import NextLink from "next/link";
import { BackToTop } from "@/components/esp32/ui/BackToTop";
import { Icon, type IconName } from "@/components/esp32/ui/Icon";

const SECTIONS = [
  { to: "/", key: "labs", icon: "board", match: /^\/($|lessons|tracks)/ },
  { to: "/datasheet", key: "chip", icon: "chip", match: /^\/datasheet/ },
  { to: "/settings", key: "settings", icon: "sliders", match: /^\/settings/ },
] as const satisfies readonly { to: string; key: string; icon: IconName; match: RegExp }[];

/**
 * The ESP32 Labs shell in the Voltex style: a bar with the sections (labs, datasheet, settings), the firmware
 * download and the way to the other Student Labs, then the page and a footnote.
 */
export function Esp32Layout() {
  const navigation = useNavigation();
  const { pathname } = useLocation();
  const { t } = useTranslation();
  return (
    <div className="esp32-wrap">
      {navigation.state !== "idle" ? <div className="esp32-progress" role="progressbar" aria-label={t("layout.loading")} /> : null}
      <div className="esp32-bar">
        <nav aria-label={t("layout.sections")} className="esp32-sections">
          {SECTIONS.map((s) => {
            const here = s.match.test(pathname);
            return (
              <PageLink key={s.to} to={s.to} aria-current={here ? (pathname === s.to ? "page" : "true") : undefined}>
                <Icon name={s.icon} size={17} />
                <span>{t(`layout.nav.${s.key}`)}</span>
              </PageLink>
            );
          })}
        </nav>
        <span
          className="esp32-badge"
          title="The simulators on these pages model what each lab's firmware does. To run real code on an emulated chip, use the Microcontroller Lab."
        >
          Guided simulation
        </span>
        <a className="esp32-download" href="/esp32/esp32-labs.zip" download>
          Download the lab firmware
        </a>
        <nav aria-label="Other Student Labs" className="esp32-others">
          <NextLink href="/student-lab/pcb">PCB Lab</NextLink>
          <NextLink href="/student-lab/mcu">Microcontroller Lab</NextLink>
        </nav>
      </div>
      <main id="esp32-main" tabIndex={-1} className="esp32-main">
        <Outlet />
      </main>
      <p className="esp32-foot">
        {t("layout.footnote")} <PageLink to="/parts">{t("layout.partsLink")}</PageLink>
      </p>
      <BackToTop />
      <ScrollRestoration />
    </div>
  );
}
