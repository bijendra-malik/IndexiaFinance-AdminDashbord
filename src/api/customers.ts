import axiosInstance from "./axiosInstance";
import type { PersonalLoan } from "./personalLoans";

// ── Types ────────────────────────────────────────────────────────────────────

export interface Customer {
  _id: string;
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
  franchiseStatus?: string;
  franchiseAppliedAt?: string | null;
  franchiseApprovedAt?: string | null;
  franchiseRejectedAt?: string | null;
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
    franchiseStatus: optionalText(item.franchiseStatus),
    franchiseAppliedAt: optionalText(item.franchiseAppliedAt) ?? null,
    franchiseApprovedAt: optionalText(item.franchiseApprovedAt) ?? null,
    franchiseRejectedAt: optionalText(item.franchiseRejectedAt) ?? null,
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
  const item = root.customer ?? nested.customer ?? root.data ?? res.data;
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
  }>(`/customers/${id}/applications`);
  if (!Array.isArray(res.data?.data)) {
    throw new Error("Unexpected response while loading customer applications.");
  }
  return res.data.data;
};

/** DELETE /api/admin/customers/:id — remove a customer account */
export const deleteCustomer = async (id: string): Promise<void> => {
  await axiosInstance.delete(`/customers/${id}`);
};
