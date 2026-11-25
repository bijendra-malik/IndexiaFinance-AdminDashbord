import type { AdminRole, LoanAccess, ModuleAccess } from "../api/adminUsers";

/**
 * Whose dashboard is open, as spelled in the URL.
 *
 * Ek hi `/dashboard` sabke liye tha, isliye URL dekh kar pata nahi chalta tha ki
 * super admin ka dashboard khula hai ya uske banaye sub admin / admin ka. Ab
 * scope URL ka hissa hai:
 *
 *   /dashboard                    super admin
 *   /dashboard/sub-admin          sub admin (jise super admin ne assign kiya)
 *   /dashboard/admin              normal admin
 *   /dashboard/customer           customer module wala admin
 *   /dashboard/franchise          franchise module wala admin
 *   /dashboard/loan-applications  loan products wala admin
 */
export type DashboardScope =
  | "super-admin"
  | "sub-admin"
  | "admin"
  | "customer"
  | "franchise"
  | "loan-applications";

export interface DashboardScopeMeta {
  /** Page title / hero label: "Sub admin dashboard". */
  label: string;
  /** Hero ke neeche chhoti line — is dashboard ke numbers kiska kaam hain. */
  owner: string;
  /** The one URL for this scope. */
  path: string;
}

export const DASHBOARD_SCOPE_META: Record<DashboardScope, DashboardScopeMeta> = {
  "super-admin": {
    label: "Super admin dashboard",
    owner: "the whole organisation",
    path: "/dashboard",
  },
  "sub-admin": {
    label: "Sub admin dashboard",
    owner: "the team you supervise",
    path: "/dashboard/sub-admin",
  },
  admin: {
    label: "Admin dashboard",
    owner: "the records assigned to you",
    path: "/dashboard/admin",
  },
  customer: {
    label: "Customer dashboard",
    owner: "customer accounts",
    path: "/dashboard/customer",
  },
  franchise: {
    label: "Franchise admin dashboard",
    owner: "the franchise network",
    path: "/dashboard/franchise",
  },
  "loan-applications": {
    label: "Loan applications dashboard",
    owner: "loan applications",
    path: "/dashboard/loan-applications",
  },
};

/** Hand-typed / older segments that must still resolve to the same dashboard. */
const SCOPE_ALIASES: Record<string, DashboardScope> = {
  "super-admin": "super-admin",
  superadmin: "super-admin",
  "sub-admin": "sub-admin",
  subadmin: "sub-admin",
  admin: "admin",
  customer: "customer",
  customers: "customer",
  franchise: "franchise",
  franchises: "franchise",
  "loan-application": "loan-applications",
  "loan-applications": "loan-applications",
  loans: "loan-applications",
};

export const parseDashboardScope = (segment?: string | null): DashboardScope | null => {
  if (!segment) return null;
  return SCOPE_ALIASES[segment.trim().toLowerCase()] ?? null;
};

export const dashboardPathForScope = (scope: DashboardScope): string =>
  DASHBOARD_SCOPE_META[scope].path;

/**
 * Kaam ka URL base — hamesha `/dashboard/<scope>`. Har nested page isi ke andar
 * hota hai, is liye super admin (jiska dashboard `/dashboard` hai) ke links bhi
 * `/dashboard/super-admin/...` se shuru hote hain.
 */
export const workspacePathForScope = (scope: DashboardScope): string =>
  `/dashboard/${scope}`;

/**
 * Which dashboard a signed-in account owns.
 *
 * Role decides the top of the tree — super admin ka plain `/dashboard` hi rehta
 * hai. Normal admin ka URL wahi slice batata hai jo super admin ne assign kiya:
 * sirf customers, sirf franchises, ya uske loan products.
 */
export const dashboardScopeFor = ({
  role,
  moduleAccess,
  loanAccess,
}: {
  role: AdminRole;
  moduleAccess: ModuleAccess;
  loanAccess: LoanAccess;
}): DashboardScope => {
  if (role === "super_admin") return "super-admin";
  if (role === "sub_admin") return "sub-admin";

  const modules = moduleAccess === "all" ? [] : moduleAccess;
  if (modules.length === 1) return modules[0] === "customers" ? "customer" : "franchise";
  if (modules.length === 0 && (loanAccess === "all" || loanAccess.length > 0)) {
    return "loan-applications";
  }
  return "admin";
};

export const dashboardPathFor = (args: {
  role: AdminRole;
  moduleAccess: ModuleAccess;
  loanAccess: LoanAccess;
}): string => dashboardPathForScope(dashboardScopeFor(args));
