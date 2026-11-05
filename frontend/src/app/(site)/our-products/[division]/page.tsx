import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { DIVISIONS, isDivision } from "@voltex/shared";
import { ProductsPage } from "@/components/products/ProductsPage";

export function generateStaticParams() {
  return DIVISIONS.map((d) => ({ division: d.slug }));
}

export async function generateMetadata({ params }: PageProps<"/our-products/[division]">): Promise<Metadata> {
  const { division } = await params;
  const d = DIVISIONS.find((x) => x.slug === division);
  if (!d) return {};
  return {
    title: d.label,
    description: `${d.blurb} Priced with GST. Send an order request to VOLTEX.`,
    alternates: { canonical: `/our-products/${d.slug}` },
  };
}

export default async function DivisionPage({ params }: PageProps<"/our-products/[division]">) {
  const { division } = await params;
  if (!isDivision(division)) notFound();
  await connection();
  return <ProductsPage division={division} />;
}
