import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/capabilities", "/bring-your-idea", "/our-products", "/our-products/electronics", "/our-products/electrical", "/our-products/industrial", "/student-lab", "/student-lab/pcb", "/student-lab/mcu", "/student-lab/esp32", "/about", "/contact", "/privacy", "/terms", "/credits"];
  return pages.map((p) => ({
    url: `${SITE.url}${p}`,
    changeFrequency: p === "/our-products" ? "daily" : "monthly",
    priority: p === "" ? 1 : p === "/our-products" || p === "/bring-your-idea" ? 0.9 : 0.6,
  }));
}
