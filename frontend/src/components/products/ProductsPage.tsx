import { Suspense } from "react";
import type { Division } from "@voltex/shared";
import { Catalogue } from "./Catalogue";
import { getProducts } from "@/lib/api";
import { SITE } from "@/lib/site";

/** Shared body of /our-products and /our-products/<division>: search-engine product data plus the catalogue. */
export async function ProductsPage({ division }: { division?: Division }) {
  const products = await getProducts();
  const listed = division ? products?.filter((p) => p.division === division) : products;
  const base = division ? `${SITE.url}/our-products/${division}` : `${SITE.url}/our-products`;

  // Product data for search engines (ported from useStructuredData.js).
  const jsonLd = listed?.length
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: listed.map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "Product",
            name: p.name,
            sku: p.sku,
            brand: p.brand ? { "@type": "Brand", name: p.brand } : undefined,
            category: p.category,
            description: p.description || undefined,
            image: p.imageUrl ? new URL(p.imageUrl, SITE.url).toString() : undefined,
            offers: {
              "@type": "Offer",
              priceCurrency: "INR",
              price: p.priceInclTax.toFixed(2),
              availability:
                p.stockStatus === "out_of_stock"
                  ? "https://schema.org/OutOfStock"
                  : p.stockStatus === "limited"
                    ? "https://schema.org/LimitedAvailability"
                    : "https://schema.org/InStock",
              url: `${base}?product=${p.id}`,
            },
          },
        })),
      }
    : null;

  return (
    <>
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /> : null}
      <Suspense>
        <Catalogue initial={products} division={division} />
      </Suspense>
    </>
  );
}
