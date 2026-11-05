import type { Metadata } from "next";
import { Prose } from "@/components/layout/Prose";
import { PHOTOS, PHOTOS_4K, VIDEOS } from "@/lib/credits";

export const metadata: Metadata = { title: "Image credits", alternates: { canonical: "/credits" } };

export default function CreditsPage() {
  const items = [...Object.values(PHOTOS_4K), ...Object.values(PHOTOS), ...Object.values(VIDEOS)];
  return (
    <Prose title="Image credits">
      <p>
        Photographs and footage of the electronics world on this site come from open collections and are used under their licences. They show the
        industry, not VOLTEX’s own facility or products. Product photographs in the catalogue are the manufacturers’ images.
      </p>
      <ul>
        {items.map((p) => (
          <li key={p.src}>
            <a href={p.page} rel="noopener noreferrer" target="_blank">
              “{p.title}”
            </a>{" "}
            by {p.creator}, <a href={p.licenseUrl} rel="noopener noreferrer" target="_blank">{p.license}</a>, via Wikimedia Commons.
          </li>
        ))}
      </ul>
    </Prose>
  );
}
