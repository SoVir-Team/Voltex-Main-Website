"use client";

/** Admin API calls carry the session cookie (same origin). A 401 sends the admin back to sign in. */
export async function adminFetch<T = unknown>(url: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: T & { message?: string } }> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, credentials: "same-origin", cache: "no-store" });
  } catch {
    return { ok: false, status: 0, data: { message: "Could not reach the server." } as T & { message: string } };
  }
  if (res.status === 401) {
    // A full page load on purpose: the server layout re-checks the session on the sign-in round trip.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/admin/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  }
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/**
 * Product photos are resized in the browser before upload (ported from productApi.shrinkPhoto): phone photos are
 * often several MB. The result fits in ~700 KB on a white background, as WEBP where supported, otherwise JPEG.
 */
export const PHOTO_PICK_MAX_BYTES = 25 * 1024 * 1024;
const UPLOAD_MAX_BYTES = 700 * 1024;
const encode = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

export async function shrinkPhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const longest = Math.max(bitmap.width, bitmap.height);
  let side = Math.min(1600, longest);
  let best: Blob | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const scale = side / longest;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let blob = await encode(canvas, "image/webp", 0.85);
    if (!blob || blob.type !== "image/webp") blob = await encode(canvas, "image/jpeg", 0.85);
    if (blob) best = blob;
    if (blob && blob.size <= UPLOAD_MAX_BYTES) break;
    side = Math.round(side * 0.75);
  }
  bitmap.close?.();
  if (!best) throw new Error("This image could not be read. Choose a JPG, PNG or WEBP photo.");
  if (file.size <= best.size && file.size <= UPLOAD_MAX_BYTES) return file;
  const ext = best.type === "image/webp" ? "webp" : "jpg";
  return new File([best], `${file.name.replace(/\.[^.]+$/, "") || "photo"}.${ext}`, { type: best.type });
}
