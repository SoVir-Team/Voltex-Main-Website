/** Browser-side calls go to the site's own /api, which Next.js (dev) or Nginx (production) forwards to the API. */
export async function postJson<T = Record<string, unknown>>(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: T & { message?: string; errors?: string[] } }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { message: "Could not reach the server. Check your connection and try again." } as T & { message: string } };
  }
}
