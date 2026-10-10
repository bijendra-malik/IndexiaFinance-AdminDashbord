import axiosInstance from "./axiosInstance";
import type { PersonalLoan } from "./personalLoans";
import { getFranchiseCibilStats } from "./franchiseCustomers";
import { getApiErrorMessage } from "../utils/apiError";
import { getCustomers } from "./customers";
import { getFranchises } from "./franchises";

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

export interface DashboardAccount {
  id: string;
  role: "Customer" | "Franchise";
  name: string;
  email: string;
  mobile: string;
  location: string;
  address: string;
  panNumber: string;
  packageName: string;
  status: string;
  isVerified: boolean;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
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
  totalFranchises: number;
  recentAccounts: DashboardAccount[];
  accountsError?: string;
}

interface DashboardStatsResponse {
  success: boolean;
  stats: Omit<
    DashboardStats,
    | "franchiseCustomerTotal"
    | "franchiseCustomersError"
    | "totalFranchises"
    | "recentAccounts"
    | "accountsError"
  >;
}

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const [dashboardResult, franchiseCustomersResult, customersResult, franchisesResult] = await Promise.allSettled([
    axiosInstance.get<DashboardStatsResponse>("/dashboard/stats"),
    getFranchiseCibilStats(),
    getCustomers(),
    getFranchises({ page: 1, limit: 10 }),
  ]);

  if (dashboardResult.status === "rejected") {
    throw dashboardResult.reason;
  }

  const stats = dashboardResult.value.data.stats;
  if (!stats || !Array.isArray(stats.products) || !Array.isArray(stats.recent)) {
    throw new Error("Unexpected response while loading dashboard statistics.");
  }

  const customers = customersResult.status === "fulfilled"
    ? customersResult.value.filter((customer) => customer.role.toLowerCase() === "customer")
    : [];
  const franchises = franchisesResult.status === "fulfilled"
    ? franchisesResult.value.franchises
    : [];
  const recentAccounts: DashboardAccount[] = [
    ...customers.map((customer): DashboardAccount => ({
      id: customer._id,
      role: "Customer",
      name: customer.name || "Customer",
      email: customer.email,
      mobile: customer.mobile,
      location: [customer.city, customer.state, customer.country, customer.continent, customer.pincode]
        .filter(Boolean).join(", "),
      address: "",
      panNumber: customer.panNumber ?? "",
      packageName: customer.package ?? "",
      status: customer.isActive ? "Active" : "Inactive",
      isVerified: customer.isVerified,
      isActive: customer.isActive,
      lastLogin: customer.lastLogin,
      createdAt: customer.createdAt,
    })),
    ...franchises.map((franchise): DashboardAccount => ({
      id: franchise._id,
      role: "Franchise",
      name: franchise.businessName || franchise.name || franchise.fullName || franchise.contactPerson || "Franchise",
      email: franchise.email ?? "",
      mobile: franchise.mobile || franchise.phone || "",
      location: [franchise.city, franchise.state, franchise.country, franchise.continent, franchise.pincode]
        .filter(Boolean).join(", "),
      address: franchise.address ?? "",
      panNumber: franchise.panNumber ?? "",
      packageName: franchise.package ?? "",
      status: !franchise.status || franchise.status.toLowerCase() === "none"
        ? "Registered"
        : franchise.status,
      isVerified: franchise.isVerified === true,
      isActive: franchise.isActive !== false,
      lastLogin: franchise.lastLogin ?? null,
      createdAt: franchise.createdAt ?? "",
    })),
  ].sort((left, right) =>
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  ).slice(0, 10);
  const accountErrors = [
    customersResult.status === "rejected"
      ? getApiErrorMessage(customersResult.reason, "Could not load customer accounts.")
      : "",
    franchisesResult.status === "rejected"
      ? getApiErrorMessage(franchisesResult.reason, "Could not load franchise accounts.")
      : "",
  ].filter(Boolean);

  return {
    ...stats,
    totalCustomers: customersResult.status === "fulfilled"
      ? customers.length
      : stats.totalCustomers,
    totalFranchises: franchisesResult.status === "fulfilled"
      ? franchisesResult.value.total
      : 0,
    recentAccounts,
    accountsError: accountErrors.join(" "),
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
