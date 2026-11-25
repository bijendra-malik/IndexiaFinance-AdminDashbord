import type { AdminRole, ModuleAccess } from "../api/adminUsers";

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
 *
 * Sirf loan products wala admin bhi `/dashboard/admin` hi hai — uske products
 * named URLs par khulte hain (`/dashboard/admin/personalloan`). "loan-applications"
 * naam ka koi alag dashboard URL nahi hai.
 */
export type DashboardScope =
  | "super-admin"
  | "sub-admin"
  | "admin"
  | "customer"
  | "franchise";

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
 * sirf customers, sirf franchises, ya baaki sab (loan products) `/dashboard/admin`.
 */
export const dashboardScopeFor = ({
  role,
  moduleAccess,
}: {
  role: AdminRole;
  moduleAccess: ModuleAccess;
}): DashboardScope => {
  if (role === "super_admin") return "super-admin";
  if (role === "sub_admin") return "sub-admin";

  const modules = moduleAccess === "all" ? [] : moduleAccess;
  if (modules.length === 1) return modules[0] === "customers" ? "customer" : "franchise";
  /*
  Sirf loan products wala admin — uske liye alag scope nahi. Wo `/dashboard/admin`
  par rehta hai, aur uske products `/dashboard/admin/<loan-name>` par khulte hain.
  */
  return "admin";
};

export const dashboardPathFor = (args: {
  role: AdminRole;
  moduleAccess: ModuleAccess;
}): string => dashboardPathForScope(dashboardScopeFor(args));
