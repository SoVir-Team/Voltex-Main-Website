import type { Metadata } from "next";
import { Prose } from "@/components/layout/Prose";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy", alternates: { canonical: "/privacy" } };

// TODO(client): have this reviewed by your legal adviser before launch (Digital Personal Data Protection Act, 2023).
export default function PrivacyPage() {
  return (
    <Prose title="Privacy" updated="4 November 2026">
      <p>
        {SITE.legalName} (“VOLTEX”, “we”) respects your privacy. This page explains what we collect through this website and how we use it.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>Details you send us through the idea, contact and order request forms: name, email, phone, company, GSTIN, address and your message.</li>
        <li>Basic server logs (IP address, browser, pages requested) kept for security and troubleshooting.</li>
        <li>Your cart, stored only in your own browser until you send an order request.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To reply to you, prepare quotes, and confirm and fulfil order requests.</li>
        <li>To issue GST invoices where you provide a GSTIN.</li>
        <li>We do not sell your data and we do not use advertising trackers on this site.</li>
      </ul>
      <h2>Confidentiality of ideas</h2>
      <p>Product ideas you share are read only by our engineering team and are not disclosed. A mutual NDA is available on request.</p>
      <h2>Retention and your rights</h2>
      <p>
        We keep enquiries and order records as long as needed for the purpose and for our legal and tax obligations. You may ask us to access,
        correct or delete your personal data by writing to <a href={`mailto:${SITE.contact.email}`}>{SITE.contact.email}</a>.
      </p>
    </Prose>
  );
}
