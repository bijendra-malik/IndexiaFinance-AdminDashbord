import axiosInstance from "./axiosInstance";
import type { AdminPermission } from "../constants/adminPermissions";
import type { AdminRole } from "./adminUsers";

/*
==========================================
Sub-admin review state

Super admin ka aaj ka flow: admin ka note/recommendation padho, phir record
khol kar decision lo. Sub admin uske aage ek quality-check layer lagata hai:
Verify / Return / Escalate / Decide. Ye state backend (`/reviews`) me save hoti
hai, isliye supervisor ka kaam device badalne par bhi wahi rehta hai.

Key update ki identity par banti hai (entity + applicationId + update id), isliye
page reload / re-fetch par wahi row wahi state dikhati hai. Browser ka
`loan_admin_reviews_v1` cache sirf offline fallback hai.
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

const isReviewState = (value: unknown): value is ReviewState =>
  value === "pending" ||
  value === "verified" ||
  value === "returned" ||
  value === "escalated" ||
  value === "decided";

interface RawReview {
  key?: string;
  state?: string;
  note?: string;
  reviewedByName?: string;
  reviewedByRole?: string;
  reviewedAt?: string;
}

const fromRaw = (raw: unknown): ReviewRecord | null => {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as RawReview;
  if (!row.key || !isReviewState(row.state)) return null;
  return {
    key: row.key,
    state: row.state,
    note: row.note ?? "",
    reviewedBy: "",
    reviewedByName: row.reviewedByName ?? "",
    reviewedByRole: row.reviewedByRole ?? "",
    reviewedAt: row.reviewedAt ?? "",
  };
};

/** Network hi nahi (server down / offline) — tab local cache par kaam chalta hai. */
const isOffline = (error: unknown): boolean =>
  !(error as { response?: unknown })?.response;

/**
 * Backend review state (`GET /reviews`). Ye ab source of truth hai; local cache
 * sirf offline fallback hai. Purana behaviour — browser me state save karna —
 * supervisor ke doosre device par gum ho jaata tha.
 */
export const fetchReviews = async (): Promise<Record<string, ReviewRecord>> => {
  try {
    const { data } = await axiosInstance.get<{ reviews?: unknown[] }>("/reviews", {
      params: { limit: 500 },
    });
    const remote: Record<string, ReviewRecord> = {};
    (Array.isArray(data.reviews) ? data.reviews : []).forEach((row) => {
      const record = fromRaw(row);
      if (record) remote[record.key] = record;
    });
    writeAll(remote);
    return remote;
  } catch {
    return readAll();
  }
};

export interface ReviewTargetMeta {
  entity?: string;
  applicationId?: string;
  updateId?: string;
  slug?: string;
  updateAdminId?: string | null;
  updateAdminName?: string;
}

/**
 * Save a review. Success par backend record local cache me mirror hota hai;
 * sirf offline hone par local record banta hai. 403/400 error upar jaata hai
 * taaki UI galat "saved" na dikhaye.
 */
export const writeReview = async (
  record: ReviewRecord,
  meta: ReviewTargetMeta = {}
): Promise<Record<string, ReviewRecord>> => {
  const [entity, applicationId, updateId] = record.key.split(":");
  try {
    const { data } = await axiosInstance.post<{ review?: unknown }>("/reviews", {
      entity: meta.entity ?? entity,
      applicationId: meta.applicationId ?? applicationId,
      updateId: meta.updateId ?? updateId,
      slug: meta.slug ?? "",
      ...(meta.updateAdminId ? { updateAdminId: meta.updateAdminId } : {}),
      /*
      `updateAdminName` us admin ka hai jiska update review ho raha hai — reviewer
      ka naam nahi. Pehle yahan `record.reviewedByName` fallback tha, jisse backend
      ka self-review check galat admin par lag sakta tha.
      */
      ...(meta.updateAdminName ? { updateAdminName: meta.updateAdminName } : {}),
      state: record.state,
      note: record.note,
    });

    const saved = fromRaw(data.review);
    const records = readAll();
    records[record.key] = saved
      ? { ...record, ...saved, reviewedBy: record.reviewedBy }
      : record;
    writeAll(records);
    return records;
  } catch (error) {
    if (!isOffline(error)) throw error;
    const records = readAll();
    records[record.key] = record;
    writeAll(records);
    return records;
  }
};

export const clearReview = async (key: string): Promise<Record<string, ReviewRecord>> => {
  try {
    await axiosInstance.delete(`/reviews/${encodeURIComponent(key)}`);
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    // 404 = pehle se clear hai; offline me local hi clear karte hain.
    if (status !== undefined && status !== 404) throw error;
  }

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
