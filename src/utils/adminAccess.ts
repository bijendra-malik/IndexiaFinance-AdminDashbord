import { LOAN_TYPES, type LoanTypeDef, type LoanTypeSlug } from "../constants/loanTypes";
import type { AdminRole, LoanAccess, ManagedAdmin } from "../api/adminUsers";

/** The sign-in handle that always keeps super-admin rights. */
export const DEFAULT_SUPER_ADMIN_LOGIN = "admin01";

export const ALL_LOAN_SLUGS: LoanTypeSlug[] = LOAN_TYPES.map((loan) => loan.slug);

const VALID_SLUGS = new Set<string>(ALL_LOAN_SLUGS);

/** Drops unknown / duplicate slugs so a bad payload can never widen access. */
export const normalizeLoanAccess = (value: unknown): LoanAccess => {
  if (value === "all") return "all";
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((entry): entry is LoanTypeSlug => {
    if (typeof entry !== "string" || !VALID_SLUGS.has(entry) || seen.has(entry)) return false;
    seen.add(entry);
    return true;
  });
};

export const canAccessLoan = (access: LoanAccess, slug?: string): boolean => {
  if (!slug) return false;
  if (access === "all") return true;
  return access.includes(slug as LoanTypeSlug);
};

export const loanTypesFor = (access: LoanAccess): LoanTypeDef[] =>
  access === "all"
    ? LOAN_TYPES
    : LOAN_TYPES.filter((loan) => access.includes(loan.slug));

/** Local part of an email, which doubles as the default login handle. */
export const loginHandle = (email?: string | null): string =>
  (email ?? "").trim().toLowerCase().split("@")[0];

export interface SignedInAdmin {
  email?: string;
  role?: string;
  loginId?: string;
  loanAccess?: unknown;
}

/** Directory entry for the signed-in admin, matched by email or login handle. */
export const findAccessRecord = (
  admins: ManagedAdmin[],
  admin: SignedInAdmin | null
): ManagedAdmin | null => {
  if (!admin) return null;
  const email = (admin.email ?? "").trim().toLowerCase();
  const handle = (admin.loginId ?? loginHandle(admin.email)).trim().toLowerCase();
  if (!email) return null;
  return (
    admins.find(
      (record) =>
        record.email.toLowerCase() === email ||
        (handle && record.loginId.toLowerCase() === handle)
    ) ?? null
  );
};

/**
 * Super-admin resolution.
 *
 * Backend role pehle aata hai, kyunki wahi shared truth hai: super admin ne
 * jise `admin` banaya wo har browser me restricted hi rehna chahiye. Local
 * team-directory sirf tab dekhi jaati hai jab backend role pata hi na ho
 * (purana backend) — pehle yahan ulta hota tha, aur khaali directory par
 * "first run" maan kar HAR naya admin super admin ban jaata tha. Isi wajah se
 * restricted admin ko Customers / Masters / Franchise / Team sections dikh
 * rahe the.
 */
export const isSuperAdminSession = (
  admins: ManagedAdmin[],
  admin: SignedInAdmin | null
): boolean => {
  if (!admin) return false;

  const backendRole = (admin.role ?? "").trim();
  if (/super/i.test(backendRole)) return true;
  // Backend clearly says "Admin" — no local record can widen that.
  if (/^admin$/i.test(backendRole)) return false;

  // Backend role missing (legacy API): fall back to the local directory.
  const record = findAccessRecord(admins, admin);
  if (record) return record.role === "super_admin";
  if (loginHandle(admin.email) === DEFAULT_SUPER_ADMIN_LOGIN) return true;
  if ((admin.loginId ?? "").trim().toLowerCase() === DEFAULT_SUPER_ADMIN_LOGIN) return true;
  return admins.length === 0;
};

export const resolveRole = (isSuper: boolean): AdminRole =>
  isSuper ? "super_admin" : "admin";

/** Super admins always see every loan; everyone else gets their assignment. */
export const resolveLoanAccess = (
  admins: ManagedAdmin[],
  admin: SignedInAdmin | null,
  isSuper: boolean
): LoanAccess => {
  if (isSuper) return "all";

  /*
  Backend field pehle — super admin ne access badla to wo server par save hota
  hai aur har browser me same rehna chahiye. Local directory sirf fallback hai
  (jab backend loanAccess bhejta hi nahi).

  Kuch bhi na mile to khaali list: access dena super admin ka kaam hai, isliye
  default "sab kuch" nahi ho sakta.
  */
  if (admin?.loanAccess !== undefined) return normalizeLoanAccess(admin.loanAccess);
  const record = findAccessRecord(admins, admin);
  if (record) return normalizeLoanAccess(record.loanAccess);

  return [];
};
