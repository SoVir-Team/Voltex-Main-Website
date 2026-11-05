import { HeroBanner } from "@/components/home/HeroBanner";
import { CoreCapabilities, PromiseBand, VisionMission, WhoWeAre } from "@/components/home/HomeSections";
import { PrecisionBand } from "@/components/home/PrecisionBand";
import { ClosingCta } from "@/components/home/ClosingCta";
import { SITE } from "@/lib/site";

/** A static home page: who VOLTEX is, what it believes and what it makes. Details live on the inner pages. */
export default function HomePage() {
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.legalName,
    alternateName: SITE.name,
    url: SITE.url,
    slogan: "You dream it. We build it.",
    description: SITE.description,
    email: SITE.contact.email,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
      <HeroBanner />
      <WhoWeAre />
      <VisionMission />
      <CoreCapabilities />
      <PrecisionBand />
      <PromiseBand />
      <ClosingCta />
    </>
  );
}
