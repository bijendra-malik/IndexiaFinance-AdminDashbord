/**
 * Feature-local helpers for the franchise screens.
 *
 * These were previously copy-pasted inside FranchiseApplications.tsx; the list
 * and detail pages now share one copy instead of drifting apart.
 */

import type { Franchise } from "../../api/franchises";

export const BRAND_GRADIENT = "linear-gradient(135deg, rgb(6, 106, 156), rgb(38, 174, 144))";

/** Business name is the most meaningful label; fall back through the rest. */
export const displayName = (franchise: Franchise): string =>
  franchise.businessName ||
  franchise.name ||
  franchise.fullName ||
  franchise.contactPerson ||
  "Franchise";

/** Who to talk to at the franchise — distinct from the franchise name. */
export const contactName = (franchise: Franchise): string =>
  franchise.contactPerson || franchise.fullName || franchise.name || "";

export const locationOf = (franchise: Franchise): string =>
  [franchise.city, franchise.state, franchise.country].filter(Boolean).join(", ");

export const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("") || "F";

/** "none"/empty means the account registered but never applied. */
export const franchiseStatusLabel = (status?: string): string => {
  const trimmed = (status ?? "").trim();
  return !trimmed || trimmed.toLowerCase() === "none" ? "Registered" : trimmed;
};

/** Pill classes for both franchise and application statuses. */
export const statusPillClass = (status?: string): string => {
  switch ((status ?? "").trim().toLowerCase()) {
    case "approved":
      return "bg-emerald-50 text-emerald-700";
    case "rejected":
      return "bg-red-50 text-red-700";
    case "none":
      return "bg-slate-100 text-slate-600";
    default:
      return "bg-amber-50 text-amber-700";
  }
};

export const isStatus = (status: string | undefined, expected: string): boolean =>
  (status ?? "").trim().toLowerCase() === expected.toLowerCase();

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export const formatCurrency = (amount?: number | null): string =>
  typeof amount === "number" && Number.isFinite(amount) ? inr.format(amount) : "—";

export const formatDate = (date?: string | null): string =>
  date
    ? new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export const formatDateTime = (date?: string | null): string =>
  date
    ? new Date(date).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const STATUS_FILTER_OPTIONS = [
  { value: "All", label: "All statuses" },
  { value: "None", label: "Registered (not applied)" },
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
];
