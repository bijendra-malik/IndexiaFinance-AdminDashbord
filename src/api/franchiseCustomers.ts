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
  loans?: {
    count?: number;
    lastAppliedAt?: string | null;
    /** Product-wise names — newer list responses bhejte hain, warna detail se aate hain. */
    byProduct?: { product: string; count: number }[];
    products?: string[];
  };
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
  /** Is franchise ne apne customers ke kitne loans file kiye — product-wise. */
  loans?: {
    total: number;
    byProduct: { product: string; count: number }[];
  };
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
  /** Application id — detail route ke liye. Backend `_id` ya `applicationId` bhejta hai. */
  _id?: string;
  applicationId?: string;
  id?: string;
  applicationNo?: string;
  status?: string;
  stage?: string;
  stageKey?: string;
  step?: number;
  loanAmount?: number | null;
  loanType?: string;
  /** Product ka route slug, jab row khud bheje. */
  slug?: string;
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

/**
 * Franchise customer ka applicant contact — loan row sirf inhi fields se match
 * hoti hai (naam unique nahi hota, is liye usse match nahi karte).
 */
export interface FranchiseCustomerContact {
  mobile: string;
  email: string;
}

/**
 * Poore network ke franchise customers, page-by-page.
 *
 * Har loan product ka list payload franchise reference nahi bhejta, is liye
 * "franchise customer ka loan" filter sirf row marker par nahi chhod sakte —
 * warna marker na hone par direct customers ki applications bhi aa jaati hain.
 * Pages par cap nahi: adhoori directory ka matlab adhoora (galat) scope hai.
 */
export const getFranchiseCustomerDirectory = async (): Promise<FranchiseCustomerContact[]> => {
  const pageSize = 100;
  const first = await getFranchiseCustomers({ page: 1, limit: pageSize });
  const rows = [...first.customers];

  for (let page = 2; page <= (first.totalPages || 1); page += 1) {
    const next = await getFranchiseCustomers({ page, limit: pageSize });
    rows.push(...next.customers);
  }

  return rows.map((customer) => ({
    mobile: customer.mobile ?? "",
    email: customer.email ?? "",
  }));
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

/*
DELETE /franchise-customers/:id
Super admin only — franchise customer record (CIBIL audit trail ke saath) hat jaata hai.
*/
export const deleteFranchiseCustomer = async (id: string): Promise<void> => {
  await axiosInstance.delete(`/franchise-customers/${encodeURIComponent(id)}`);
};

export { getApiErrorMessage } from "../utils/apiError";
