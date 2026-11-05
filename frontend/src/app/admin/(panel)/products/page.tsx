import { Suspense } from "react";
import { ProductManager } from "@/components/admin/ProductManager";

export const metadata = { title: "Products" };

export default function AdminProductsPage() {
  return (
    <Suspense>
      <ProductManager />
    </Suspense>
  );
}
