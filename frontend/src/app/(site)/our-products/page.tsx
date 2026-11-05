import type { Metadata } from "next";
import { connection } from "next/server";
import { ProductsPage } from "@/components/products/ProductsPage";

export const metadata: Metadata = {
  title: "Our products",
  description: "Electronics, electrical and industrial products, priced with GST. Send an order request to VOLTEX.",
  alternates: { canonical: "/our-products" },
};

export default async function OurProductsPage() {
  await connection();
  return <ProductsPage />;
}
