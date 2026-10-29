import axiosInstance from "./axiosInstance";

// ── Types ────────────────────────────────────────────────────────────────────

export type MasterKind = "list" | "grouped" | "unknown";

export interface MasterSummary {
  _id: string;
  type: string;
  label: string;
  kind: MasterKind;
  count: number;
  createdAt: string;
  updatedAt: string;
}

export type MasterListValues = (string | number)[];
export type MasterGroupedValues = Record<string, (string | number)[]>;
export type MasterValues = MasterListValues | MasterGroupedValues;

export interface MasterDetail {
  _id: string;
  type: string;
  label: string;
  values: MasterValues;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMasterPayload {
  type: string;
  label: string;
  values?: MasterValues;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export const isGroupedValues = (values: MasterValues): values is MasterGroupedValues =>
  !Array.isArray(values);

export { getApiErrorMessage } from "../utils/apiError";

// ── Master CRUD ───────────────────────────────────────────────────────────────

/** GET /api/admin/masters — summary list { masters: [{_id, type, label, kind, count}] } */
export const getMasters = async (): Promise<MasterSummary[]> => {
  const res = await axiosInstance.get<{ success?: boolean; masters?: MasterSummary[]; data?: MasterSummary[] }>(
    "/masters"
  );
  if (Array.isArray(res.data)) return res.data as MasterSummary[];
  return res.data?.masters ?? res.data?.data ?? [];
};

/** GET /api/admin/masters/:id — full detail with values */
export const getMaster = async (id: string): Promise<MasterDetail> => {
  const res = await axiosInstance.get<{ success?: boolean; master?: MasterDetail; data?: MasterDetail }>(
    `/masters/${id}`
  );
  const item = res.data?.master ?? res.data?.data ?? res.data;
  return item as MasterDetail;
};

/** POST /api/admin/masters — create a new master */
export const createMaster = async (payload: CreateMasterPayload): Promise<MasterDetail> => {
  const res = await axiosInstance.post<{ success: boolean; master: MasterDetail }>(
    "/masters",
    payload
  );
  return res.data.master;
};

/** PUT /api/admin/masters/:id — update master label */
export const updateMasterLabel = async (id: string, label: string): Promise<MasterDetail> => {
  const res = await axiosInstance.put<{ success: boolean; master: MasterDetail }>(
    `/masters/${id}`,
    { label }
  );
  return res.data.master;
};

/** PUT /api/admin/masters/:id/values — replace entire values array */
export const updateMasterValues = async (id: string, values: MasterValues): Promise<MasterDetail> => {
  const res = await axiosInstance.put<{ success: boolean; master: MasterDetail }>(
    `/masters/${id}/values`,
    { values }
  );
  return res.data.master;
};

/** DELETE /api/admin/masters/:id — delete a master entirely */
export const deleteMaster = async (id: string): Promise<void> => {
  await axiosInstance.delete(`/masters/${id}`);
};

// ── Banks API ─────────────────────────────────────────────────────────────────
//
// KEEP these on purpose. The "custom bank" flow — a bank that is not in the
// list yet gets added by the admin (or by a loan form sending a self-typed bank) —
// runs through the single-value routes here (POST to append one, PUT to rename
// one, DELETE to drop one). The admin Bank Details page saves the whole list
// through PUT /masters/banks, so these stay as the fine-grained alternative and
// must not be treated as dead code.

/**
 * GET /api/admin/masters/banks
 * Returns the full banks list.
 */
export const getBanks = async (): Promise<string[]> => {
  const res = await axiosInstance.get<{
    success: boolean;
    data?: string[];
    banks?: string[];
    values?: string[];
  }>("/masters/banks");
  const list = res.data.data ?? res.data.banks ?? res.data.values;
  if (!Array.isArray(list)) throw new Error("Unexpected response from GET /masters/banks");
  return list;
};

/**
 * POST /api/admin/masters/banks
 * Create / initialise the banks list, or append custom bank(s).
 * Body: { banks: ["A", "B", ...] }  — initialize
 *       { value: "Kotak" }          — add one custom bank
 */
export const createBanks = async (banks: string[]): Promise<void> => {
  await axiosInstance.post("/masters/banks", { banks });
};

/**
 * PUT /api/admin/masters/banks
 * Replace the entire banks list.
 * Body: { values: ["A", "B", ...] }
 */
export const replaceBanks = async (values: string[]): Promise<void> => {
  await axiosInstance.put("/masters/banks", { values });
};

/**
 * DELETE /api/admin/masters/banks/:value
 * Remove a single bank entry by value.
 */
export const deleteBankValue = async (value: string): Promise<void> => {
  await axiosInstance.delete(`/masters/banks/${encodeURIComponent(value)}`);
};

/** PUT /api/admin/masters/banks/:value — rename a single bank entry */
export const updateBankValue = async (oldValue: string, newValue: string): Promise<void> => {
  await axiosInstance.put(
    `/masters/banks/${encodeURIComponent(oldValue)}`,
    { value: newValue }
  );
};

// ── Resolve a master by its type key ──────────────────────────────────────────

/**
 * Resolve a master from its stable `type` key (e.g. "banks", "statesByCountry").
 *
 * The admin API only needs the generic master CRUD, so this resolves in two
 * steps: `GET /masters` (summary list) → find the entry whose `type` matches →
 * `GET /masters/:id` (full detail). No dedicated `/masters/type/:type` route is
 * required; type-addressed URLs are a client-side concern only.
 */
export const getMasterByType = async (type: string): Promise<MasterDetail> => {
  const list = await getMasters();
  const found = list.find((m) => m.type === type);
  if (!found) {
    throw Object.assign(new Error(`No master found for type "${type}".`), {
      response: { status: 404, data: { message: `No master found for type "${type}".` } },
    });
  }
  return getMaster(found._id);
};
