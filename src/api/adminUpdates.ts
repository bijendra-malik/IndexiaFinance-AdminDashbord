import type { AdminUpdate, StatusRecommendation } from "../types/admin.types";

/*
==========================================
Customer / franchise admin-update trail

Backend loan products jaisa hi pattern deta hai:

  note         -> regular admin ka remark / verification / flag
  recommendation -> regular admin ka suggested final decision
  status       -> super admin ka final decision (automatic entry)

`statusRecommendation` record par latest pending suggestion rakhta hai; decision
lete hi backend usse null kar deta hai.
==========================================
*/

export type EntityKind = "customer" | "franchise";

export const ADMIN_UPDATE_TAG_LABELS: Record<string, string> = {
  verification: "Verification",
  document: "Document check",
  visit: "Field visit",
  correction: "Correction",
  flag: "Flag",
  escalation: "Escalation",
  general: "Note",
};

/** Composer dropdown — sirf wahi categories jo us entity ke liye meaningful hain. */
export const UPDATE_TAGS_BY_ENTITY: Record<EntityKind, string[]> = {
  customer: ["verification", "correction", "flag", "escalation", "general"],
  franchise: ["document", "visit", "verification", "flag", "escalation", "general"],
};

/** Final decision jo regular admin suggest kar sakta hai (aur super admin leta hai). */
export const ENTITY_DECISIONS: Record<EntityKind, string[]> = {
  customer: ["Active", "Inactive"],
  franchise: ["Approved", "Rejected"],
};

export const updateTagLabel = (tag?: string | null) =>
  ADMIN_UPDATE_TAG_LABELS[tag ?? "general"] ?? "Note";

/** Record par pending suggestion (backend decision lete hi null kar deta hai). */
export const toStatusRecommendation = (
  value: unknown
): StatusRecommendation | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.status !== "string" || !raw.status) return null;
  return {
    status: raw.status,
    note: typeof raw.note === "string" ? raw.note : "",
    recommendedBy: typeof raw.recommendedBy === "string" ? raw.recommendedBy : null,
    recommendedByName:
      typeof raw.recommendedByName === "string" ? raw.recommendedByName : "",
    recommendedByRole:
      typeof raw.recommendedByRole === "string" ? raw.recommendedByRole : "",
    recommendedAt: typeof raw.recommendedAt === "string" ? raw.recommendedAt : null,
  };
};

export type { AdminUpdate, StatusRecommendation };
