import "server-only";
import type { Product } from "@voltex/shared";

const API = (process.env.API_INTERNAL_URL ?? "http://localhost:4000").replace(/\/$/, "");

/** Active catalogue products, fetched on the server. Returns null when the API cannot be reached. */
export async function getProducts(): Promise<Product[] | null> {
  try {
    const res = await fetch(`${API}/api/products`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: Product[] };
    return body.data;
  } catch {
    return null;
  }
}
