/*
==========================================
"Ye admin actually kya kar sakta hai?"

Super admin ko tick-boxes nahi, result samajhna chahiye. Isliye one-line plain
sentence ek hi jagah banti hai — Team & Access ki table, admin detail card aur
create/edit wizard teeno yahi function padhte hain, taaki wording kabhi
mismatch na ho.
==========================================
*/

import { LOAN_TYPES, getLoanTypeLabel } from "../constants/loanTypes";
import type { AdminPermission } from "../constants/adminPermissions";
import type { AdminRole, LoanAccess, ModuleAccess, ModuleKey } from "../api/adminUsers";

export interface AccessShape {
  role: AdminRole;
  loanAccess: LoanAccess;
  moduleAccess?: ModuleAccess;
  permissions?: AdminPermission[];
}

const MODULE_LABEL: Record<ModuleKey, string> = {
  customers: "Customers",
  franchises: "Franchises",
};

export const ROLE_LABEL: Record<AdminRole, string> = {
  super_admin: "Super admin",
  sub_admin: "Sub admin",
  admin: "Normal admin",
};

/** Ek hi jagah role ka display name — "Admin" kabhi bare label me na dikhe. */
export const roleLabel = (role: AdminRole): string => ROLE_LABEL[role];

/** `"all"` = har product; warna wahi slugs jo assign hue hain. */
const loanSlugsOf = (access: LoanAccess): string[] =>
  access === "all" ? LOAN_TYPES.map((loan) => loan.slug) : [...access];

const moduleKeysOf = (access?: ModuleAccess): ModuleKey[] =>
  access === "all" ? ["customers", "franchises"] : [...(access ?? [])];

/** "A, B and C" — poora list, bina truncate (sentence ke liye). */
const joinNatural = (items: string[]): string => {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
};

/**
 * Scope ke liye: 4 tak poora list, usse zyada ho to "A, B, C +4 more" — table
 * cell me line nahi tootegi.
 */
const listPhrase = (items: string[]): string =>
  items.length <= 4 ? joinNatural(items) : `${items.slice(0, 3).join(", ")} +${items.length - 3} more`;

/** Table ke "Scope" column ke chips: loans + modules ek saath. */
export const scopeChips = (access: AccessShape): string[] => {
  if (access.role === "super_admin") return [];
  return [
    ...loanSlugsOf(access.loanAccess).map(getLoanTypeLabel),
    ...moduleKeysOf(access.moduleAccess).map((key) => MODULE_LABEL[key]),
  ];
};

/** Scope ka readable phrase — ek hi list me loans + modules, sentence ke liye. */
const scopePhrase = (access: AccessShape): string => {
  const loans = loanSlugsOf(access.loanAccess).map(getLoanTypeLabel);
  const modules = moduleKeysOf(access.moduleAccess).map((key) => MODULE_LABEL[key]);
  const items =
    loans.length === LOAN_TYPES.length ? [`all ${LOAN_TYPES.length} loan products`, ...modules] : [...loans, ...modules];
  return listPhrase(items);
};

const PERMISSION_PHRASE: Array<{ key: AdminPermission; phrase: string }> = [
  { key: "updates.view", phrase: "view updates" },
  { key: "updates.review", phrase: "mark updates reviewed" },
  { key: "updates.return", phrase: "return for correction" },
  { key: "updates.escalate", phrase: "escalate cases" },
  { key: "admins.view", phrase: "view admin details" },
  { key: "contacts.manage", phrase: "handle enquiries" },
  { key: "loans.decide", phrase: "record final decisions" },
];

/**
 * Ek line me poora access. Table, detail card aur wizard summary — sab yahi
 * dikhate hain, isliye super admin ko permissions ke naam yaad rakhne ki
 * zaroorat nahi padti.
 */
export const accessSummary = (access: AccessShape): string => {
  if (access.role === "super_admin") {
    return `Full access — all ${LOAN_TYPES.length} loan products, Customers and Franchises, the review queue and team management.`;
  }

  const scope = scopePhrase(access);

  if (!scope) return "No scope assigned — this admin cannot open any work.";

  if (access.role === "admin") {
    // Loan-only admin "applications" dekhta hai, module-only admin "records" —
    // wording dono jagah sahi rehni chahiye.
    const workUnit = loanSlugsOf(access.loanAccess).length > 0 ? "applications" : "records";
    return `Works on ${scope}. Can view ${workUnit}, add notes, verification and recommendations. Cannot record the final decision.`;
  }

  const granted = access.permissions ?? [];
  const abilities = PERMISSION_PHRASE.filter((entry) => granted.includes(entry.key)).map(
    (entry) => entry.phrase
  );

  if (abilities.length === 0) {
    return `Assigned to ${scope}. No permissions granted — cannot do any work yet.`;
  }

  const closing = granted.includes("loans.decide")
    ? ""
    : " Cannot record the final decision.";
  return `Reviews ${scope}. Can ${joinNatural(abilities)}.${closing}`;
};
