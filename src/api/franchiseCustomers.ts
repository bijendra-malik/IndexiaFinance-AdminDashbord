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

export interface FranchiseCibilStats {
  threshold: number;
  total: number;
  consented: number;
  notChecked: number;
  checked: number;
  failed: number;
  eligible: number;
  locked: number;
  checkedLocked: number;
  byStatus: Record<string, number>;
  byFranchise: Array<{
    franchise: FranchiseSummary | null;
    total: number;
    consented: number;
    notChecked: number;
    checked: number;
    failed: number;
    eligible: number;
    locked: number;
    checkedLocked: number;
  }>;
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

export const getFranchiseCibilStats = async (): Promise<FranchiseCibilStats> => {
  const response = await axiosInstance.get<{ stats: FranchiseCibilStats }>("/franchise-customers/stats");
  return response.data.stats;
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
