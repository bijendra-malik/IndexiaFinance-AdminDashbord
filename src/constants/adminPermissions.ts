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
  | "loans.decide"
  | "contacts.manage";

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
    description: "Reads normal admins' notes and recommendations within their scope.",
    group: "Review workflow",
    scope: "both",
  },
  {
    key: "updates.review",
    label: "Mark reviewed",
    description: "Verifies an update and adds their own note.",
    group: "Review workflow",
    scope: "both",
  },
  {
    key: "updates.return",
    label: "Return for correction",
    description: "Sends incorrect or incomplete work back to the admin with a reason.",
    group: "Review workflow",
    scope: "both",
  },
  {
    key: "updates.escalate",
    label: "Escalate to super admin",
    description: "Escalates risky or high-value cases to the super admin.",
    group: "Review workflow",
    scope: "both",
  },
  {
    key: "admins.view",
    label: "View admin details",
    description: "Views the profile, access and workload of admins in this scope (read-only).",
    group: "Oversight",
    scope: "both",
  },
  {
    key: "contacts.manage",
    label: "Handle contact enquiries",
    description:
      "Views website contact enquiries and updates their status or note. Only a super admin can delete them.",
    group: "Oversight",
    scope: "both",
  },
  {
    key: "loans.decide",
    label: "Record final decision",
    description: "Records the final decision on a loan application — loan scope only.",
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

/**
 * Ek admin ke paas dono areas ho sakte hain (loan products + Customers/Franchises).
 * Tab permission valid hai jab wo kisi bhi selected area par lagti ho.
 */
export const appliesToAnyScope = (
  key: AdminPermission,
  scopes: PermissionScope[]
): boolean =>
  scopes.length > 0 && scopes.some((scope) => appliesToScope(key, scope));

/** Selected areas ke liye applicable permission definitions. */
export const permissionsForScopes = (scopes: PermissionScope[]): AdminPermissionDef[] =>
  ADMIN_PERMISSION_DEFS.filter((permission) => appliesToAnyScope(permission.key, scopes));

/** Granted list ko selected areas ke union tak seemit karo. */
export const filterPermissionsForScopes = (
  permissions: AdminPermission[],
  scopes: PermissionScope[]
): AdminPermission[] => permissions.filter((key) => appliesToAnyScope(key, scopes));

/** "Loan products + Customers & Franchises" jaisa readable label. */
export const scopeLabels = (scopes: PermissionScope[]): string =>
  scopes.map((scope) => scopeLabel(scope)).join(" + ");

const VALID_PERMISSIONS = new Set<string>(ALL_ADMIN_PERMISSIONS);

/** A brand-new sub admin starts with the review loop, never with final decisions. */
export const DEFAULT_SUB_ADMIN_PERMISSIONS: AdminPermission[] = [
  "updates.view",
  "updates.review",
  "updates.return",
  "updates.escalate",
];

/*
Sub admin ke permissions ab checkbox jungle nahi, teen preset hain. `Custom`
tab hi khulta hai jab super admin fine-tune karna chahe — isse pehla setup ek
click me ho jaata hai aur galti se final decision on nahi ho jaata.
*/
export type PermissionPresetKey = "view" | "review" | "manage";

export interface PermissionPreset {
  key: PermissionPresetKey;
  label: string;
  description: string;
  permissions: AdminPermission[];
}

export const PERMISSION_PRESETS: PermissionPreset[] = [
  {
    key: "view",
    label: "View only",
    description: "Reads admin updates, takes no action.",
    permissions: ["updates.view"],
  },
  {
    key: "review",
    label: "Can review",
    description: "Verifies work, returns it with a reason, escalates risky cases.",
    permissions: DEFAULT_SUB_ADMIN_PERMISSIONS,
  },
  {
    key: "manage",
    label: "Full oversight",
    description: "Review loop + admin details + contact enquiries + final decision on loans.",
    permissions: [
      ...DEFAULT_SUB_ADMIN_PERMISSIONS,
      "admins.view",
      "loans.decide",
      "contacts.manage",
    ],
  },
];

export const presetPermissionsFor = (
  preset: PermissionPresetKey,
  scopes: PermissionScope[]
): AdminPermission[] =>
  filterPermissionsForScopes(
    PERMISSION_PRESETS.find((entry) => entry.key === preset)?.permissions ?? [],
    scopes
  );

/** Granted permissions kis preset se match karti hain (`custom` jab koi match na ho). */
export const matchPermissionPreset = (
  permissions: AdminPermission[],
  scopes: PermissionScope[]
): PermissionPresetKey | "custom" => {
  const granted = filterPermissionsForScopes(permissions, scopes).sort();
  for (const preset of PERMISSION_PRESETS) {
    const wanted = presetPermissionsFor(preset.key, scopes).sort();
    if (wanted.length === granted.length && wanted.every((key, index) => key === granted[index])) {
      return preset.key;
    }
  }
  return "custom";
};

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
    case "contacts.manage":
      return "Contacts";
    default:
      return key;
  }
};

/** True when the granted list holds the permission (super admin passes "all"). */
export const hasPermission = (
  permissions: AdminPermission[] | "all" | undefined,
  key: AdminPermission
): boolean => (permissions === "all" ? true : (permissions ?? []).includes(key));
