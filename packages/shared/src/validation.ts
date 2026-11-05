export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const GSTIN_RE = /^[0-9]{2}[A-Z0-9]{10}[0-9A-Z]{3}$/;
export const HSN_RE = /^\d{4,8}$/;

/** Indian numbers only: 10 digits, optionally written with +91 / 91 / 0 in front. Returns "+91 9876543210", or "" when invalid. */
export function indianPhone(raw: unknown): string {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[1-9][0-9]{9}$/.test(digits) ? `+91 ${digits}` : "";
}
