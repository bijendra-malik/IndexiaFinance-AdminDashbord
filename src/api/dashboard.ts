import axiosInstance from "./axiosInstance";
import { getFranchiseCustomerStats } from "./franchiseCustomers";
import { getApiErrorMessage } from "../utils/apiError";
import { getCustomers } from "./customers";
import { getFranchises } from "./franchises";
import { resourceToSlug } from "./personalLoans";

export interface ProductStat {
  /**
   * Optional on purpose: the documented payload includes it, but the live
   * backend has returned product rows without `slug`. Consumers must not use
   * it as a React key or an identity — use a label-derived key instead.
   */
  slug?: string;
  label: string;
  total: number;
  submitted: number;
  pending: number;
  approved: number;
  rejected: number;
  requestedAmount: number;
  approvedAmount: number;
}

/** One row of the "Recent Applications" table, already normalised. */
export interface RecentApplication {
  _id: string;
  /** Product slug, derived from `resource` when the payload carries no slug. */
  slug?: string;
  label: string;
  fullName?: string;
  mobile?: string;
  loanType?: string;
  status: string;
  loanAmount?: number;
  createdAt: string;
}

/**
 * `/dashboard/stats` keys as the backend actually sends them:
 * product rows carry the decision counts capitalised (`Submitted`, `Pending`,
 * …) plus a `resource` path instead of a `slug`, and recent rows carry
 * `applicantName` / `product` / `resource` instead of `fullName` / `label` /
 * `slug`. They are converted below, so the UI only ever sees the shapes this
 * file declares.
 */
interface RawProductStat {
  resource?: string;
  slug?: string;
  label?: string;
  total?: number;
  submitted?: number;
  pending?: number;
  approved?: number;
  rejected?: number;
  Submitted?: number;
  Pending?: number;
  Approved?: number;
  Rejected?: number;
  requestedAmount?: number;
  approvedAmount?: number;
}

interface RawRecentApplication {
  _id?: string;
  resource?: string;
  slug?: string;
  product?: string;
  label?: string;
  applicantName?: string;
  fullName?: string;
  mobile?: string;
  loanType?: string;
  status?: string;
  loanAmount?: number | null;
  createdAt?: string;
}

const toCount = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const toProductStat = (raw: RawProductStat): ProductStat => {
  const slug = raw.slug ?? resourceToSlug(raw.resource);
  return {
    ...(slug ? { slug } : {}),
    label: raw.label ?? raw.resource ?? "Loan product",
    total: toCount(raw.total),
    submitted: toCount(raw.submitted ?? raw.Submitted),
    pending: toCount(raw.pending ?? raw.Pending),
    approved: toCount(raw.approved ?? raw.Approved),
    rejected: toCount(raw.rejected ?? raw.Rejected),
    requestedAmount: toCount(raw.requestedAmount),
    approvedAmount: toCount(raw.approvedAmount),
  };
};

const toRecentApplication = (raw: RawRecentApplication): RecentApplication => {
  const slug = raw.slug ?? resourceToSlug(raw.resource);
  return {
    _id: raw._id ?? "",
    ...(slug ? { slug } : {}),
    label: raw.label ?? raw.product ?? raw.loanType ?? "Loan application",
    fullName: raw.fullName ?? raw.applicantName ?? "",
    mobile: raw.mobile ?? "",
    loanType: raw.loanType ?? "",
    status: raw.status ?? "Submitted",
    ...(typeof raw.loanAmount === "number" ? { loanAmount: raw.loanAmount } : {}),
    createdAt: raw.createdAt ?? "",
  };
};

export interface DashboardAccount {
  id: string;
  displayId?: string;
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
  stats: {
    totalCustomers: number;
    totalFranchises?: number;
    totalApplications: number;
    submitted: number;
    pending: number;
    approved: number;
    rejected: number;
    requestedAmount: number;
    approvedAmount: number;
    approvalRate: number;
    products: RawProductStat[];
    recent: RawRecentApplication[];
    generatedAt: string;
  };
}

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const [dashboardResult, franchiseCustomersResult, customersResult, franchisesResult] = await Promise.allSettled([
    axiosInstance.get<DashboardStatsResponse>("/dashboard/stats"),
    getFranchiseCustomerStats(),
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

  // Backend rows → the shapes the dashboard renders (see RawProductStat).
  const products = stats.products.map(toProductStat);
  const recent = stats.recent.map(toRecentApplication);

  const customers = customersResult.status === "fulfilled"
    ? customersResult.value.filter((customer) => customer.role.toLowerCase() === "customer")
    : [];
  const franchises = franchisesResult.status === "fulfilled"
    ? franchisesResult.value.franchises
    : [];
  const recentAccounts: DashboardAccount[] = [
    ...customers.map((customer): DashboardAccount => ({
      id: customer._id,
      displayId: customer.customerId || customer._id,
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
    products,
    recent,
    totalCustomers: customersResult.status === "fulfilled"
      ? customers.length
      : stats.totalCustomers,
    totalFranchises: franchisesResult.status === "fulfilled"
      ? franchisesResult.value.total
      : stats.totalFranchises ?? 0,
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
