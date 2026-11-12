import axiosInstance from "./axiosInstance";
import type { AdminPermission } from "../constants/adminPermissions";
import type {
  AdminActivityAdmin,
  AdminActivityKind,
  AdminActivityProduct,
  AdminActivityUpdate,
} from "./adminActivity";

/*
==========================================
Sub-admin supervision dashboard — /dashboard/stats

Backend sub admin ke liye `dashboardMode: "supervisor"` bhejta hai. Pehle UI
apne counts `/activity` (500 rows) se banata tha, isliye 500 se zyada updates
par numbers adhoore ho jaate the. Ab server ka count hi source of truth hai.

Payload me ek hi jagah se aata hai:
  counts       -> needs review / verified / returned / escalated / decided
  pending[]    -> review ke liye pending rows (scope ke andar)
  products[]   -> assigned loan products
  modules[]    -> assigned modules (customers / franchises)
  permissions  -> server-side granted capabilities
==========================================
*/

export type SupervisorScope = "loans" | "modules" | "both" | "all" | null;

export interface SupervisorCounts {
  pending: number;
  verified: number;
  returned: number;
  escalated: number;
  decided: number;
}

export interface SupervisorStats {
  scope: SupervisorScope;
  modules: Array<"customers" | "franchises">;
  products: AdminActivityProduct[];
  permissions: AdminPermission[];
  windowDays: number;
  totalUpdates: number;
  counts: SupervisorCounts;
  pendingTotal: number;
  pending: AdminActivityUpdate[];
  admins: AdminActivityAdmin[];
  lastActivityAt: string | null;
  generatedAt: string;
}

interface RawSupervisor {
  scope?: unknown;
  modules?: unknown;
  products?: Array<Record<string, unknown>>;
  permissions?: unknown;
  windowDays?: unknown;
  totalUpdates?: unknown;
  counts?: Record<string, unknown>;
  pendingTotal?: unknown;
  pending?: Array<Record<string, unknown>>;
  admins?: Array<Record<string, unknown>>;
  lastActivityAt?: unknown;
  generatedAt?: unknown;
}

const asString = (value: unknown): string =>
  typeof value === "string" ? value : "";

const asNumber = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const asCount = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;

const toCounts = (raw: Record<string, unknown> | undefined): SupervisorCounts => ({
  pending: asCount(raw?.pending),
  verified: asCount(raw?.verified),
  returned: asCount(raw?.returned),
  escalated: asCount(raw?.escalated),
  decided: asCount(raw?.decided),
});

const toProduct = (raw: Record<string, unknown>): AdminActivityProduct => ({
  key: asString(raw.key),
  slug: asString(raw.slug),
  label: asString(raw.label) || "Loan product",
  total: asNumber(raw.total),
});

const toAdmin = (raw: Record<string, unknown>): AdminActivityAdmin => ({
  id: asString(raw.id),
  name: asString(raw.name) || "Admin",
  email: asString(raw.email),
  loginId: asString(raw.loginId),
  role: asString(raw.role) || "Admin",
  total: asNumber(raw.total),
});

/** Pending rows backend se `updateId` ke naam se aate hain, UI `id` use karta hai. */
const toPendingUpdate = (raw: Record<string, unknown>): AdminActivityUpdate => ({
  id: asString(raw.updateId) || asString(raw.id),
  applicationId: asString(raw.applicationId),
  ...(raw.entity === "customer" || raw.entity === "franchise"
    ? { entity: raw.entity, entityId: asString(raw.entityId) || asString(raw.applicationId) }
    : {}),
  productKey: asString(raw.productKey),
  slug: asString(raw.slug),
  label: asString(raw.label) || "Record",
  customerName: asString(raw.customerName),
  mobile: asString(raw.mobile),
  applicationNo: typeof raw.applicationNo === "string" ? raw.applicationNo : null,
  loanStatus: asString(raw.loanStatus) || "Submitted",
  loanAmount: typeof raw.loanAmount === "number" ? raw.loanAmount : null,
  text: asString(raw.text),
  kind:
    raw.kind === "recommendation" || raw.kind === "status"
      ? (raw.kind as AdminActivityKind)
      : "note",
  suggestedStatus: typeof raw.suggestedStatus === "string" ? raw.suggestedStatus : null,
  adminId: typeof raw.adminId === "string" ? raw.adminId : null,
  adminName: asString(raw.adminName) || "Admin",
  adminRole: asString(raw.adminRole),
  addedAt: asString(raw.addedAt),
});

const toScope = (value: unknown): SupervisorScope => {
  if (value === "loans" || value === "modules" || value === "both" || value === "all") {
    return value;
  }
  return null;
};

const toModules = (value: unknown): Array<"customers" | "franchises"> => {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is "customers" | "franchises" =>
      entry === "customers" || entry === "franchises"
  );
};

export const getSupervisorStats = async (): Promise<SupervisorStats> => {
  const { data } = await axiosInstance.get<{
    stats?: { dashboardMode?: string; supervisor?: RawSupervisor };
  }>("/dashboard/stats");

  const stats = data.stats;
  const supervisor = stats?.supervisor;
  if (stats?.dashboardMode !== "supervisor" || !supervisor) {
    throw new Error("Supervisor dashboard is not available for this account.");
  }

  return {
    scope: toScope(supervisor.scope),
    modules: toModules(supervisor.modules),
    products: (supervisor.products ?? []).map(toProduct),
    permissions: Array.isArray(supervisor.permissions)
      ? supervisor.permissions.filter(
          (entry): entry is AdminPermission => typeof entry === "string"
        )
      : [],
    windowDays: asNumber(supervisor.windowDays),
    totalUpdates: asNumber(supervisor.totalUpdates),
    counts: toCounts(supervisor.counts),
    pendingTotal: asNumber(supervisor.pendingTotal),
    pending: (supervisor.pending ?? []).map(toPendingUpdate),
    admins: (supervisor.admins ?? []).map(toAdmin),
    lastActivityAt:
      typeof supervisor.lastActivityAt === "string" ? supervisor.lastActivityAt : null,
    generatedAt: asString(supervisor.generatedAt),
  };
};
