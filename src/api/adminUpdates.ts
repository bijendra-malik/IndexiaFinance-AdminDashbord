/**
 * Shared types and helpers for admin updates on entities (customers, loans, etc.)
 */

export type AdminUpdateTag = "verification" | "correction" | "flag" | "escalation" | "status" | "note";

export interface EntityAdminUpdate {
  _id?: string;
  text: string;
  tag?: AdminUpdateTag;
  addedBy?: string | null;
  addedByName?: string;
  addedByRole?: string;
  addedAt?: string;
}

/**
 * Transform raw backend data into typed admin updates array
 */
export const toEntityUpdates = (value: unknown): EntityAdminUpdate[] | undefined => {
  if (!value) return undefined;
  
  const items = Array.isArray(value) ? value : [value];
  const updates: EntityAdminUpdate[] = [];
  
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    
    const raw = item as Record<string, unknown>;
    const text = typeof raw.text === "string" ? raw.text : "";
    if (!text) continue;
    
    updates.push({
      _id: typeof raw._id === "string" ? raw._id : undefined,
      text,
      tag: isValidTag(raw.tag) ? raw.tag : undefined,
      addedBy: typeof raw.addedBy === "string" ? raw.addedBy : null,
      addedByName: typeof raw.addedByName === "string" ? raw.addedByName : undefined,
      addedByRole: typeof raw.addedByRole === "string" ? raw.addedByRole : undefined,
      addedAt: typeof raw.addedAt === "string" ? raw.addedAt : undefined,
    });
  }
  
  return updates.length > 0 ? updates : undefined;
};

const isValidTag = (value: unknown): value is AdminUpdateTag => {
  return (
    value === "verification" ||
    value === "correction" ||
    value === "flag" ||
    value === "escalation" ||
    value === "status" ||
    value === "note"
  );
};
