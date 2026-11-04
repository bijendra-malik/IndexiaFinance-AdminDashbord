import axiosInstance from "./axiosInstance";

/*
==========================================
Super admin activity feed — /activity

Ek hi call har loan product ke adminUpdates ko jod kar deti hai:
kaun admin, kis loan par, kya update kiya aur kab.
==========================================
*/

export type AdminActivityKind = "note" | "recommendation" | "status";

export interface AdminActivityUpdate {
  id: string;
  applicationId: string;
  productKey: string;
  slug: string;
  label: string;
  customerName: string;
  mobile: string;
  applicationNo: string | null;
  loanStatus: string;
  loanAmount: number | null;
  text: string;
  kind: AdminActivityKind;
  suggestedStatus: string | null;
  adminId: string | null;
  adminName: string;
  adminRole: string;
  addedAt: string;
}

export interface AdminActivityAdmin {
  id: string;
  name: string;
  email: string;
  loginId: string;
  role: string;
  total: number;
}

export interface AdminActivityProduct {
  key: string;
  slug: string;
  label: string;
  total: number;
}

export interface AdminActivityResult {
  windowDays: number;
  total: number;
  lastActivityAt: string | null;
  updates: AdminActivityUpdate[];
  admins: AdminActivityAdmin[];
  products: AdminActivityProduct[];
}

export interface AdminActivityFilters {
  adminId?: string;
  product?: string;
  days?: number;
}

interface RawActivity {
  windowDays?: number;
  total?: number;
  lastActivityAt?: string | null;
  updates?: Array<Record<string, unknown>>;
  admins?: Array<Record<string, unknown>>;
  products?: Array<Record<string, unknown>>;
}

const asString = (value: unknown): string =>
  typeof value === "string" ? value : "";

const asNumber = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const toUpdate = (raw: Record<string, unknown>): AdminActivityUpdate => ({
  id: asString(raw.id),
  applicationId: asString(raw.applicationId),
  productKey: asString(raw.productKey),
  slug: asString(raw.slug),
  label: asString(raw.label) || "Loan application",
  customerName: asString(raw.customerName),
  mobile: asString(raw.mobile),
  applicationNo: typeof raw.applicationNo === "string" ? raw.applicationNo : null,
  loanStatus: asString(raw.loanStatus) || "Submitted",
  loanAmount: typeof raw.loanAmount === "number" ? raw.loanAmount : null,
  text: asString(raw.text),
  kind:
    raw.kind === "recommendation" || raw.kind === "status" ? raw.kind : "note",
  suggestedStatus: typeof raw.suggestedStatus === "string" ? raw.suggestedStatus : null,
  adminId: typeof raw.adminId === "string" ? raw.adminId : null,
  adminName: asString(raw.adminName) || "Admin",
  adminRole: asString(raw.adminRole),
  addedAt: asString(raw.addedAt),
});

const toAdmin = (raw: Record<string, unknown>): AdminActivityAdmin => ({
  id: asString(raw.id),
  name: asString(raw.name) || "Admin",
  email: asString(raw.email),
  loginId: asString(raw.loginId),
  role: asString(raw.role) || "Admin",
  total: asNumber(raw.total),
});

const toProduct = (raw: Record<string, unknown>): AdminActivityProduct => ({
  key: asString(raw.key),
  slug: asString(raw.slug),
  label: asString(raw.label) || "Loan product",
  total: asNumber(raw.total),
});

export const getAdminActivity = async (
  filters: AdminActivityFilters = {}
): Promise<AdminActivityResult> => {
  const { data } = await axiosInstance.get<{ success: boolean; activity: RawActivity }>(
    "/activity",
    {
      params: {
        ...(filters.adminId ? { adminId: filters.adminId } : {}),
        ...(filters.product ? { product: filters.product } : {}),
        ...(filters.days !== undefined ? { days: filters.days } : {}),
      },
    }
  );

  const activity = data.activity ?? {};

  return {
    windowDays: asNumber(activity.windowDays),
    total: asNumber(activity.total),
    lastActivityAt: activity.lastActivityAt ?? null,
    updates: (activity.updates ?? []).map(toUpdate),
    admins: (activity.admins ?? []).map(toAdmin),
    products: (activity.products ?? []).map(toProduct),
  };
};
