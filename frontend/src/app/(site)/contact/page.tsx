import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ContactForm } from "@/components/forms/ContactForm";
import { Reveal } from "@/components/motion/Reveal";
import { PHOTOS } from "@/lib/credits";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Talk to a VOLTEX engineer about circuit design, PCB fabrication, manufacturing or our product catalogue.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage({ searchParams }: PageProps<"/contact">) {
  const sp = await searchParams;
  const subject = typeof sp.subject === "string" ? sp.subject.slice(0, 160) : "";
  return (
    <>
      <Reveal as="section" aria-labelledby="page-title" className="frame grid-12 items-start gap-y-14 pt-[clamp(3rem,7vw,7rem)] pb-[clamp(5rem,10vw,9rem)]">
        <div className="col-span-12 lg:sticky lg:top-24 lg:col-span-5">
          <h1 id="page-title" className="display rise-in text-[clamp(3rem,1.4rem+6vw,7.5rem)]">
            Contact
          </h1>
          <p className="rise-in mt-8 max-w-[28rem] text-lead" style={{ ["--d" as string]: 2 }}>
            Questions about a design, a quote, or a part from the catalogue. An engineer replies within one working day.
          </p>
          <dl className="mt-12 space-y-6 text-[1.0625rem]">
            <div data-reveal>
              <dt className="font-bold">Email</dt>
              <dd>
                <a className="link" href={`mailto:${SITE.contact.email}`}>
                  {SITE.contact.email}
                </a>
              </dd>
            </div>
            <div data-reveal>
              <dt className="font-bold">Phone</dt>
              <dd>
                <a className="link tabular" href={`tel:${SITE.contact.phone.replace(/\s/g, "")}`}>
                  {SITE.contact.phone}
                </a>
              </dd>
            </div>
            <div data-reveal>
              <dt className="font-bold">Hours</dt>
              <dd className="text-muted">{SITE.contact.hours}</dd>
            </div>
            <div data-reveal>
              <dt className="font-bold">Have a product idea?</dt>
              <dd>
                <Link className="link" href="/bring-your-idea">
                  Use the idea form
                </Link>{" "}
                <span className="text-muted">so we get the details we need.</span>
              </dd>
            </div>
          </dl>
        </div>
        <div className="col-span-12 lg:col-span-6 lg:col-start-7 lg:pt-6">
          <h2 className="sr-only">Send us a message</h2>
          <div data-reveal>
            <ContactForm defaultSubject={subject} />
          </div>
          <div className="mt-14 grid grid-cols-2 gap-4">
            {[PHOTOS.circuitBoard, PHOTOS.oscilloscope, PHOTOS.capacitors, PHOTOS.feeder].map((p) => (
              <figure key={p.src} data-reveal className="relative aspect-square overflow-hidden bg-surface">
                <Image src={p.src} alt={p.alt} fill sizes="(max-width: 1024px) 50vw, 25vw" className="object-cover" />
              </figure>
            ))}
          </div>
        </div>
      </Reveal>
    </>
  );
}
