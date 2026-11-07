/*
==========================================
Sub-admin capability catalogue

Sub admin ek supervisor hai, regular admin nahi. Uske paas sirf wahi kaam
hote hain jo super admin ne tick kiye — role sirf "kaun hai" batata hai,
permission batati hai "kya kar sakta hai". Isliye capability list ek hi jagah
rakhi gayi hai: Team & Access ka checkbox, sidebar gating aur review actions
sab yahi definition padhte hain.
==========================================
*/

export type AdminPermission =
  | "updates.view"
  | "updates.review"
  | "updates.return"
  | "updates.escalate"
  | "admins.view"
  | "loans.decide";

/**
 * Sub admin ka scope wahi do categories hain jo regular admin ka access hota hai:
 * Loan products YA Customers/Franchises. Har permission in dono me se kahan
 * lagti hai, wo yahan likha hai — form, list aur guards sab yahi padhte hain.
 */
export type PermissionScope = "loans" | "modules";

/** `both` = dono scope par lagne wali review capability. */
export type PermissionScopeTarget = PermissionScope | "both";

export const SCOPE_META: Record<
  PermissionScope,
  { label: string; hint: string; permissionHint: string }
> = {
  loans: {
    label: "Loan products",
    hint: "Assigned products ki loan applications",
    permissionHint: "In products ki loan applications par admin ka kaam review hoga.",
  },
  modules: {
    label: "Customers & Franchises",
    hint: "Customer aur franchise records",
    permissionHint: "Customer / franchise records par admin ka kaam review hoga.",
  },
};

export const scopeLabel = (scope: PermissionScope): string => SCOPE_META[scope].label;

export interface AdminPermissionDef {
  key: AdminPermission;
  label: string;
  description: string;
  group: "Review workflow" | "Oversight";
  /** Kis scope par ye capability milti hai. */
  scope: PermissionScopeTarget;
}

export const ADMIN_PERMISSION_DEFS: AdminPermissionDef[] = [
  {
    key: "updates.view",
    label: "View admin updates",
    description: "Regular admins ke notes aur recommendations, apne scope me.",
    group: "Review workflow",
    scope: "both",
  },
  {
    key: "updates.review",
    label: "Mark reviewed",
    description: "Update ko verify karke apna note chhodna.",
    group: "Review workflow",
    scope: "both",
  },
  {
    key: "updates.return",
    label: "Return for correction",
    description: "Ghalat / adhoora kaam admin ko wapas bhejna, wajah ke saath.",
    group: "Review workflow",
    scope: "both",
  },
  {
    key: "updates.escalate",
    label: "Escalate to super admin",
    description: "Risky ya high-value case super admin ke decision ke liye bhejna.",
    group: "Review workflow",
    scope: "both",
  },
  {
    key: "admins.view",
    label: "View admin details",
    description: "Scope ke regular admins ki profile, access aur workload dekhna (read-only).",
    group: "Oversight",
    scope: "both",
  },
  {
    key: "loans.decide",
    label: "Record final decision",
    description: "Loan application par final call record karna — sirf loan scope me.",
    group: "Oversight",
    scope: "loans",
  },
];

export const ALL_ADMIN_PERMISSIONS: AdminPermission[] = ADMIN_PERMISSION_DEFS.map(
  (permission) => permission.key
);

const DEF_BY_KEY = new Map<AdminPermission, AdminPermissionDef>(
  ADMIN_PERMISSION_DEFS.map((permission) => [permission.key, permission])
);

/** Ye permission is scope par lagti hai? (`both` wali dono par lagti hai.) */
export const appliesToScope = (key: AdminPermission, scope: PermissionScope): boolean => {
  const def = DEF_BY_KEY.get(key);
  return !!def && (def.scope === "both" || def.scope === scope);
};

/** Form me sirf wahi permissions dikhengi jo chune hue scope par lagti hain. */
export const permissionsForScope = (scope: PermissionScope): AdminPermissionDef[] =>
  ADMIN_PERMISSION_DEFS.filter(
    (permission) => permission.scope === "both" || permission.scope === scope
  );

/** Granted list ko scope tak seemit karo — doosre scope ki permission hata do. */
export const filterPermissionsForScope = (
  permissions: AdminPermission[],
  scope: PermissionScope
): AdminPermission[] => permissions.filter((key) => appliesToScope(key, scope));

/** Scope ke hisaab se default review-loop permission (final decision kabhi default nahi). */
export const defaultPermissionsForScope = (scope: PermissionScope): AdminPermission[] =>
  DEFAULT_SUB_ADMIN_PERMISSIONS.filter((key) => appliesToScope(key, scope));

const VALID_PERMISSIONS = new Set<string>(ALL_ADMIN_PERMISSIONS);

/** A brand-new sub admin starts with the review loop, never with final decisions. */
export const DEFAULT_SUB_ADMIN_PERMISSIONS: AdminPermission[] = [
  "updates.view",
  "updates.review",
  "updates.return",
  "updates.escalate",
];


/** Drops unknown / duplicate keys so a bad payload can never widen access. */
export const normalizePermissions = (value: unknown): AdminPermission[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((entry): entry is AdminPermission => {
    if (typeof entry !== "string" || !VALID_PERMISSIONS.has(entry) || seen.has(entry)) return false;
    seen.add(entry);
    return true;
  });
};

export const permissionLabel = (key: AdminPermission): string =>
  ADMIN_PERMISSION_DEFS.find((permission) => permission.key === key)?.label ?? key;

export const permissionShortLabel = (key: AdminPermission): string => {
  switch (key) {
    case "updates.view":
      return "View updates";
    case "updates.review":
      return "Review";
    case "updates.return":
      return "Return";
    case "updates.escalate":
      return "Escalate";
    case "admins.view":
      return "Admins";
    case "loans.decide":
      return "Decide";
    default:
      return key;
  }
};

/** True when the granted list holds the permission (super admin passes "all"). */
export const hasPermission = (
  permissions: AdminPermission[] | "all" | undefined,
  key: AdminPermission
): boolean => (permissions === "all" ? true : (permissions ?? []).includes(key));
