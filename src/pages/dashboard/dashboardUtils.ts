/**
 * Dashboard-local helpers: one source of truth for the four application states
 * (colour, pill classes) and the formatters the dashboard renders with.
 *
 * Kept inside the dashboard folder on purpose — the rest of the admin panel has
 * its own copies, and a shared module would be dead weight until those pages
 * are migrated too.
 */

import type { ProductStat } from "../../api/dashboard";

/** The four application states the dashboard reports on. */
export type Bucket = "Submitted" | "Pending" | "Approved" | "Rejected";

interface BucketStyle {
  /** Used for the donut arc and the bar segment. */
  hex: string;
  /** Tailwind pill classes. */
  bg: string;
  text: string;
}

export const STATUS: Record<Bucket, BucketStyle> = {
  Approved: { hex: "#10b981", bg: "bg-emerald-50", text: "text-emerald-700" },
  Pending: { hex: "#f59e0b", bg: "bg-amber-50", text: "text-amber-700" },
  Submitted: { hex: "#0ea5e9", bg: "bg-sky-50", text: "text-sky-700" },
  Rejected: { hex: "#ef4444", bg: "bg-red-50", text: "text-red-700" },
};

/** Donut/bar segment order — biggest business meaning first. */
export const BUCKET_ORDER: Bucket[] = ["Approved", "Pending", "Submitted", "Rejected"];

/** Any unknown status falls back to Submitted so the UI never renders blank. */
export const asBucket = (status?: string): Bucket =>
  (BUCKET_ORDER as readonly string[]).includes(status ?? "") ? (status as Bucket) : "Submitted";

export const BRAND = {
  gradient: "linear-gradient(135deg, rgb(6, 106, 156), rgb(38, 174, 144))",
  blue: "rgb(0, 102, 153)",
};

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export const formatCurrency = (amount: number) => inr.format(amount);

/** Short form for tight spaces: ₹42.81Cr / ₹4.30L / ₹9,500. */
export const formatCompactCurrency = (amount: number) => {
  const magnitude = Math.abs(amount);
  if (magnitude >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(2)}Cr`;
  if (magnitude >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(2)}L`;
  return inr.format(amount);
};

export const formatDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

export const formatDateTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const shortDate = (iso?: string) => {
  if (!iso) return "—";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff > 1 && diff < 30) return `${diff}d ago`;
  return formatDate(iso);
};

/** Percentage of a total, safe when the total is zero. */
export const percentOf = (count: number, total: number) =>
  total > 0 ? (count / total) * 100 : 0;

/** Loan amount that tolerates a missing/invalid backend value. */
export const amountOf = (loan: { loanAmount?: number }) =>
  typeof loan.loanAmount === "number" && Number.isFinite(loan.loanAmount) ? loan.loanAmount : 0;

/** Reads the per-product count for one application state without string keys. */
export const productCount = (product: ProductStat, bucket: Bucket): number => {
  switch (bucket) {
    case "Approved":
      return product.approved;
    case "Pending":
      return product.pending;
    case "Submitted":
      return product.submitted;
    case "Rejected":
      return product.rejected;
  }
};

/** Clamped 0–100 so a bad scale can never overflow the track. */
export const barPercent = (value: number, scale: number) =>
  Math.min(100, Math.max(0, (value / Math.max(1, scale)) * 100));

/**
 * Admin route for one loan product, or `null` when the payload carries no
 * slug. Returning null lets callers render plain text instead of a broken
 * `/applications/undefined` link.
 */
export const applicationPath = (slug?: string): string | null => {
  const trimmed = slug?.trim();
  return trimmed ? `/applications/${encodeURIComponent(trimmed)}` : null;
};

/**
 * Detail route for one application. Needs both parts — the backend has already
 * been observed omitting `slug` on product rows, so `recent[]` is not trusted
 * either. Returns null rather than an `/applications/undefined/<id>` link.
 */
export const applicationDetailPath = (slug?: string, id?: string): string | null => {
  const base = applicationPath(slug);
  const trimmedId = id?.trim();
  return base && trimmedId ? `${base}/${encodeURIComponent(trimmedId)}` : null;
};
