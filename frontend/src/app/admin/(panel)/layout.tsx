import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";

const API = (process.env.API_INTERNAL_URL ?? "http://localhost:4000").replace(/\/$/, "");

/** Verifies the session with the API on every admin page load; the proxy only checks that a cookie exists. */
async function getAdmin() {
  const jar = await cookies();
  const token = jar.get("vx_admin")?.value;
  if (!token) return null;
  try {
    const res = await fetch(`${API}/api/admin/me`, { headers: { cookie: `vx_admin=${token}` }, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()).user as { email: string; name: string };
  } catch {
    return null;
  }
}

export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return <AdminShell admin={admin}>{children}</AdminShell>;
}
