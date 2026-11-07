import type { AdminPermission } from "../constants/adminPermissions";
import type { AdminRole } from "./adminUsers";

/*
==========================================
Sub-admin review state (local until the API exists)

Super admin ka aaj ka flow: admin ka note/recommendation padho, phir record
khol kar decision lo. Sub admin uske aage ek quality-check layer lagata hai:
Verify / Return / Escalate / Decide. Backend me abhi ye fields nahi hain, aur
admin directory bhi local fallback par chalti hai — isliye review state bhi
usi tarah is browser me store hota hai (`loan_admin_reviews_v1`).

Key update ki identity par banti hai (entity + applicationId + update id), isliye
page reload / re-fetch par wahi row wahi state dikhati hai. Backend jab ready
ho, sirf in functions ke andar network call lagani hai — UI same rahega.
==========================================
*/

export type ReviewState = "pending" | "verified" | "returned" | "escalated" | "decided";

export interface ReviewRecord {
  key: string;
  state: ReviewState;
  note: string;
  /** Reviewer's sign-in email — same identity the rest of the app uses. */
  reviewedBy: string;
  reviewedByName: string;
  reviewedByRole: AdminRole | string;
  reviewedAt: string;
}

export interface ReviewTarget {
  id: string;
  applicationId?: string;
  entity?: string;
  addedAt?: string;
}

const REVIEWS_KEY = "loan_admin_reviews_v1";

/** Stable per-update key: two products can share an update id. */
export const reviewKey = (target: ReviewTarget): string =>
  [target.entity ?? "loan", target.applicationId ?? "", target.id || target.addedAt || ""].join(":");

const readAll = (): Record<string, ReviewRecord> => {
  try {
    const raw = localStorage.getItem(REVIEWS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ReviewRecord>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeAll = (records: Record<string, ReviewRecord>): void => {
  try {
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(records));
  } catch {
    /* quota / private mode — the current session still shows the result */
  }
};

export const readReviews = (): Record<string, ReviewRecord> => readAll();

export const writeReview = (record: ReviewRecord): Record<string, ReviewRecord> => {
  const records = readAll();
  records[record.key] = record;
  writeAll(records);
  return records;
};

export const clearReview = (key: string): Record<string, ReviewRecord> => {
  const records = readAll();
  delete records[key];
  writeAll(records);
  return records;
};

export const REVIEW_STATE_META: Record<
  ReviewState,
  { label: string; chip: string; dot: string; accent: string }
> = {
  pending: {
    label: "Needs review",
    chip: "bg-amber-50 text-amber-700 ring-amber-200/70",
    dot: "bg-amber-500",
    accent: "border-l-amber-400",
  },
  verified: {
    label: "Verified",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
    dot: "bg-emerald-500",
    accent: "border-l-emerald-400",
  },
  returned: {
    label: "Returned",
    chip: "bg-rose-50 text-rose-600 ring-rose-200/70",
    dot: "bg-rose-500",
    accent: "border-l-rose-400",
  },
  escalated: {
    label: "Escalated",
    chip: "bg-sky-50 text-sky-700 ring-sky-200/70",
    dot: "bg-sky-500",
    accent: "border-l-sky-400",
  },
  decided: {
    label: "Decision recorded",
    chip: "bg-indigo-50 text-indigo-700 ring-indigo-200/70",
    dot: "bg-indigo-500",
    accent: "border-l-indigo-400",
  },
};

/** Reviewer actions, each guarded by the capability that unlocks it. */
export const REVIEW_ACTIONS: Array<{
  state: ReviewState;
  permission: AdminPermission;
  label: string;
  hint: string;
  requireNote: boolean;
}> = [
  {
    state: "verified",
    permission: "updates.review",
    label: "Verify",
    hint: "Kaam sahi hai — apna verification note chhodo.",
    requireNote: false,
  },
  {
    state: "returned",
    permission: "updates.return",
    label: "Return for correction",
    hint: "Admin ko wapas bhejo — wajah likhna zaroori hai.",
    requireNote: true,
  },
  {
    state: "escalated",
    permission: "updates.escalate",
    label: "Escalate",
    hint: "Super admin ke decision ke liye bhejo — summary likho.",
    requireNote: true,
  },
  {
    state: "decided",
    permission: "loans.decide",
    label: "Record decision",
    hint: "Sirf tab jab super admin ne final call de di ho.",
    requireNote: true,
  },
];
