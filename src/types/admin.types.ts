/**
 * Shared types for admin operations, updates, and recommendations
 * 
 * Used across:
 * - Customer admin updates
 * - Loan application admin updates
 * - Franchise admin updates
 * - Admin activity feed
 */

// ── Admin Update Types ───────────────────────────────────────────────────────

/**
 * Type of admin update entry
 * - note: General remark or comment
 * - recommendation: Status change suggestion by regular admin
 * - status: Status change log entry (system-generated)
 */
export type AdminUpdateKind = "note" | "recommendation" | "status";

/**
 * Admin update entry on any entity (customer, loan application, franchise)
 * Regular admins can add notes and recommendations
 * Super admins see all updates and take final decisions
 */
export interface AdminUpdate {
  _id?: string;
  text: string;
  kind?: AdminUpdateKind;
  addedBy?: string | null;
  addedByName?: string;
  addedByRole?: string;
  addedAt?: string;
  /** Suggested status (only for recommendation kind) */
  suggestedStatus?: string | null;
}

// ── Status Recommendation ────────────────────────────────────────────────────

/**
 * Latest status recommendation by a regular admin
 * Super admin uses this to make the final decision
 */
export interface StatusRecommendation {
  status: string | null;
  note?: string;
  recommendedBy?: string | null;
  recommendedByName?: string;
  recommendedByRole?: string;
  recommendedAt?: string | null;
}

// ── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Type guard to check if a value is a valid AdminUpdateKind
 */
export const isValidAdminUpdateKind = (value: unknown): value is AdminUpdateKind => {
  return value === "note" || value === "recommendation" || value === "status";
};

/**
 * Parse raw backend adminUpdates array to typed AdminUpdate[]
 * Handles various backend response formats
 * 
 * @param value - Raw data from backend (array or single object)
 * @returns Typed AdminUpdate array or undefined if no valid updates
 * 
 * @example
 * const updates = parseAdminUpdates(response.data.adminUpdates);
 * if (updates) {
 *   console.log(`Found ${updates.length} updates`);
 * }
 */
export const parseAdminUpdates = (value: unknown): AdminUpdate[] | undefined => {
  if (!value) return undefined;
  
  const items = Array.isArray(value) ? value : [value];
  const updates: AdminUpdate[] = [];
  
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    
    const raw = item as Record<string, unknown>;
    const text = typeof raw.text === "string" ? raw.text : "";
    if (!text) continue;
    
    updates.push({
      _id: typeof raw._id === "string" ? raw._id : undefined,
      text,
      kind: isValidAdminUpdateKind(raw.kind) ? raw.kind : "note",
      addedBy: typeof raw.addedBy === "string" ? raw.addedBy : null,
      addedByName: typeof raw.addedByName === "string" ? raw.addedByName : undefined,
      addedByRole: typeof raw.addedByRole === "string" ? raw.addedByRole : undefined,
      addedAt: typeof raw.addedAt === "string" ? raw.addedAt : undefined,
      suggestedStatus: typeof raw.suggestedStatus === "string" ? raw.suggestedStatus : null,
    });
  }
  
  return updates.length > 0 ? updates : undefined;
};
