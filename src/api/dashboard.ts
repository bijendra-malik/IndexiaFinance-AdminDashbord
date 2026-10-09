import axiosInstance from "./axiosInstance";
import type { PersonalLoan } from "./personalLoans";
import { getFranchiseCibilStats } from "./franchiseCustomers";
import { getApiErrorMessage } from "../utils/apiError";

export interface ProductStat {
  slug: string;
  label: string;
  total: number;
  submitted: number;
  pending: number;
  approved: number;
  rejected: number;
  requestedAmount: number;
  approvedAmount: number;
}

export interface RecentApplication extends PersonalLoan {
  slug: string;
  label: string;
}

export interface DashboardStats {
  totalCustomers: number;
  totalApplications: number;
  submitted: number;
  pending: number;
  approved: number;
  rejected: number;
  requestedAmount: number;
  approvedAmount: number;
  approvalRate: number;
  products: ProductStat[];
  recent: RecentApplication[];
  generatedAt: string;
  franchiseCustomerTotal: number;
  franchiseCustomersError?: string;
}

interface DashboardStatsResponse {
  success: boolean;
  stats: Omit<DashboardStats, "franchiseCustomerTotal" | "franchiseCustomersError">;
}

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const [dashboardResult, franchiseCustomersResult] = await Promise.allSettled([
    axiosInstance.get<DashboardStatsResponse>("/dashboard/stats"),
    getFranchiseCibilStats(),
  ]);

  if (dashboardResult.status === "rejected") {
    throw dashboardResult.reason;
  }

  const stats = dashboardResult.value.data.stats;
  if (!stats || !Array.isArray(stats.products) || !Array.isArray(stats.recent)) {
    throw new Error("Unexpected response while loading dashboard statistics.");
  }

  return {
    ...stats,
    franchiseCustomerTotal:
      franchiseCustomersResult.status === "fulfilled"
        ? franchiseCustomersResult.value.total
        : 0,
    franchiseCustomersError:
      franchiseCustomersResult.status === "rejected"
        ? getApiErrorMessage(
            franchiseCustomersResult.reason,
            "Could not load franchise customer statistics."
          )
        : undefined,
  };
};
