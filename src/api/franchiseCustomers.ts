import axiosInstance from "./axiosInstance";

export interface FranchiseSummary {
  _id: string;
  name?: string;
  franchiseId?: string;
  franchiseStatus?: string;
}

export interface FranchiseCustomerCibil {
  status: "NotChecked" | "Checked" | "Failed" | string;
  score?: number | null;
  band?: { key?: string; label?: string; min?: number };
  provider?: string;
  referenceId?: string;
  checkedAt?: string | null;
  expiresAt?: string | null;
  failureReason?: string | null;
  threshold?: number;
  canApplyLoan?: boolean;
  locked?: boolean;
  reason?: string | null;
}

export interface FranchiseCustomer {
  _id: string;
  franchiseCode?: string;
  fullName?: string;
  mobile?: string;
  email?: string;
  panNumber?: string;
  dob?: string | null;
  cibilConsentAt?: string | null;
  cibil?: FranchiseCustomerCibil;
  loanForm?: { locked?: boolean; reason?: string | null; canApplyLoan?: boolean };
  franchise?: FranchiseSummary | null;
  loans?: { count?: number; lastAppliedAt?: string | null };
}

export interface FranchiseCustomerPage {
  customers: FranchiseCustomer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Per-franchise row of `GET /franchise-customers/stats`.
 *
 * The live backend returns `{ franchise, total }` only — the CIBIL funnel
 * columns were dropped from the payload, so they stay optional here and the UI
 * renders them only when the response actually supplies them.
 */
export interface FranchiseCustomerStatRow {
  franchise: FranchiseSummary | null;
  total: number;
  consented?: number;
  notChecked?: number;
  checked?: number;
  failed?: number;
  eligible?: number;
  locked?: number;
  checkedLocked?: number;
}

export interface FranchiseCustomerStats {
  total: number;
  byFranchise: FranchiseCustomerStatRow[];
  /** Legacy CIBIL aggregate — only sent by older backend deployments. */
  threshold?: number;
  consented?: number;
  notChecked?: number;
  checked?: number;
  failed?: number;
  eligible?: number;
  locked?: number;
  checkedLocked?: number;
  byStatus?: Record<string, number>;
}

export interface FranchiseCustomerLoan {
  applicationNo?: string;
  status?: string;
  stage?: string;
  stageKey?: string;
  step?: number;
}

export interface FranchiseCustomerLoanGroup {
  product: string;
  count: number;
  applications: FranchiseCustomerLoan[];
}

export interface FranchiseCustomerDetail extends Omit<FranchiseCustomer, "loans"> {
  loans?: {
    total: number;
    byStatus: Record<string, number>;
    data: FranchiseCustomerLoanGroup[];
  };
}

export const getFranchiseCustomers = async (params: {
  search?: string;
  franchise?: string;
  cibilStatus?: string;
  locked?: string;
  page: number;
  limit: number;
}): Promise<FranchiseCustomerPage> => {
  const response = await axiosInstance.get<FranchiseCustomerPage>("/franchise-customers", { params });
  return response.data;
};

/** GET /franchise-customers/stats — network-wide count, franchise by franchise. */
export const getFranchiseCustomerStats = async (): Promise<FranchiseCustomerStats> => {
  const response = await axiosInstance.get<{ stats?: FranchiseCustomerStats }>("/franchise-customers/stats");
  const stats = response.data.stats;
  if (!stats || !Array.isArray(stats.byFranchise)) {
    throw new Error("Unexpected response from GET /franchise-customers/stats");
  }
  return stats;
};

export const getFranchiseCustomer = async (id: string): Promise<{
  customer: FranchiseCustomerDetail;
  franchise: FranchiseSummary | null;
  loans: NonNullable<FranchiseCustomerDetail["loans"]>;
}> => {
  const response = await axiosInstance.get<{
    customer: FranchiseCustomerDetail;
    franchise: FranchiseSummary | null;
    loans: NonNullable<FranchiseCustomerDetail["loans"]>;
  }>(`/franchise-customers/${encodeURIComponent(id)}`);
  return response.data;
};

export { getApiErrorMessage } from "../utils/apiError";
