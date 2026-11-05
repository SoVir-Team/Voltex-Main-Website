import Link from "next/link";
import { NAV, SITE } from "@/lib/site";

/** The footer inverts ground and ink. */
export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-ink text-on-ink">
      <div className="frame grid-12 gap-y-10 pt-20 pb-12 text-[0.95rem]">
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <p className="font-semibold">{SITE.legalName}</p>
          <p className="mt-2 text-on-ink-muted">Electronics design, PCB fabrication and manufacturing.</p>
          <p className="mt-2 text-on-ink-muted">{SITE.contact.address.slice(1).join(", ")}</p>
        </div>
        <nav aria-label="Footer" className="col-span-6 sm:col-span-3 lg:col-span-2 lg:col-start-5">
          <p className="font-semibold">Company</p>
          <ul className="mt-2 space-y-1.5 text-on-ink-muted">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="hover:text-on-ink">
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/bring-your-idea" className="hover:text-on-ink">
                Bring your idea
              </Link>
            </li>
          </ul>
        </nav>
        <div className="col-span-6 sm:col-span-3 lg:col-span-2">
          <p className="font-semibold">Legal</p>
          <ul className="mt-2 space-y-1.5 text-on-ink-muted">
            <li>
              <Link href="/privacy" className="hover:text-on-ink">Privacy</Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-on-ink">Terms</Link>
            </li>
            <li>
              <Link href="/credits" className="hover:text-on-ink">Image credits</Link>
            </li>
          </ul>
        </div>
        <div className="col-span-12 sm:col-span-6 lg:col-span-3 lg:col-start-10">
          <p className="font-semibold">Talk to an engineer</p>
          <ul className="mt-2 space-y-1.5 text-on-ink-muted">
            <li>
              <a href={`mailto:${SITE.contact.email}`} className="hover:text-on-ink">{SITE.contact.email}</a>
            </li>
            <li>
              <a href={`tel:${SITE.contact.phone.replace(/\s/g, "")}`} className="hover:text-on-ink">{SITE.contact.phone}</a>
            </li>
            <li>{SITE.contact.hours}</li>
          </ul>
        </div>
      </div>

      <div className="frame pb-8">
        <div className="flex flex-col justify-between gap-2 text-small text-on-ink-muted sm:flex-row">
          <p>© {year} {SITE.legalName}. All rights reserved.</p>
          <p>{SITE.promise}</p>
        </div>
      </div>
    </footer>
  );
}
