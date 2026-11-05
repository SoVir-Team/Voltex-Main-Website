import type { Metadata } from "next";
import { Prose } from "@/components/layout/Prose";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Terms", alternates: { canonical: "/terms" } };

// TODO(client): have this reviewed by your legal adviser before launch.
export default function TermsPage() {
  return (
    <Prose title="Terms" updated="4 November 2026">
      <p>These terms apply to your use of this website and to order requests sent through it.</p>
      <h2>Order requests</h2>
      <ul>
        <li>An order request is not a confirmed sale. We confirm availability, delivery, payment terms and the final invoice with you before dispatch.</li>
        <li>Prices are shown in Indian rupees and include GST at the rate stated for each product.</li>
        <li>Stock shown on the site is indicative and can change; we reserve stock when you send a request and release it if the request is cancelled.</li>
      </ul>
      <h2>Engineering and manufacturing work</h2>
      <p>Design, prototyping and manufacturing projects are governed by a separate written quotation or agreement for each project.</p>
      <h2>Intellectual property</h2>
      <p>
        Content on this site belongs to {SITE.legalName} or its licensors. Product names and trademarks belong to their owners. Photographs from open
        collections are used under their licences, listed on the image credits page.
      </p>
      <h2>Contact</h2>
      <p>
        Questions about these terms: <a href={`mailto:${SITE.contact.email}`}>{SITE.contact.email}</a>.
      </p>
    </Prose>
  );
}
