import axiosInstance from "./axiosInstance";
import type { PersonalLoan } from "./personalLoans";

// ── Types ────────────────────────────────────────────────────────────────────

export interface Customer {
  _id: string;
  /** Human-facing customer number (for example CUST000046); `_id` remains the API lookup key. */
  customerId?: string;
  name: string;
  mobile: string;
  email: string;
  isVerified: boolean;
  isActive: boolean;
  role: string;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
  continent?: string;
  country?: string;
  state?: string;
  city?: string;
  pincode?: string;
  panNumber?: string;
  package?: string;
  /** Self-declared score, stored on the customer account (300–900; null = never checked). */
  creditScore?: number | null;
  creditScoreCheckedAt?: string | null;
  /** Backend rule: creditScore >= 650. */
  creditEligible?: boolean;
  /** 24-hour application window that opens when a qualifying score is submitted. */
  creditEligibilityExpiresAt?: string | null;
}

export interface CustomerApplicationGroup {
  product: string;
  count: number;
  applications: PersonalLoan[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export { getApiErrorMessage } from "../utils/apiError";

// ── API Calls ────────────────────────────────────────────────────────────────

const recordOf = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const optionalText = (value: unknown): string | undefined =>
  typeof value === "string" || typeof value === "number" ? String(value) : undefined;

const toCustomer = (value: unknown): Customer => {
  const item = recordOf(value);
  return {
    _id: optionalText(item._id ?? item.id) ?? "",
    customerId: optionalText(item.customerId ?? item.customer_id),
    name: optionalText(item.name ?? item.fullName) ?? "",
    mobile: optionalText(item.mobile ?? item.phone) ?? "",
    email: optionalText(item.email) ?? "",
    isVerified: item.isVerified === true,
    isActive: item.isActive === true,
    role: optionalText(item.role) ?? "Customer",
    lastLogin: optionalText(item.lastLogin) ?? null,
    createdAt: optionalText(item.createdAt) ?? "",
    updatedAt: optionalText(item.updatedAt) ?? "",
    continent: optionalText(item.continent),
    country: optionalText(item.country),
    state: optionalText(item.state),
    city: optionalText(item.city),
    pincode: optionalText(item.pincode ?? item.pinCode),
    panNumber: optionalText(item.panNumber ?? item.pan),
    package: optionalText(item.package ?? item.packageName),
    creditScore: typeof item.creditScore === "number" ? item.creditScore : null,
    creditScoreCheckedAt: optionalText(item.creditScoreCheckedAt) ?? null,
    creditEligible: item.creditEligible === true,
    creditEligibilityExpiresAt: optionalText(item.creditEligibilityExpiresAt) ?? null,
  };
};

export const getCustomers = async (params?: {
  search?: string;
  isActive?: boolean;
}): Promise<Customer[]> => {
  const res = await axiosInstance.get<unknown>("/customers", { params });
  const root = recordOf(res.data);
  const nested = recordOf(root.data);
  const list = Array.isArray(res.data)
    ? res.data
    : [root.customers, root.users, root.data, root.results, nested.customers, nested.users, nested.results]
      .find(Array.isArray);
  if (!Array.isArray(list)) {
    throw new Error("Unexpected response while loading customer accounts.");
  }
  return list.map(toCustomer).filter((customer) => customer._id);
};

export const updateCustomerStatus = async (
  id: string,
  isActive: boolean
): Promise<void> => {
  await axiosInstance.patch(`/customers/${encodeURIComponent(id)}/status`, { isActive });
};

export const getCustomer = async (id: string): Promise<Customer> => {
  const res = await axiosInstance.get<unknown>(`/customers/${encodeURIComponent(id)}`);
  const root = recordOf(res.data);
  const nested = recordOf(root.data);
  const item = root.customer ?? root.user ?? nested.customer ?? nested.user ?? root.data ?? res.data;
  const customer = toCustomer(item);
  if (!customer._id) throw new Error("Unexpected response while loading customer details.");
  return customer;
};

/** Fetch every loan application submitted by a customer, grouped by product. */
export const getCustomerApplications = async (
  id: string
): Promise<CustomerApplicationGroup[]> => {
  const res = await axiosInstance.get<{
    success?: boolean;
    data?: CustomerApplicationGroup[];
  }>(`/customers/${encodeURIComponent(id)}/applications`);
  if (!Array.isArray(res.data?.data)) {
    throw new Error("Unexpected response while loading customer applications.");
  }
  return res.data.data;
};

/** DELETE /api/admin/customers/:id — remove a customer account */
export const deleteCustomer = async (id: string): Promise<void> => {
  await axiosInstance.delete(`/customers/${id}`);
};
