import axiosInstance from "./axiosInstance";

export { getApiErrorMessage } from "../utils/apiError";

/** One rejected application, flattened across every loan product. */
export interface RejectedLoan {
  _id: string;
  /**
   * Backend URL segment (e.g. `npa-loans`) — detail link ke liye slug me map hota
   * hai. Credit-score rejections (jahan koi application submit nahi hui) me null.
   */
  resource?: string | null;
  productKey?: string | null;
  productLabel: string;
  status: string;
  applicationNo?: string | null;
  loanType?: string;
  loanAmount?: number;
  fullName?: string;
  mobile?: string;
  /** Channel: franchise id/`FRN…` code set hone par application franchise ne file ki hai. */
  franchise?: string | null;
  franchiseCode?: string | null;
  franchiseCustomer?: string | null;
  /** Reject reason — backend `adminNote` (customer-facing message). */
  rejectionReason: string;
  /**
   * Kis type ka rejection hai:
   *   customer           -> customer ne khud apply kiya,
   *   franchise-customer -> franchise ne apne customer ke naam par file kiya,
   *   franchise          -> franchise ki khud ki application reject hui.
   */
  channel?: "customer" | "franchise-customer" | "franchise";
  /** true = eligibility gate ne khud reject kiya (30 din baad delete), false = admin decision. */
  isAutoRejected: boolean;
  /** Admin decisions par — kis admin ne reject kiya (naam), rule rows par nahi. */
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  autoRejectedAt?: string | null;
  createdAt: string;
  employmentType?: string;
  companyType?: string;
  salaryReceivedAs?: string;
  creditScore?: number | null;
  [key: string]: unknown;
}

interface RejectedLoansResponse {
  success: boolean;
  total: number;
  autoRejected: number;
  loans: RejectedLoan[];
}

/** GET /api/admin/rejected-loans — sabhi products ki rejections, newest first. */
export const getRejectedLoans = async (): Promise<RejectedLoan[]> => {
  const res = await axiosInstance.get<RejectedLoansResponse>("/rejected-loans");
  return Array.isArray(res.data?.loans) ? res.data.loans : [];
};
