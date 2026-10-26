import axiosInstance from "./axiosInstance";

export { getApiErrorMessage } from "../utils/apiError";

/** One rejected application, flattened across every loan product. */
export interface RejectedLoan {
  _id: string;
  /** Backend URL segment (e.g. `npa-loans`) — detail link ke liye slug me map hota hai. */
  resource: string;
  productKey: string;
  productLabel: string;
  status: string;
  applicationNo?: string | null;
  loanType?: string;
  loanAmount?: number;
  fullName?: string;
  mobile?: string;
  /** Reject reason — backend `adminNote` (customer-facing message). */
  rejectionReason: string;
  /** true = eligibility gate ne khud reject kiya (3 din baad delete), false = admin decision. */
  isAutoRejected: boolean;
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
