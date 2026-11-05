import type { DiscountType, Pricing, StockStatus } from "./pricing.js";

/** Top-level product sections, each with its own page under /our-products/<slug>. */
export const DIVISIONS = [
  {
    slug: "electronics",
    label: "Electronics products",
    short: "Electronics",
    blurb: "PLCs, HMIs, controllers, sensors and network electronics for machines and plants.",
  },
  {
    slug: "electrical",
    label: "Electrical products",
    short: "Electrical",
    blurb: "Drives, power supplies, switchgear, relays and cables for panels and installations.",
  },
  {
    slug: "industrial",
    label: "Industrial products",
    short: "Industrial",
    blurb: "Pneumatic valves, cylinders, fittings and automation hardware for the factory floor.",
  },
] as const;
export type Division = (typeof DIVISIONS)[number]["slug"];
export const DIVISION_SLUGS = DIVISIONS.map((d) => d.slug) as Division[];
export const isDivision = (v: unknown): v is Division => typeof v === "string" && (DIVISION_SLUGS as string[]).includes(v);

export const ORDER_STATUSES = ["pending", "confirmed", "dispatched", "completed", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const INBOX_STATUSES = ["new", "read", "archived"] as const;
export type InboxStatus = (typeof INBOX_STATUSES)[number];

export const IDEA_STAGES = ["Just an idea", "Sketch or concept", "Working prototype", "Ready to manufacture"] as const;
export const IDEA_SERVICES = [
  "Circuit design",
  "PCB layout",
  "PCB fabrication",
  "Prototyping",
  "Embedded firmware",
  "Assembly and testing",
  "Volume manufacturing",
] as const;

export interface Product extends Pricing {
  id: string;
  name: string;
  sku: string;
  brand: string;
  division: Division;
  category: string;
  description: string;
  hsnCode: string;
  unit: string;
  imageUrl: string;
  price: number;
  taxRate: number;
  discountType: DiscountType;
  discountValue: number;
  stock: number;
  lowStockThreshold: number;
  isActive: boolean;
  stockStatus: StockStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  productId: string | null;
  sku: string;
  name: string;
  hsnCode: string;
  quantity: number;
  unitPrice: number;
  listPriceInclTax: number;
  discountPerUnit: number;
  taxRate: number;
  taxableAmount: number;
  taxAmount: number;
  lineTotal: number;
}

export interface Customer {
  name: string;
  email: string;
  phone: string;
  company: string;
  gstin: string;
  address: string;
  notes: string;
}

export interface ProductOrder {
  id: string;
  orderNumber: string;
  customer: Customer;
  items: OrderItem[];
  taxableTotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface IdeaSubmission {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  stage: string;
  services: string[];
  quantity: string;
  timeline: string;
  description: string;
  ndaRequested: boolean;
  status: InboxStatus;
  createdAt: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  subject: string;
  message: string;
  status: InboxStatus;
  createdAt: string;
}
