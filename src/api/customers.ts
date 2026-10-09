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
}

export interface CustomerApplicationGroup {
  product: string;
  count: number;
  applications: PersonalLoan[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export { getApiErrorMessage } from "../utils/apiError";

// ── API Calls ────────────────────────────────────────────────────────────────

export const getCustomers = async (params?: {
  search?: string;
  isActive?: boolean;
}): Promise<Customer[]> => {
  const res = await axiosInstance.get<{ success?: boolean; customers?: Customer[]; data?: Customer[] }>(
    "/customers",
    { params }
  );
  if (Array.isArray(res.data)) return res.data as Customer[];
  return res.data?.customers ?? res.data?.data ?? [];
};

export const updateCustomerStatus = async (
  id: string,
  isActive: boolean
): Promise<void> => {
  await axiosInstance.patch(`/customers/${encodeURIComponent(id)}/status`, { isActive });
};

export const getCustomer = async (id: string): Promise<Customer> => {
  const res = await axiosInstance.get<{ success?: boolean; customer?: Customer; data?: Customer }>(
    `/customers/${id}`
  );
  const item = res.data?.customer ?? res.data?.data ?? res.data;
  return item as Customer;
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
